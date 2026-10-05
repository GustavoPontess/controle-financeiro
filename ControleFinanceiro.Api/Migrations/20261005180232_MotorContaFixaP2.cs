using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class MotorContaFixaP2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // P2 da revisão do motor de contas fixas (2026-10-05): EditadaPeloUsuario (alterar a conta fixa e o
            // realinhamento preservam a ocorrência editada à mão; as existentes ficam false — não há como saber),
            // RealinhadoEm (conserto ÚNICO de legado: as existentes ficam null e o ExpandirRecorrentesJob realinha
            // cada uma uma vez e marca) e o índice das ocorrências por conta fixa (o gerador lê todas as dela).
            migrationBuilder.AddColumn<bool>(
                name: "EditadaPeloUsuario",
                table: "Transacoes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "RealinhadoEm",
                table: "Assinaturas",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Transacoes_RecorrenteOrigemId_Data",
                table: "Transacoes",
                columns: new[] { "RecorrenteOrigemId", "Data" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Transacoes_RecorrenteOrigemId_Data",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "EditadaPeloUsuario",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "RealinhadoEm",
                table: "Assinaturas");
        }
    }
}
