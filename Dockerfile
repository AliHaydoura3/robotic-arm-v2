# Stage 1: Build the React frontend
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist
COPY server/ ./server/

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/index.js"]
