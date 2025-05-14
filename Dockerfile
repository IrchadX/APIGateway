FROM node:18

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install
RUN npm install -g @nestjs/cli

# Copy prisma schema first (for optimization)
COPY prisma ./prisma/

# Generate Prisma client with correct binaries
RUN npx prisma generate

# Copy the rest of your app
COPY . .

# Build the app
RUN npm run build

# Start the app
CMD ["nest", "start"]