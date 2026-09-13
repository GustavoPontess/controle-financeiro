using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPagamentoAprovacaoEmprestimo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EmprestimoPagamentoSolicitacoes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmprestimoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Valor = table.Column<decimal>(type: "numeric", nullable: false),
                    TransacaoComprovanteId = table.Column<Guid>(type: "uuid", nullable: false),
                    SolicitadoPor = table.Column<Guid>(type: "uuid", nullable: false),
                    StatusAprovacao = table.Column<int>(type: "integer", nullable: false),
                    AprovadoPorUsuarioId = table.Column<Guid>(type: "uuid", nullable: true),
                    AprovadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    TransacaoRecebimentoId = table.Column<Guid>(type: "uuid", nullable: true),
                    CriadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmprestimoPagamentoSolicitacoes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EmprestimoPagamentoSolicitacoes_Emprestimos_EmprestimoId",
                        column: x => x.EmprestimoId,
                        principalTable: "Emprestimos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EmprestimoPagamentoSolicitacoes_Transacoes_TransacaoComprov~",
                        column: x => x.TransacaoComprovanteId,
                        principalTable: "Transacoes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EmprestimoPagamentoSolicitacoes_Transacoes_TransacaoRecebim~",
                        column: x => x.TransacaoRecebimentoId,
                        principalTable: "Transacoes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EmprestimoPagamentoSolicitacoes_EmprestimoId",
                table: "EmprestimoPagamentoSolicitacoes",
                column: "EmprestimoId");

            migrationBuilder.CreateIndex(
                name: "IX_EmprestimoPagamentoSolicitacoes_TransacaoComprovanteId",
                table: "EmprestimoPagamentoSolicitacoes",
                column: "TransacaoComprovanteId");

            migrationBuilder.CreateIndex(
                name: "IX_EmprestimoPagamentoSolicitacoes_TransacaoRecebimentoId",
                table: "EmprestimoPagamentoSolicitacoes",
                column: "TransacaoRecebimentoId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmprestimoPagamentoSolicitacoes");
        }
    }
}
