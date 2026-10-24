# Front v2 de produção: o build estático servido por um Caddy interno (porta 80, sem HTTPS), que também
# repassa /api e /hangfire pra API. O HTTPS e o domínio ficam no proxy central da VPS (E:\VSCode\pontes\servidor).
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM caddy:2-alpine AS runtime
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv/app
