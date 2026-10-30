using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <summary>
    /// Logo dos bancos passa a vir do próprio app (`/bancos/{código}.png`), não mais do favicon do Google
    /// (bloqueado pela CSP de produção e quebrava o print da tela). Só troca o endereço dos bancos que tinham o do
    /// Google; os arquivos são do front. Rollback: a versão anterior não tem os arquivos e cai nas iniciais.
    /// </summary>
    public partial class LogosDosBancosLocais : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "Bancos"
                SET "LogoUrl" = '/bancos/' || "CodigoBanco" || '.png'
                WHERE "LogoUrl" LIKE 'https://www.google.com/s2/favicons%' AND "CodigoBanco" IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Sem volta: o domínio de cada banco não fica no banco de dados. A versão anterior mostra as iniciais.
        }
    }
}
