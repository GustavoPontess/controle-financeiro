using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class UpdateWalletTypeToPoupanca : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Update existing wallets from Dinheiro (4) to ContaPoupanca (2)
            migrationBuilder.Sql("UPDATE Contas SET Tipo = 2 WHERE IsCarteira = 1 AND Tipo = 4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Revert wallets from ContaPoupanca (2) to Dinheiro (4)
            migrationBuilder.Sql("UPDATE Contas SET Tipo = 4 WHERE IsCarteira = 1 AND Tipo = 2");
        }
    }
}
