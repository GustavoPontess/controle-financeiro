FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src

COPY ControleFinanceiro.Api.csproj .
RUN dotnet restore

COPY . .
RUN dotnet publish -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS runtime
WORKDIR /app

# Usuário não-root (hardening pré-beta, 2026-08-18) — a imagem base roda como root por padrão.
# /app/logs é onde o Serilog file sink escreve (Program.cs, path relativo "logs/log-.json");
# /app/data era do SQLite (removido na #114), não usado por ninguém mais — não recriado.
RUN addgroup -S app && adduser -S app -G app && mkdir -p /app/logs && chown -R app:app /app
USER app

COPY --from=build --chown=app:app /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "ControleFinanceiro.Api.dll"]
