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

# Build the application (with verbose output for debugging)
RUN npm run build || (echo "Build failed. Package.json content:" && cat package.json && exit 1)

# Copy Fluent Bit config
COPY fluent-bit/fluent-bit.conf /fluent-bit/etc/fluent-bit.conf

# Expose ports (adjust if needed)
EXPOSE 3000

# Create a startup script
RUN echo '#!/bin/bash\nfluent-bit -c /fluent-bit/etc/fluent-bit.conf &\nnode dist/main.js' > /usr/src/app/start.sh && \
    chmod +x /usr/src/app/start.sh

# Command to run both services
CMD ["/usr/src/app/start.sh"]