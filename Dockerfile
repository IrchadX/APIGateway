# Use Node.js image
FROM node:20-slim

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3512
ENV FLUENT_HOST=127.0.0.1
ENV FLUENT_PORT=24224

# Create app directory
WORKDIR /usr/src/app

# Install Fluent Bit
RUN apt-get update && \
    apt-get install -y curl gnupg && \
    curl https://packages.fluentbit.io/fluentbit.key | gpg --dearmor > /usr/share/keyrings/fluentbit-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/fluentbit-keyring.gpg] https://packages.fluentbit.io/debian/bookworm bookworm main" > /etc/apt/sources.list.d/fluentbit.list && \
    apt-get update && \
    apt-get install -y fluent-bit && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy Fluent Bit config
COPY fluent-bit.conf /etc/fluent-bit/fluent-bit.conf

# Install app dependencies
COPY package*.json ./
RUN npm ci --production

# Bundle app source
COPY . .

# Build the app
RUN npm run build

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:${PORT}/health || exit 1

# Start script
CMD ["sh", "-c", "fluent-bit -c /etc/fluent-bit/fluent-bit.conf & node dist/src/main.js"]