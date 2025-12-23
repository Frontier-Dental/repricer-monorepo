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

# Expose port 5001
EXPOSE 5001

# Set environment variables
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y tzdata
ENV TZ=Canada/Eastern
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone


# Start the application
WORKDIR /app/apps/api-core
CMD ["npm", "start"]
