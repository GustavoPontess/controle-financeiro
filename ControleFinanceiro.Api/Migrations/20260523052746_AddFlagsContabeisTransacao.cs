using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFlagsContabeisTransacao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "EhSaldoInicial",
                table: "Transacoes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "EhTransferencia",
                table: "Transacoes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // ── Backfill dos dados existentes ───────────────────────────────────
            // Pernas de transferência (identificadas pela própria Transferencia).
            migrationBuilder.Sql(@"
                UPDATE ""Transacoes"" SET ""EhTransferencia"" = true
                WHERE ""Id"" IN (
                    SELECT ""TransacaoOrigemId"" FROM ""Transferencias""
                    UNION
                    SELECT ""TransacaoDestinoId"" FROM ""Transferencias""
                );");

            // Saldo de abertura de conta.
            migrationBuilder.Sql(@"
                UPDATE ""Transacoes"" SET ""EhSaldoInicial"" = true
                WHERE ""Descricao"" = 'Saldo Inicial' AND ""CategoriaId"" IS NULL;");

            // Pagamentos de fatura legados (FaturaService antigo usava FaturaId, sem flag):
            // marca a flag, move pra FaturaPagaId e limpa FaturaId (alinha ao design novo).
            migrationBuilder.Sql(@"
                UPDATE ""Transacoes""
                SET ""EhPagamentoFatura"" = true,
                    ""FaturaPagaId"" = ""FaturaId"",
                    ""FaturaId"" = NULL
                WHERE ""FaturaId"" IS NOT NULL
                  AND ""ContaId"" IS NOT NULL
                  AND ""UsadoComoCredito"" = false;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EhSaldoInicial",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "EhTransferencia",
                table: "Transacoes");
        }
    }
}
