FROM node:18

# Install Fluent Bit
# Install required packages
RUN apt-get update && apt-get install -y curl gnupg lsb-release

# Add Fluent Bit repo and key
RUN curl -s https://packages.fluentbit.io/install.sh | bash

# Install Fluent Bit
RUN apt-get install -y fluent-bit


# Set up working directory
WORKDIR /usr/src/app

# Copy backend code and install
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Copy Fluent Bit config
COPY fluent-bit/fluent-bit.conf /fluent-bit/etc/fluent-bit.conf

# Command: run Fluent Bit and NestJS backend together
CMD fluent-bit -c /fluent-bit/etc/fluent-bit.conf & node dist/main.js
