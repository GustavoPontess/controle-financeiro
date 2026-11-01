using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class JurosNoPagamentoDeEmprestimo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ValorJuros",
                table: "Transacoes",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ValorJuros",
                table: "EmprestimoPagamentoSolicitacoes",
                type: "numeric",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ValorJuros",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "ValorJuros",
                table: "EmprestimoPagamentoSolicitacoes");
        }
    }
}
