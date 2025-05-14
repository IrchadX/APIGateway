# Use Debian-based Node image instead of Alpine for compatibility with Fluent Bit
FROM node:20 AS builder

# Set up environment variables
ENV NODE_ENV=production
ENV APPLICATION_ENV=production

# Set up working directory
WORKDIR /usr/src/app

# Install NestJS CLI globally
RUN npm install -g @nestjs/cli

# Install dependencies for Fluent Bit
RUN apt-get update && \
    apt-get install -y curl gnupg lsb-release && \
    curl https://packages.fluentbit.io/fluentbit.key | gpg --dearmor -o /usr/share/keyrings/fluentbit-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/fluentbit-archive-keyring.gpg] https://packages.fluentbit.io/debian/$(lsb_release -cs) $(lsb_release -cs) main" > /etc/apt/sources.list.d/fluentbit.list && \
    apt-get update && \
    apt-get install -y fluent-bit && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create directory for Fluent Bit configuration
RUN mkdir -p /fluent-bit/etc

# Install Node.js dependencies
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

# Create simplified startup script that uses the correct entry point
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Start Fluent Bit in the background\n\
echo "Starting Fluent Bit..."\n\
/opt/fluent-bit/bin/fluent-bit -c /fluent-bit/etc/fluent-bit.conf &\n\
FLUENT_PID=$!\n\
\n\
# Wait a moment to ensure Fluent Bit starts properly\n\
sleep 2\n\
\n\
# Start the NestJS application - using the confirmed path to main.js\n\
echo "Starting NestJS application with entry point: dist/src/main.js"\n\
node dist/src/main.js &\n\
APP_PID=$!\n\
\n\
# Wait for either process to exit\n\
wait -n\n\
\n\
# If we get here, one of the processes exited\n\
EXIT_CODE=$?\n\
\n\
# Kill the other process\n\
kill $FLUENT_PID 2>/dev/null || true\n\
kill $APP_PID 2>/dev/null || true\n\
\n\
# Exit with the same code as the process that exited\n\
echo "Process exited with code $EXIT_CODE"\n\
exit $EXIT_CODE\n' > /usr/src/app/start.sh && \
    chmod +x /usr/src/app/start.sh

# Command to run both services
CMD ["/usr/src/app/start.sh"]