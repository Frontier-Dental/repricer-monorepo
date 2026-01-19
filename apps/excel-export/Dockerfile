FROM node:18-alpine

# Create non-root user
RUN addgroup -g 1001 appuser && \
    adduser -D -u 1001 -G appuser appuser

WORKDIR /app

# Copy and install dependencies
COPY package*.json ./
COPY turbo.json ./
COPY . ./

RUN npm ci
RUN npx turbo run build --filter=excel-export

WORKDIR /app/apps/excel-export
RUN npm prune --production

# Change ownership to non-root user
RUN chown -R appuser:appuser /app

EXPOSE 3003

# Set environment
ENV NODE_ENV=production

# Install timezone data and set timezone
RUN apk add --no-cache tzdata
ENV TZ=Canada/Eastern
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# HEALTHCHECK runs as the container user (appuser after USER directive)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3003/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# Switch to non-root user
USER appuser

# Start application
CMD ["node", "dist/main.js"]
