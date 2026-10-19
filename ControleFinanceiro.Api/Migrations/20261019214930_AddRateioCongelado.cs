using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRateioCongelado : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Valor",
                table: "RateiosTransacao",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "SaiuEm",
                table: "MembrosFamilia",
                type: "timestamp without time zone",
                nullable: true);

            // A parte de cada um passa a ficar GRAVADA na despesa (decisão do Gustavo, 2026-10-19). O que já estava
            // dividido ganha as partes pelo que a tela mostrava: o modo padrão da família e, nas partes, a divisão
            // igual entre os membros ativos que não são "só vê" (PapelPermissao 3). "Do meu jeito" já tinha os
            // percentuais: só ganha o valor em reais. (Família "pela renda" entra como igual: não havia renda
            // declarada em produção; o v2 nasceu em 2026-10.) O resto dos centavos vai pra quem pagou.
            migrationBuilder.Sql("""
                UPDATE "Transacoes" t SET "ModoRateio" = f."ModoRateioPadrao"
                FROM "Familias" f WHERE t."FamiliaId" = f."Id" AND t."ModoRateio" IS NULL;

                UPDATE "RateiosTransacao" r SET "Valor" = ROUND(t."Valor" * r."Percentual" / 100, 2)
                FROM "Transacoes" t WHERE t."Id" = r."TransacaoId";

                INSERT INTO "RateiosTransacao" ("Id", "TransacaoId", "UsuarioId", "Percentual", "Valor")
                SELECT gen_random_uuid(), t."Id", m."UsuarioId", ROUND(100.0 / n.qtd, 4), ROUND(t."Valor" / n.qtd, 2)
                FROM "Transacoes" t
                JOIN "MembrosFamilia" m ON m."FamiliaId" = t."FamiliaId" AND m."Ativo" AND m."PapelPermissao" <> 3
                JOIN (SELECT "FamiliaId", COUNT(*) AS qtd FROM "MembrosFamilia" WHERE "Ativo" AND "PapelPermissao" <> 3 GROUP BY "FamiliaId") n
                  ON n."FamiliaId" = t."FamiliaId"
                WHERE t."FamiliaId" IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM "RateiosTransacao" r WHERE r."TransacaoId" = t."Id");

                UPDATE "RateiosTransacao" r SET "Valor" = r."Valor" + d.resto
                FROM (
                    SELECT t."Id" AS tid, t."Valor" - SUM(r2."Valor") AS resto,
                           (SELECT r3."Id" FROM "RateiosTransacao" r3 WHERE r3."TransacaoId" = t."Id"
                            ORDER BY (r3."UsuarioId" = t."CriadoPor") DESC, r3."UsuarioId" LIMIT 1) AS rid
                    FROM "Transacoes" t JOIN "RateiosTransacao" r2 ON r2."TransacaoId" = t."Id"
                    GROUP BY t."Id", t."Valor", t."CriadoPor"
                ) d
                WHERE r."Id" = d.rid AND d.resto <> 0;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Valor",
                table: "RateiosTransacao");

            migrationBuilder.DropColumn(
                name: "SaiuEm",
                table: "MembrosFamilia");
        }
    }
}
