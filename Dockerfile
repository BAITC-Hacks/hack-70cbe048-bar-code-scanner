FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build && npm prune --omit=dev
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/data/history.sqlite
EXPOSE 3000
CMD ["npm", "start"]
