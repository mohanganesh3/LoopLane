# syntax=docker/dockerfile:1

# ------------------------------
# Build the React client
# ------------------------------
FROM node:18-bullseye-slim AS client-build

WORKDIR /app

COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci

COPY client/ ./client/
RUN cd client && npm run build


# ------------------------------
# Runtime image (API + built client)
# ------------------------------
FROM node:18-bullseye-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Copy built client assets from the build stage
COPY --from=client-build /app/client/dist ./client/dist

EXPOSE 3000

CMD ["node", "server.js"]
