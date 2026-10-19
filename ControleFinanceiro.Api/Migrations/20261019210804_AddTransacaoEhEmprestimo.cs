using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTransacaoEhEmprestimo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "EhEmprestimo",
                table: "Transacoes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // O que já existe: os lançamentos ligados a um empréstimo (o da criação e os dos pagamentos, de quem
            // devolveu e de quem recebeu) passam a ser dinheiro de empréstimo, fora do resultado do mês.
            migrationBuilder.Sql("""
                UPDATE "Transacoes" SET "EhEmprestimo" = TRUE
                WHERE "Id" IN (SELECT "TransacaoId" FROM "Emprestimos" WHERE "TransacaoId" IS NOT NULL)
                   OR "Id" IN (SELECT "TransacaoComprovanteId" FROM "EmprestimoPagamentoSolicitacoes" WHERE "TransacaoComprovanteId" IS NOT NULL)
                   OR "Id" IN (SELECT "TransacaoRecebimentoId" FROM "EmprestimoPagamentoSolicitacoes" WHERE "TransacaoRecebimentoId" IS NOT NULL);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EhEmprestimo",
                table: "Transacoes");
        }
    }
}
