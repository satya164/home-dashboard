FROM node:22-alpine AS build-env

WORKDIR /app

COPY . .

RUN npm ci &&\
    npm run build

FROM gcr.io/distroless/nodejs22-debian12

WORKDIR /app

COPY --from=build-env /app /app

EXPOSE 3096

ENV NODE_ENV=production

CMD ["dist/src/index.js"]
