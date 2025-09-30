FROM node:18-alpine

WORKDIR /app

COPY . ./

RUN npm ci

RUN npm run build

WORKDIR /app/apps/excel-export

COPY apps/excel-export/resources ./dist/resources

RUN npm prune --production

EXPOSE 3003

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3003/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

CMD ["node", "dist/main.js"]