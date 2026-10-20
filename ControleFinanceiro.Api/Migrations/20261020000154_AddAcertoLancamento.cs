using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAcertoLancamento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "EhAcerto",
                table: "Transacoes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "ConfirmadoEm",
                table: "AcertosContas",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "Data",
                table: "AcertosContas",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TransacaoEntradaId",
                table: "AcertosContas",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TransacaoSaidaId",
                table: "AcertosContas",
                type: "uuid",
                nullable: true);

            // AcertoContas.Versao mapeia pra coluna de SISTEMA xmin (já existe em toda tabela; o Npgsql pula o
            // AddColumn que o scaffold gera). Removido pra deixar explícito, como na AddRegistroIdempotenciaEConcorrenciaFatura.

            migrationBuilder.CreateIndex(
                name: "IX_AcertosContas_TransacaoEntradaId",
                table: "AcertosContas",
                column: "TransacaoEntradaId");

            migrationBuilder.CreateIndex(
                name: "IX_AcertosContas_TransacaoSaidaId",
                table: "AcertosContas",
                column: "TransacaoSaidaId");

            migrationBuilder.AddForeignKey(
                name: "FK_AcertosContas_Transacoes_TransacaoEntradaId",
                table: "AcertosContas",
                column: "TransacaoEntradaId",
                principalTable: "Transacoes",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_AcertosContas_Transacoes_TransacaoSaidaId",
                table: "AcertosContas",
                column: "TransacaoSaidaId",
                principalTable: "Transacoes",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            // Os acertos de antes valiam na hora (era só o registro): ficam confirmados, no dia em que foram registrados.
            migrationBuilder.Sql(@"
UPDATE ""AcertosContas"" SET ""ConfirmadoEm"" = ""CriadoEm"", ""Data"" = ""CriadoEm""::date
WHERE ""ConfirmadoEm"" IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AcertosContas_Transacoes_TransacaoEntradaId",
                table: "AcertosContas");

            migrationBuilder.DropForeignKey(
                name: "FK_AcertosContas_Transacoes_TransacaoSaidaId",
                table: "AcertosContas");

            migrationBuilder.DropIndex(
                name: "IX_AcertosContas_TransacaoEntradaId",
                table: "AcertosContas");

            migrationBuilder.DropIndex(
                name: "IX_AcertosContas_TransacaoSaidaId",
                table: "AcertosContas");

            migrationBuilder.DropColumn(
                name: "EhAcerto",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "ConfirmadoEm",
                table: "AcertosContas");

            migrationBuilder.DropColumn(
                name: "Data",
                table: "AcertosContas");

            migrationBuilder.DropColumn(
                name: "TransacaoEntradaId",
                table: "AcertosContas");

            migrationBuilder.DropColumn(
                name: "TransacaoSaidaId",
                table: "AcertosContas");
        }
    }
}
