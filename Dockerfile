# Use Debian-based Node image
FROM node:20-slim

# Set up environment variables
ENV NODE_ENV=production
ENV APPLICATION_ENV=production
ENV FLUENT_HOST=localhost
ENV FLUENT_PORT=24224

# Set consistent log directory
ENV LOG_DIR=/app/logs

# Create log directory with proper permissions
RUN mkdir -p /app/logs && chmod 777 /app/logs

# Ensure your start script creates the directory too
RUN echo 'mkdir -p /app/logs && chmod 777 /app/logs' >> /usr/src/app/start.sh
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

# Create directories for Fluent Bit configuration and logs
RUN mkdir -p /fluent-bit/etc /fluent-bit/logs
RUN chmod 755 /fluent-bit/logs

RUN npm install winston 

# Install NestJS CLI globally
RUN npm install -g @nestjs/cli

# Copy package files and Prisma schema first
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev dependencies needed for Prisma)
RUN npm ci

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
# NestJS app port
EXPOSE 24224 
# HTTP input port
EXPOSE 24225 
# Forward input port
EXPOSE 2020 
# Fluent Bit API port

# Set log directory environment variable for NestJS
ENV LOG_DIR=/logs

# Start both services using a startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh


# Create improved startup script with better error handling and Prisma re-generation
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
echo "Starting containers with NODE_ENV=$NODE_ENV"\n\
\n\
# Regenerate Prisma client on startup to ensure it matches the environment\n\
echo "Regenerating Prisma client..."\n\
npx prisma generate\n\
\n\
# Ensure log directory exists and has proper permissions\n\
mkdir -p /fluent-bit/logs\n\
chmod 755 /fluent-bit/logs\n\
\n\
# Also create local logs directory for application file logging\n\
mkdir -p /usr/src/app/logs\n\
chmod 755 /usr/src/app/logs\n\
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
  # Get size of application.log in MB\n\
  if [ -f "/fluent-bit/logs/application.log" ]; then\n\
    SIZE=$(du -m "/fluent-bit/logs/application.log" | cut -f1)\n\
    \n\
    # If larger than 100MB, rotate\n\
    if [ "$SIZE" -gt 100 ]; then\n\
      echo "Rotating logs - application.log has grown to ${SIZE}MB"\n\
      TIMESTAMP=$(date +"%Y%m%d_%H%M%S")\n\
      mv "/fluent-bit/logs/application.log" "/fluent-bit/logs/application_${TIMESTAMP}.log"\n\
      \n\
      # Signal Fluent Bit to reopen log files\n\
      if check_process $FLUENT_PID; then\n\
        kill -USR1 $FLUENT_PID\n\
      fi\n\
    fi\n\
  fi\n\
  \n\
  # Also rotate application logs if needed\n\
  if [ -f "/usr/src/app/logs/application.log" ]; then\n\
    SIZE=$(du -m "/usr/src/app/logs/application.log" | cut -f1)\n\
    \n\
    if [ "$SIZE" -gt 100 ]; then\n\
      echo "Rotating logs - application file log has grown to ${SIZE}MB"\n\
      TIMESTAMP=$(date +"%Y%m%d_%H%M%S")\n\
      mv "/usr/src/app/logs/application.log" "/usr/src/app/logs/application_${TIMESTAMP}.log"\n\
    fi\n\
  fi\n\
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
  # Sleep before checking again\n\
  sleep 60\n\
done\n' > /usr/src/app/start.sh && \
    chmod +x /usr/src/app/start.sh


# Copy and configure log rotation scripts
COPY scripts/rotate-logs.sh /usr/local/bin/rotate-logs
COPY scripts/start-services.sh /usr/local/bin/start-services

# Make scripts executable
RUN chmod +x /usr/local/bin/rotate-logs /usr/local/bin/start-services


# Set up cron job for log rotation
RUN echo "0 * * * * root /usr/local/bin/rotate-logs >> /logs/rotation.log 2>&1" > /etc/cron.d/log-rotation
RUN chmod 0644 /etc/cron.d/log-rotation

# Create symlink for cron logs
RUN ln -sf /dev/stdout /var/log/cron.log

# Command to run the startup script heheh 
CMD ["/usr/src/app/start.sh"]
