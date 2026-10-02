using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class SepararDataHoraTransacao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Separa o timestamp único de Transacao.Data em date (Data) + time (Hora) — mata o bug de fuso
            // (timestamp saía sem 'Z' no JSON e o front deslocava +3h / rolava o dia).

            // 1. Nova coluna Hora (time, anulável).
            migrationBuilder.AddColumn<TimeOnly>(
                name: "Hora",
                table: "Transacoes",
                type: "time without time zone",
                nullable: true);

            // 2. Preserva a hora do timestamp ANTES de reduzir Data a date. Meia-noite (00:00:00) = sem hora
            //    real (recorrente, saldo inicial, importação, parcela, ajuste) → Hora null.
            migrationBuilder.Sql(
                "UPDATE \"Transacoes\" SET \"Hora\" = CASE WHEN \"Data\"::time = TIME '00:00:00' THEN NULL ELSE \"Data\"::time END;");

            // 3. Reduz Data a date (USING explícito pro cast timestamp→date).
            migrationBuilder.Sql(
                "ALTER TABLE \"Transacoes\" ALTER COLUMN \"Data\" TYPE date USING \"Data\"::date;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Recompõe o timestamp a partir de date + hora (hora null → meia-noite).
            migrationBuilder.Sql(
                "ALTER TABLE \"Transacoes\" ALTER COLUMN \"Data\" TYPE timestamp without time zone " +
                "USING (\"Data\" + COALESCE(\"Hora\", TIME '00:00:00'));");

            migrationBuilder.DropColumn(
                name: "Hora",
                table: "Transacoes");
        }
    }
}
