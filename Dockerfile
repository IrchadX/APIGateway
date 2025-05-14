# Use Debian-based Node image
FROM node:20-slim AS builder

# Set up environment variables
ENV NODE_ENV=production
ENV APPLICATION_ENV=production

# Set up working directory
WORKDIR /usr/src/app

# Install dependencies for Prisma
RUN apt-get update && \
    apt-get install -y openssl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy package files first for better caching
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma client
RUN npm ci
RUN npx prisma generate

# Install NestJS CLI globally
RUN npm install -g @nestjs/cli

# Install dependencies for Fluent Bit
RUN apt-get update && \
    apt-get install -y curl gnupg lsb-release procps && \
    curl https://packages.fluentbit.io/fluentbit.key | gpg --dearmor -o /usr/share/keyrings/fluentbit-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/fluentbit-archive-keyring.gpg] https://packages.fluentbit.io/debian/$(lsb_release -cs) $(lsb_release -cs) main" > /etc/apt/sources.list.d/fluentbit.list && \
    apt-get update && \
    apt-get install -y fluent-bit && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create directory for Fluent Bit configuration
RUN mkdir -p /fluent-bit/etc

# Copy package files first for better caching
COPY package*.json ./
RUN npm ci

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Copy Fluent Bit config
COPY fluent-bit/fluent-bit.conf /fluent-bit/etc/fluent-bit.conf

# Expose the port your app will run on
EXPOSE 3512

# Create improved startup script with better error handling
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
echo "Starting containers with NODE_ENV=$NODE_ENV"\n\
\n\
# Start Fluent Bit in the background\n\
echo "Starting Fluent Bit..."\n\
/opt/fluent-bit/bin/fluent-bit -c /fluent-bit/etc/fluent-bit.conf &\n\
FLUENT_PID=$!\n\
\n\
# Wait for Fluent Bit to be available (increased time)\n\
echo "Waiting for Fluent Bit to start up..."\n\
sleep 5\n\
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
# Monitor both processes\n\
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
    echo "NestJS application crashed or stopped with exit code $?, restarting..."\n\
    node dist/src/main.js &\n\
    APP_PID=$!\n\
  fi\n\
\n\
  # Sleep before checking again\n\
  sleep 5\n\
done\n' > /usr/src/app/start.sh && \
    chmod +x /usr/src/app/start.sh

# Command to run the startup script
CMD ["/usr/src/app/start.sh"]