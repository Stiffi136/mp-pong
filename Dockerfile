# Build-Stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:server

# Runtime-Stage
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist/server ./dist/server
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/server/server/index.js"]
