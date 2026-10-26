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

# ADMIN_PATH (endereço secreto do admin, do deploy): barra + 20 ou mais letras, números, - ou _. Fora disso, ou sem
# ele, o admin não sobe: a página é apagada e o Caddy aponta pra um caminho que não leva a nada.
CMD ["sh", "-c", "if ! printf '%s' \"$ADMIN_PATH\" | grep -Eq '^/[A-Za-z0-9_-]{20,}$'; then rm -f /srv/app/admin.html; export ADMIN_PATH=/.sem-admin; fi; exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile"]
