FROM oven/bun:latest

WORKDIR /app

COPY ./package.json ./bun.lockb ./

RUN bun install

COPY . .

EXPOSE 3096

ENV NODE_ENV=production

CMD ["bun",  "start"]
