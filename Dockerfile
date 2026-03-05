FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --production
COPY src/ ./src/
ENV NODE_ENV=production
EXPOSE 8080
CMD ["bun", "run", "src/server/index.ts"]
