# ============== build stage ==================
FROM node as builder

WORKDIR /app

COPY ["./package.json","./yarn.lock","/app/"]

RUN yarn

COPY "./" "/app/"

RUN yarn build

# ============== runtime stage ================
FROM node:alpine as runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder "/app/dist/" "/app/dist"
COPY --from=builder "/app/package.json" "/app/package.json"
COPY "./.env" "/app/.env"

RUN yarn --production

CMD ["yarn","start:prod"]