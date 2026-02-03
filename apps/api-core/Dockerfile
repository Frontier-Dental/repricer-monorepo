FROM node:22-alpine

# Create non-root user
RUN addgroup -g 1001 appuser && \
    adduser -D -u 1001 -G appuser appuser

WORKDIR /app

# Copy and install dependencies
COPY package*.json ./
COPY turbo.json ./
COPY . ./

RUN npm ci
RUN npx turbo run build --filter=api-core
RUN npm prune --production

# Change ownership to non-root user
RUN chown -R appuser:appuser /app

# Expose port
EXPOSE 5001

# Set environment variables
ENV NODE_ENV=production

# Install timezone data and set timezone
RUN apk add --no-cache tzdata
ENV TZ=Canada/Eastern
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Switch to non-root user
USER appuser

# Start application
WORKDIR /app/apps/api-core
CMD ["npm", "start"]
