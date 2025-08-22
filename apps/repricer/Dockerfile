# Use Node.js 22 as base image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy source code
COPY . ./

# Install all at root
RUN npm ci

RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose port 3000
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Set working directory to repricer for the final command
WORKDIR /app/apps/repricer

# Start the application
CMD ["npm", "start"]
