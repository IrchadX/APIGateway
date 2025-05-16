# Use Debian-based Node image
FROM node:20-slim

# Set up environment variables
ENV NODE_ENV=production
ENV APPLICATION_ENV=production
ENV FLUENT_HOST=localhost
ENV FLUENT_PORT=24224

# Set consistent log directory - single source of truth
ENV LOG_DIR=/tmp

# Set up working directory
WORKDIR /usr/src/app

# Install required dependencies
RUN apt-get update && \
    apt-get install -y curl gnupg lsb-release procps openssl && \
    curl https://packages.fluentbit.io/fluentbit.key | gpg --dearmor -o /usr/share/keyrings/fluentbit-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/fluentbit-archive-keyring.gpg] https://packages.fluentbit.io/debian/$(lsb_release -cs) $(lsb_release -cs) main" > /etc/apt/sources.list.d/fluentbit.list && \
    apt-get update && \
    apt-get install -y fluent-bit && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create standardized log directory and set permissions
RUN mkdir -p ${LOG_DIR} && chmod 777 ${LOG_DIR}

# Install NestJS CLI globally
RUN npm install -g @nestjs/cli

# Copy package files and Prisma schema first
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci
RUN npm install winston archiver

# Generate Prisma client during build
RUN npx prisma generate

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Copy Fluent Bit config
COPY fluent-bit/fluent-bit.conf /fluent-bit/etc/fluent-bit.conf
COPY fluent-bit/parsers.conf /fluent-bit/etc/parsers.conf

EXPOSE 3512
EXPOSE 24224
EXPOSE 24225 
EXPOSE 2020 

# Create improved startup script with better error handling and Prisma re-generation
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
echo "Starting containers with NODE_ENV=$NODE_ENV"\n\
echo "Using log directory: $LOG_DIR"\n\
\n\
# Regenerate Prisma client on startup to ensure it matches the environment\n\
echo "Regenerating Prisma client..."\n\
npx prisma generate\n\
\n\
# Ensure log directory exists and has proper permissions\n\
mkdir -p ${LOG_DIR}\n\
chmod 777 ${LOG_DIR}\n\
\n\
# Check if the log directory is writable\n\
if [ ! -w "${LOG_DIR}" ]; then\n\
  echo "ERROR: Log directory ${LOG_DIR} is not writable!"\n\
  ls -la ${LOG_DIR}\n\
  exit 1\n\
fi\n\
\n\
# Create a test file to ensure directory is writable\n\
echo "Testing log directory write permissions..."\n\
touch ${LOG_DIR}/test.log && rm ${LOG_DIR}/test.log\n\
if [ $? -ne 0 ]; then\n\
  echo "ERROR: Could not write to log directory!"\n\
  exit 1\n\
else\n\
  echo "Log directory is writable."\n\
fi\n\
\n\
# Start Fluent Bit in the background\n\
echo "Starting Fluent Bit..."\n\
/opt/fluent-bit/bin/fluent-bit -c /fluent-bit/etc/fluent-bit.conf &\n\
FLUENT_PID=$!\n\
\n\
# Wait for Fluent Bit to be available\n\
echo "Waiting for Fluent Bit to start up..."\n\
sleep 5\n\
\n\
# Set PORT from environment or default\n\
export PORT=${PORT:-3512}\n\
echo "Using port: $PORT"\n\
\n\
# Start the NestJS application\n\
echo "Starting NestJS application with entry point: dist/src/main.js"\n\
node dist/src/main.js &\n\
APP_PID=$!\n\
\n\
# Function to check if a process is running\n\
check_process() {\n\
  if ! ps -p $1 > /dev/null; then\n\
    return 1\n\
  fi\n\
  return 0\n\
}\n\
\n\
# Function to rotate logs if needed\n\
rotate_logs() {\n\
  # Get size of log files in MB\n\
  for LOG_FILE in ${LOG_DIR}/*.log; do\n\
    if [ -f "$LOG_FILE" ]; then\n\
      FILENAME=$(basename "$LOG_FILE")\n\
      SIZE=$(du -m "$LOG_FILE" | cut -f1)\n\
      \n\
      # If larger than 100MB, rotate\n\
      if [ "$SIZE" -gt 100 ]; then\n\
        echo "Rotating logs - $FILENAME has grown to ${SIZE}MB"\n\
        TIMESTAMP=$(date +"%Y%m%d_%H%M%S")\n\
        mv "$LOG_FILE" "${LOG_DIR}/${FILENAME%.*}_${TIMESTAMP}.log"\n\
      fi\n\
    fi\n\
  done\n\
  \n\
  # Signal Fluent Bit to reopen log files\n\
  if check_process $FLUENT_PID; then\n\
    echo "Sending signal to Fluent Bit to reload..."\n\
    kill -USR1 $FLUENT_PID\n\
  fi\n\
}\n\
\n\
# List contents of log directory every minute for debugging\n\
list_logs() {\n\
  echo "Current log files in ${LOG_DIR}:"\n\
  ls -la ${LOG_DIR}\n\
}\n\
\n\
# Monitor both processes and handle log rotation\n\
while true; do\n\
  # Check if Fluent Bit is running\n\
  if ! check_process $FLUENT_PID; then\n\
    echo "Fluent Bit crashed or stopped, restarting..."\n\
    /opt/fluent-bit/bin/fluent-bit -c /fluent-bit/etc/fluent-bit.conf &\n\
    FLUENT_PID=$!\n\
    sleep 5\n\
  fi\n\
\n\
  # Check if the app is running\n\
  if ! check_process $APP_PID; then\n\
    echo "NestJS application crashed or stopped, restarting..."\n\
    # Regenerate Prisma client before restarting the app\n\
    npx prisma generate\n\
    node dist/src/main.js &\n\
    APP_PID=$!\n\
  fi\n\
\n\
  # Check if logs need to be rotated - do this once an hour\n\
  if [ "$(date +"%M")" = "00" ]; then\n\
    rotate_logs\n\
  fi\n\
\n\
  # List logs every minute for debugging\n\
  list_logs\n\
\n\
  # Sleep before checking again\n\
  sleep 60\n\
done\n' > /usr/src/app/start.sh && \
    chmod +x /usr/src/app/start.sh

# Command to run the startup script
CMD ["/usr/src/app/start.sh"]