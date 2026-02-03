FROM node:22-alpine

# Create non-root user BEFORE copying any files
RUN addgroup -g 1001 appuser && \
    adduser -D -u 1001 -G appuser appuser

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY turbo.json ./

# Copy application code
COPY . ./

# Install dependencies and build as root (required for npm)
RUN npm ci
RUN npx turbo run build --filter=repricer
RUN npm prune --production

# Change ownership to non-root user
RUN chown -R appuser:appuser /app

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production

# Install timezone data and set timezone
RUN apk add --no-cache tzdata
ENV TZ=Canada/Eastern
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Switch to non-root user BEFORE CMD
USER appuser

# Start application
WORKDIR /app/apps/repricer
CMD ["npm", "start"]