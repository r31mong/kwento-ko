FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
COPY package.json .
RUN npm install --omit=dev
COPY server.js .
EXPOSE 3000
USER node
CMD ["node", "server.js"]
