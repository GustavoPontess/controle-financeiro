using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddParcelamentoEmprestimo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "FormaPagamento",
                table: "Emprestimos",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "PercentualMultaAtraso",
                table: "Emprestimos",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TaxaJuroMensal",
                table: "Emprestimos",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ParcelaId",
                table: "EmprestimoPagamentoSolicitacoes",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "EmprestimoParcelas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmprestimoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Numero = table.Column<int>(type: "integer", nullable: false),
                    QuantidadeTotal = table.Column<int>(type: "integer", nullable: false),
                    DataVencimento = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Valor = table.Column<decimal>(type: "numeric", nullable: false),
                    ValorComJuros = table.Column<decimal>(type: "numeric", nullable: true),
                    ValorComMulta = table.Column<decimal>(type: "numeric", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    SolicitacaoPagamentoId = table.Column<Guid>(type: "uuid", nullable: true),
                    CriadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmprestimoParcelas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EmprestimoParcelas_EmprestimoPagamentoSolicitacoes_Solicita~",
                        column: x => x.SolicitacaoPagamentoId,
                        principalTable: "EmprestimoPagamentoSolicitacoes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_EmprestimoParcelas_Emprestimos_EmprestimoId",
                        column: x => x.EmprestimoId,
                        principalTable: "Emprestimos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EmprestimoPagamentoSolicitacoes_ParcelaId",
                table: "EmprestimoPagamentoSolicitacoes",
                column: "ParcelaId");

            migrationBuilder.CreateIndex(
                name: "IX_EmprestimoParcelas_EmprestimoId_Numero",
                table: "EmprestimoParcelas",
                columns: new[] { "EmprestimoId", "Numero" });

            migrationBuilder.CreateIndex(
                name: "IX_EmprestimoParcelas_SolicitacaoPagamentoId",
                table: "EmprestimoParcelas",
                column: "SolicitacaoPagamentoId");

            migrationBuilder.AddForeignKey(
                name: "FK_EmprestimoPagamentoSolicitacoes_EmprestimoParcelas_ParcelaId",
                table: "EmprestimoPagamentoSolicitacoes",
                column: "ParcelaId",
                principalTable: "EmprestimoParcelas",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EmprestimoPagamentoSolicitacoes_EmprestimoParcelas_ParcelaId",
                table: "EmprestimoPagamentoSolicitacoes");

            migrationBuilder.DropTable(
                name: "EmprestimoParcelas");

            migrationBuilder.DropIndex(
                name: "IX_EmprestimoPagamentoSolicitacoes_ParcelaId",
                table: "EmprestimoPagamentoSolicitacoes");

            migrationBuilder.DropColumn(
                name: "FormaPagamento",
                table: "Emprestimos");

            migrationBuilder.DropColumn(
                name: "PercentualMultaAtraso",
                table: "Emprestimos");

            migrationBuilder.DropColumn(
                name: "TaxaJuroMensal",
                table: "Emprestimos");

            migrationBuilder.DropColumn(
                name: "ParcelaId",
                table: "EmprestimoPagamentoSolicitacoes");
        }
    }
}
