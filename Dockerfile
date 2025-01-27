FROM node:22-alpine

WORKDIR /app

COPY . .

RUN npm ci
RUN npm run build

EXPOSE 3096

ENV NODE_ENV production

CMD ["npm",  "start"]
