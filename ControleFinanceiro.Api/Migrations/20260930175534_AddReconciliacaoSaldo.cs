using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddReconciliacaoSaldo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "EhAjusteReconciliacao",
                table: "Transacoes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "ReconciliacoesSaldo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ContaId = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    DataHora = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    SaldoDeclarado = table.Column<decimal>(type: "numeric", nullable: false),
                    SaldoCalculado = table.Column<decimal>(type: "numeric", nullable: false),
                    Diferenca = table.Column<decimal>(type: "numeric", nullable: false),
                    Tipo = table.Column<int>(type: "integer", nullable: false),
                    AjusteTransacaoId = table.Column<Guid>(type: "uuid", nullable: true),
                    Observacao = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    CriadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Ativo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReconciliacoesSaldo", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReconciliacoesSaldo_Contas_ContaId",
                        column: x => x.ContaId,
                        principalTable: "Contas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ReconciliacoesSaldo_Transacoes_AjusteTransacaoId",
                        column: x => x.AjusteTransacaoId,
                        principalTable: "Transacoes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ReconciliacoesSaldo_AjusteTransacaoId",
                table: "ReconciliacoesSaldo",
                column: "AjusteTransacaoId");

            migrationBuilder.CreateIndex(
                name: "IX_ReconciliacoesSaldo_ContaId",
                table: "ReconciliacoesSaldo",
                column: "ContaId");

            migrationBuilder.CreateIndex(
                name: "IX_ReconciliacoesSaldo_UsuarioId_ContaId_DataHora",
                table: "ReconciliacoesSaldo",
                columns: new[] { "UsuarioId", "ContaId", "DataHora" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ReconciliacoesSaldo");

            migrationBuilder.DropColumn(
                name: "EhAjusteReconciliacao",
                table: "Transacoes");
        }
    }
}
