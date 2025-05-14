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

# Build the application using NestJS CLI
RUN npx nest build
RUN ls -la dist/

# Copy Fluent Bit config
COPY fluent-bit/fluent-bit.conf /fluent-bit/etc/fluent-bit.conf

# Expose ports (adjust if needed)
EXPOSE 3000

# Create a startup script with correct paths
RUN echo '#!/bin/bash\n\
# Check if Fluent Bit is installed and in PATH\n\
FB_PATH=$(which fluent-bit || echo "/opt/fluent-bit/bin/fluent-bit")\n\
if [ -x "$FB_PATH" ]; then\n\
  echo "Starting Fluent Bit..."\n\
  $FB_PATH -c /fluent-bit/etc/fluent-bit.conf &\n\
else\n\
  echo "Warning: Fluent Bit not found in PATH. Skipping..."\n\
fi\n\
\n\
# Start the NestJS application\n\
echo "Starting NestJS application..."\n\
NODE_ENV=production node dist/main.js\n' > /usr/src/app/start.sh && \
    chmod +x /usr/src/app/start.sh

# Command to run both services
CMD ["/usr/src/app/start.sh"]