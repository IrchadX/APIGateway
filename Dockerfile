# Use Debian-based Node image
FROM node:20-slim

# Set up environment variables
ENV NODE_ENV=production
ENV APPLICATION_ENV=production
ENV FLUENT_HOST=localhost
ENV FLUENT_PORT=24224

# Set up working directory
WORKDIR /usr/src/app

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
RUN npm ci --only=production

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Copy Fluent Bit config
COPY fluent-bit/fluent-bit.conf /fluent-bit/etc/fluent-bit.conf

# Expose the port your app will run on
EXPOSE 3512

# Create simplified startup script with better logging
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
echo "Starting services with NODE_ENV=$NODE_ENV"\n\
\n\
# Start Fluent Bit in the background with logging\n\
echo "Starting Fluent Bit..."\n\
/opt/fluent-bit/bin/fluent-bit -c /fluent-bit/etc/fluent-bit.conf > /var/log/fluent-bit.log 2>&1 &\n\
FLUENT_PID=$!\n\
echo "Fluent Bit started with PID: $FLUENT_PID"\n\
\n\
# Give Fluent Bit time to initialize\n\
echo "Waiting for Fluent Bit to start up..."\n\
sleep 3\n\
\n\
# Make sure the port environment variable is properly used\n\
export PORT=${PORT:-3512}\n\
echo "Using port: $PORT"\n\
\n\
# Start the NestJS application with proper logging\n\
echo "Starting NestJS application..."\n\
node dist/src/main.js\n' > /usr/src/app/start.sh && \
    chmod +x /usr/src/app/start.sh

# Command to run the startup script
CMD ["/usr/src/app/start.sh"]