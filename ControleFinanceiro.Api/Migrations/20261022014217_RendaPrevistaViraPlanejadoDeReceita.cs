using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <summary>
    /// A renda esperada passa a ser o planejado das categorias de receita do Orçamento (2026-10-22). O que cada pessoa
    /// já declarou (fixa + variável, uma linha por mês) vira o planejado da categoria padrão "Renda" nos mesmos meses,
    /// pra nada se perder. A tabela antiga fica (exportação LGPD e quem nunca planejou por categoria).
    /// </summary>
    public partial class RendaPrevistaViraPlanejadoDeReceita : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                INSERT INTO ""Orcamentos"" (""Id"", ""UsuarioId"", ""CategoriaId"", ""Mes"", ""Ano"", ""ValorLimite"", ""PercentualAlerta"", ""CriadoEm"", ""AtualizadoEm"")
                SELECT gen_random_uuid(), r.""UsuarioId"", c.""Id"", r.""Mes"", r.""Ano"", r.""FixaEsperada"" + r.""VariavelEsperada"", 80, now(), now()
                FROM ""RendasPrevistas"" r
                CROSS JOIN (SELECT ""Id"" FROM ""Categorias"" WHERE ""Descricao"" = 'Renda' AND ""UsuarioId"" IS NULL LIMIT 1) c
                WHERE NOT EXISTS (
                    SELECT 1 FROM ""Orcamentos"" o
                    WHERE o.""UsuarioId"" = r.""UsuarioId"" AND o.""CategoriaId"" = c.""Id"" AND o.""Ano"" = r.""Ano"" AND o.""Mes"" = r.""Mes"");");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE FROM ""Orcamentos"" o
                USING ""Categorias"" c
                WHERE o.""CategoriaId"" = c.""Id"" AND c.""Finalidade"" = 2;");
        }
    }
}
