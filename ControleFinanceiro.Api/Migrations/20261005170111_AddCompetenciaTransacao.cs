using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCompetenciaTransacao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Recorrente.Versao (concorrência) é a coluna de SISTEMA xmin do Postgres — o scaffold gerava
            // AddColumn/DropColumn("xmin") (o Npgsql pula no SQL); removidos como na migration da Fatura.
            migrationBuilder.AddColumn<string>(
                name: "Competencia",
                table: "Transacoes",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            // Preenche as ocorrências VIVAS que já existem com a MESMA conta do AgendaRecorrente.Competencia
            // (Frequencia: 1 = semanal, blocos de 7 dias desde o início; 3 = anual; 2 = mensal). Se o motor
            // antigo deixou DUAS vivas no mesmo período (cobrança dobrada de antes), só uma ganha a competência —
            // a efetivada, depois a mais antiga —, senão o índice único abaixo não seria criado; a outra fica
            // sem (o gerador ainda a conta pela data) e nada de dinheiro muda aqui.
            migrationBuilder.Sql("""
                WITH calc AS (
                    SELECT t."Id", t."RecorrenteOrigemId", t."StatusTransacao", t."Data", t."CriadoEm",
                           CASE r."Frequencia"
                               WHEN 1 THEN 'S' || ((t."Data" - r."DataInicio"::date) / 7)::text
                               WHEN 3 THEN 'A' || to_char(t."Data", 'YYYY')
                               ELSE 'M' || to_char(t."Data", 'YYYY-MM')
                           END AS comp
                    FROM "Transacoes" t
                    JOIN "Assinaturas" r ON r."Id" = t."RecorrenteOrigemId"
                    WHERE t."Ativo"
                ), escolhida AS (
                    SELECT "Id", comp,
                           ROW_NUMBER() OVER (PARTITION BY "RecorrenteOrigemId", comp
                                              ORDER BY ("StatusTransacao" = 1) DESC, "Data", "CriadoEm") AS rn
                    FROM calc
                )
                UPDATE "Transacoes" t SET "Competencia" = e.comp
                FROM escolhida e
                WHERE t."Id" = e."Id" AND e.rn = 1;
                """);

            migrationBuilder.CreateIndex(
                name: "UX_Transacoes_Recorrente_Competencia",
                table: "Transacoes",
                columns: new[] { "RecorrenteOrigemId", "Competencia" },
                unique: true,
                filter: "\"Ativo\" AND \"Competencia\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UX_Transacoes_Recorrente_Competencia",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "Competencia",
                table: "Transacoes");
        }
    }
}
