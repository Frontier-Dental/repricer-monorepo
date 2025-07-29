# Use Node.js 22 as base image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install dependencies (including dev dependencies for TypeScript build)
COPY repricer/package.json ./repricer/package.json
RUN cd repricer && npm install

# Copy source code
COPY repricer/ ./

# Build TypeScript code
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Copy app-specific package.json
RUN cd ..
COPY front-end/package.json ./front-end/package.json
RUN cd front-end && npm install && npm run build && cd ..

# Expose port 3000
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

RUN cd repricer

# Start the application
CMD ["npm", "start"]
