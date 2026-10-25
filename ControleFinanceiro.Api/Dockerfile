FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

COPY ControleFinanceiro.Api.csproj .
RUN dotnet restore

COPY . .
RUN dotnet publish -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app

# Usuário não-root (hardening pré-beta, 2026-08-18).
# Versões recentes da imagem base aspnet:10.0-alpine já trazem o usuário/grupo `app` embutido —
# por isso a criação é idempotente (só cria se não existir), senão o build falha com exit 1.
# /app/logs é onde o Serilog file sink escreve (Program.cs, path relativo "logs/log-.json");
# /app/data era do SQLite (removido na #114), não usado por ninguém mais — não recriado.
RUN (getent group app || addgroup -S app) \
 && (id -u app >/dev/null 2>&1 || adduser -S app -G app) \
 && mkdir -p /app/logs /home/app/.aspnet/DataProtection-Keys \
 && chown -R app:app /app /home/app
USER app

COPY --from=build --chown=app:app /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "ControleFinanceiro.Api.dll"]
