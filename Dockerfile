FROM node:18

# Install Fluent Bit
# Install required packages
RUN apt-get update && \
    apt-get install -y curl gnupg lsb-release && \
    curl https://packages.fluentbit.io/fluentbit.key | gpg --dearmor -o /usr/share/keyrings/fluentbit-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/fluentbit-archive-keyring.gpg] https://packages.fluentbit.io/debian/$(lsb_release -cs) $(lsb_release -cs) main" > /etc/apt/sources.list.d/fluentbit.list && \
    apt-get update && \
    apt-get install -y fluent-bit

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
