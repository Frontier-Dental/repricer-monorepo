# Use Node.js 18 as base image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy app-specific package.json
COPY package.json ./package.json

# Install dependencies (including dev dependencies for TypeScript build)
RUN npm install

# Copy source code
COPY . ./

# Build TypeScript code
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose port 3000
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
