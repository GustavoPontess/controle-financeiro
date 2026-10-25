using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <summary>
    /// Tipo de categoria novo, Investimento (2026-10-22, pedido do Gustavo): a marca no lançamento (<c>EhInvestimento</c>,
    /// fora do resultado) e a categoria padrão "Investimentos" com as subcategorias, nos bancos que já têm as padrão.
    /// Banco vazio não ganha nada aqui: o <c>CategoriaSeeder</c> cria todas juntas (se esta criasse uma padrão antes,
    /// o seeder acharia que já tinha e pularia as outras).
    /// </summary>
    public partial class AddCategoriaInvestimento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "EhInvestimento",
                table: "Transacoes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql(@"
                INSERT INTO ""Categorias"" (""Id"", ""Descricao"", ""Finalidade"", ""UsuarioId"")
                SELECT gen_random_uuid(), 'Investimentos', 4, NULL
                WHERE EXISTS (SELECT 1 FROM ""Categorias"" WHERE ""UsuarioId"" IS NULL)
                  AND NOT EXISTS (SELECT 1 FROM ""Categorias"" WHERE ""UsuarioId"" IS NULL AND ""Descricao"" = 'Investimentos');");
            migrationBuilder.Sql(@"
                INSERT INTO ""Subcategorias"" (""Id"", ""Nome"", ""CategoriaId"", ""UsuarioId"")
                SELECT gen_random_uuid(), v.nome, c.""Id"", NULL
                FROM ""Categorias"" c
                CROSS JOIN (VALUES ('Poupança'), ('CDB e renda fixa'), ('Tesouro Direto'), ('Ações e fundos'),
                                   ('Previdência privada'), ('Criptomoedas')) AS v(nome)
                WHERE c.""UsuarioId"" IS NULL AND c.""Descricao"" = 'Investimentos'
                  AND NOT EXISTS (SELECT 1 FROM ""Subcategorias"" s WHERE s.""CategoriaId"" = c.""Id"" AND s.""Nome"" = v.nome);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // A categoria padrão fica (pode ter lançamento apontando); só o tipo dela volta pra "As duas".
            migrationBuilder.Sql(@"UPDATE ""Categorias"" SET ""Finalidade"" = 3 WHERE ""Finalidade"" = 4;");
            migrationBuilder.DropColumn(
                name: "EhInvestimento",
                table: "Transacoes");
        }
    }
}
