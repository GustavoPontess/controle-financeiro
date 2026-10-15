using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <summary>
    /// Conserto de dado (2026-10-15): o cadastro criava a carteira de todo usuário com Tipo = ContaPoupanca (2);
    /// a carteira é dinheiro em mãos (4). Só mexe na conta marcada IsCarteira. Sem volta — o valor antigo era errado.
    /// </summary>
    public partial class CarteiraTipoDinheiro : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""UPDATE "Contas" SET "Tipo" = 4 WHERE "IsCarteira" AND "Tipo" <> 4;""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
