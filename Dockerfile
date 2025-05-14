FROM node:18-slim

# Set up working directory
WORKDIR /usr/src/app

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

# Expose ports
EXPOSE 3512

# Create startup script with proper error handling and logging
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Start Fluent Bit in the background\n\
echo "Starting Fluent Bit..."\n\
/opt/fluent-bit/bin/fluent-bit -c /fluent-bit/etc/fluent-bit.conf &\n\
FLUENT_BIT_PID=$!\n\
\n\
# Function to check if Fluent Bit is still running\n\
check_fluent_bit() {\n\
  if ! kill -0 $FLUENT_BIT_PID 2>/dev/null; then\n\
    echo "Fluent Bit crashed. Exiting..."\n\
    exit 1\n\
  fi\n\
}\n\
\n\
# Wait a moment to ensure Fluent Bit starts properly\n\
sleep 2\n\
check_fluent_bit\n\
\n\
# Start the NestJS application with proper error capturing\n\
echo "Starting NestJS application at $(date)..."\n\
echo "Using Node.js $(node --version)"\n\
echo "APPLICATION_ENV=${APPLICATION_ENV:-not set}"\n\
echo "NODE_ENV=${NODE_ENV:-not set}"\n\
\n\
# Run the NestJS application with output logged\n\
NODE_ENV=production node dist/src/main.js 2>&1 | tee /tmp/app.log\n\
\n\
# If we get here, the application exited\n\
EXIT_CODE=$?\n\
echo "Application exited with code $EXIT_CODE at $(date)"\n\
\n\
if [ $EXIT_CODE -ne 0 ]; then\n\
  echo "Application crashed. Last 20 lines of log:"\n\
  tail -n 20 /tmp/app.log\n\
fi\n\
\n\
# Kill Fluent Bit before exiting\n\
kill $FLUENT_BIT_PID 2>/dev/null || true\n\
\n\
# Exit with the same code as the application\n\
exit $EXIT_CODE\n' > /usr/src/app/start.sh && \
    chmod +x /usr/src/app/start.sh

# Command to run both services
CMD ["/usr/src/app/start.sh"]