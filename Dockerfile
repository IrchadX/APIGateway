FROM node:18

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

# Add debug information to help diagnose build issues
RUN echo "==== Current directory structure before build ====" && \
    ls -la && \
    echo "==== package.json contents ====" && \
    cat package.json

# Build the application using the exact command from your package.json
RUN npm run build

# Add more debug information to check the output
RUN echo "==== Current directory structure after build ====" && \
    ls -la && \
    echo "==== Dist directory structure ====" && \
    ls -la dist/ || echo "dist directory not found"

# Copy Fluent Bit config
COPY fluent-bit/fluent-bit.conf /fluent-bit/etc/fluent-bit.conf

# Expose ports (adjust if needed)
EXPOSE 3000

# Create a startup script that checks for the correct file location
RUN echo '#!/bin/bash\n\
# Start Fluent Bit\n\
echo "Starting Fluent Bit..."\n\
/opt/fluent-bit/bin/fluent-bit -c /fluent-bit/etc/fluent-bit.conf &\n\
\n\
# Start the NestJS application with proper error handling\n\
echo "Starting NestJS application..."\n\
\n\
# Check common locations for the main.js file\n\
if [ -f "dist/main.js" ]; then\n\
  echo "Found main.js at dist/main.js"\n\
  NODE_ENV=production node dist/main.js\n\
elif [ -f "dist/src/main.js" ]; then\n\
  echo "Found main.js at dist/src/main.js"\n\
  NODE_ENV=production node dist/src/main.js\n\
elif [ -f "dist/apps/api-gateway/main.js" ]; then\n\
  echo "Found main.js at dist/apps/api-gateway/main.js"\n\
  NODE_ENV=production node dist/apps/api-gateway/main.js\n\
else\n\
  echo "Error: Could not find main.js. Directory contents:"\n\
  find / -name "main.js" 2>/dev/null | head -n 10\n\
  echo "Directory structure:"\n\
  ls -R dist/\n\
  exit 1\n\
fi\n' > /usr/src/app/start.sh && \
    chmod +x /usr/src/app/start.sh

# Command to run both services
CMD ["/usr/src/app/start.sh"]