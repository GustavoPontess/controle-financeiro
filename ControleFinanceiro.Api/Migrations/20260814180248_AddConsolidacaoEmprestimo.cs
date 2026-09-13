using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddConsolidacaoEmprestimo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ConsolidadoNoEmprestimoId",
                table: "Emprestimos",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "EmprestimoConsolidacaoPropostas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CredorUsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    DevedorUsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Descricao = table.Column<string>(type: "text", nullable: false),
                    FormaPagamento = table.Column<int>(type: "integer", nullable: false),
                    QuantidadeParcelas = table.Column<int>(type: "integer", nullable: true),
                    PrimeiroVencimento = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    DataVencimento = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    TaxaJuroMensal = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    PercentualMultaAtraso = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    ValorTotalProposto = table.Column<decimal>(type: "numeric", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    RespondidoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    MotivoRecusa = table.Column<string>(type: "text", nullable: true),
                    EmprestimoConsolidadoId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmprestimoConsolidacaoPropostas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EmprestimoConsolidacaoPropostas_Emprestimos_EmprestimoConso~",
                        column: x => x.EmprestimoConsolidadoId,
                        principalTable: "Emprestimos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EmprestimoConsolidacaoPropostas_Usuarios_CredorUsuarioId",
                        column: x => x.CredorUsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EmprestimoConsolidacaoPropostas_Usuarios_DevedorUsuarioId",
                        column: x => x.DevedorUsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EmprestimoConsolidacaoItens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PropostaId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmprestimoOriginalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ValorRestanteSnapshot = table.Column<decimal>(type: "numeric", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmprestimoConsolidacaoItens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EmprestimoConsolidacaoItens_EmprestimoConsolidacaoPropostas~",
                        column: x => x.PropostaId,
                        principalTable: "EmprestimoConsolidacaoPropostas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EmprestimoConsolidacaoItens_Emprestimos_EmprestimoOriginalId",
                        column: x => x.EmprestimoOriginalId,
                        principalTable: "Emprestimos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Emprestimos_ConsolidadoNoEmprestimoId",
                table: "Emprestimos",
                column: "ConsolidadoNoEmprestimoId");

            migrationBuilder.CreateIndex(
                name: "IX_EmprestimoConsolidacaoItens_EmprestimoOriginalId",
                table: "EmprestimoConsolidacaoItens",
                column: "EmprestimoOriginalId");

            migrationBuilder.CreateIndex(
                name: "IX_EmprestimoConsolidacaoItens_PropostaId_EmprestimoOriginalId",
                table: "EmprestimoConsolidacaoItens",
                columns: new[] { "PropostaId", "EmprestimoOriginalId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EmprestimoConsolidacaoPropostas_CredorUsuarioId",
                table: "EmprestimoConsolidacaoPropostas",
                column: "CredorUsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_EmprestimoConsolidacaoPropostas_DevedorUsuarioId",
                table: "EmprestimoConsolidacaoPropostas",
                column: "DevedorUsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_EmprestimoConsolidacaoPropostas_EmprestimoConsolidadoId",
                table: "EmprestimoConsolidacaoPropostas",
                column: "EmprestimoConsolidadoId");

            migrationBuilder.AddForeignKey(
                name: "FK_Emprestimos_Emprestimos_ConsolidadoNoEmprestimoId",
                table: "Emprestimos",
                column: "ConsolidadoNoEmprestimoId",
                principalTable: "Emprestimos",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Emprestimos_Emprestimos_ConsolidadoNoEmprestimoId",
                table: "Emprestimos");

            migrationBuilder.DropTable(
                name: "EmprestimoConsolidacaoItens");

            migrationBuilder.DropTable(
                name: "EmprestimoConsolidacaoPropostas");

            migrationBuilder.DropIndex(
                name: "IX_Emprestimos_ConsolidadoNoEmprestimoId",
                table: "Emprestimos");

            migrationBuilder.DropColumn(
                name: "ConsolidadoNoEmprestimoId",
                table: "Emprestimos");
        }
    }
}
