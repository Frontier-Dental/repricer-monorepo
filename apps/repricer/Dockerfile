# Use Node.js 18 as base image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy app-specific package.json
COPY apps/repricer/package.json ./package.json

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY apps/repricer/ ./

# Expose port 3000
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
