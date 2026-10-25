using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <summary>
    /// As categorias padrão de investimento viram uma por tipo de aplicação (2026-10-22, "cria mais categoria e
    /// subcategoria de investimentos"): Renda fixa, Renda variável, Previdência, Criptomoedas, Investimentos no exterior
    /// e Outros investimentos, cada uma com as fontes (subcategorias) do <c>SubcategoriaSeeder</c>. Em banco que já
    /// tinha a "Investimentos" (da <c>AddCategoriaInvestimento</c>), ela vira "Renda fixa" e as subcategorias dela vão
    /// pro lugar certo com o que aponta pra elas (lançamentos, planejado, contas fixas (tabela "Assinaturas"), parcelamentos). Tudo
    /// idempotente e só em banco que já tem as padrão (banco vazio fica pro seeder). Nada se apaga.
    /// </summary>
    public partial class ReorganizaCategoriasDeInvestimento : Migration
    {
        private const string SoComPadrao = @"EXISTS (SELECT 1 FROM ""Categorias"" WHERE ""UsuarioId"" IS NULL)";

        private static string Categoria(string nome) =>
            $@"(SELECT ""Id"" FROM ""Categorias"" WHERE ""UsuarioId"" IS NULL AND ""Descricao"" = '{nome}' LIMIT 1)";

        /// <summary>Cria a categoria padrão de investimento se ainda não existe.</summary>
        private static string CriarCategoria(string nome) => $@"
            INSERT INTO ""Categorias"" (""Id"", ""Descricao"", ""Finalidade"", ""UsuarioId"")
            SELECT gen_random_uuid(), '{nome}', 4, NULL
            WHERE {SoComPadrao} AND NOT EXISTS (SELECT 1 FROM ""Categorias"" WHERE ""UsuarioId"" IS NULL AND ""Descricao"" = '{nome}');";

        /// <summary>Leva a subcategoria padrão de uma categoria pra outra (e muda o nome), com tudo que aponta pra ela.</summary>
        private static string MoverSub(string nomeAntigo, string categoriaAntiga, string categoriaNova, string nomeNovo) => $@"
            UPDATE ""Subcategorias"" s SET ""CategoriaId"" = {Categoria(categoriaNova)}, ""Nome"" = '{nomeNovo}'
            WHERE s.""UsuarioId"" IS NULL AND s.""Nome"" = '{nomeAntigo}' AND s.""CategoriaId"" = {Categoria(categoriaAntiga)}
              AND {Categoria(categoriaNova)} IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM ""Subcategorias"" x WHERE x.""UsuarioId"" IS NULL AND x.""Nome"" = '{nomeNovo}' AND x.""CategoriaId"" = {Categoria(categoriaNova)});";

        /// <summary>Cria as subcategorias padrão da categoria que ainda faltam.</summary>
        private static string CriarSubs(string categoria, params string[] nomes)
        {
            var valores = string.Join(", ", nomes.Select(n => $"('{n}')"));
            return $@"
            INSERT INTO ""Subcategorias"" (""Id"", ""Nome"", ""CategoriaId"", ""UsuarioId"")
            SELECT gen_random_uuid(), v.nome, c.""Id"", NULL
            FROM ""Categorias"" c
            CROSS JOIN (VALUES {valores}) AS v(nome)
            WHERE c.""UsuarioId"" IS NULL AND c.""Descricao"" = '{categoria}'
              AND NOT EXISTS (SELECT 1 FROM ""Subcategorias"" s WHERE s.""CategoriaId"" = c.""Id"" AND s.""Nome"" = v.nome);";
        }

        /// <summary>O que aponta pra uma subcategoria padrão de investimento passa a apontar pra categoria dela.</summary>
        private static string Reapontar(string tabela) => $@"
            UPDATE ""{tabela}"" t SET ""CategoriaId"" = s.""CategoriaId""
            FROM ""Subcategorias"" s
            JOIN ""Categorias"" c ON c.""Id"" = s.""CategoriaId"" AND c.""UsuarioId"" IS NULL AND c.""Finalidade"" = 4
            WHERE t.""SubcategoriaId"" = s.""Id"" AND s.""UsuarioId"" IS NULL AND t.""CategoriaId"" <> s.""CategoriaId"";";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A "Investimentos" genérica vira "Renda fixa" (fica com Poupança, CDB e Tesouro).
            migrationBuilder.Sql($@"
                UPDATE ""Categorias"" SET ""Descricao"" = 'Renda fixa'
                WHERE ""UsuarioId"" IS NULL AND ""Descricao"" = 'Investimentos' AND ""Finalidade"" = 4
                  AND NOT EXISTS (SELECT 1 FROM ""Categorias"" WHERE ""UsuarioId"" IS NULL AND ""Descricao"" = 'Renda fixa');");
            migrationBuilder.Sql(CriarCategoria("Renda fixa"));
            migrationBuilder.Sql(CriarCategoria("Renda variável"));
            migrationBuilder.Sql(CriarCategoria("Previdência"));
            migrationBuilder.Sql(CriarCategoria("Criptomoedas"));
            migrationBuilder.Sql(CriarCategoria("Investimentos no exterior"));
            migrationBuilder.Sql(CriarCategoria("Outros investimentos"));

            migrationBuilder.Sql(MoverSub("CDB e renda fixa", "Renda fixa", "Renda fixa", "CDB"));
            migrationBuilder.Sql(MoverSub("Ações e fundos", "Renda fixa", "Renda variável", "Ações"));
            migrationBuilder.Sql(MoverSub("Previdência privada", "Renda fixa", "Previdência", "Previdência privada"));
            migrationBuilder.Sql(MoverSub("Criptomoedas", "Renda fixa", "Criptomoedas", "Outras moedas"));
            foreach (var tabela in new[] { "Transacoes", "Orcamentos", "Assinaturas", "Parcelamentos" })
                migrationBuilder.Sql(Reapontar(tabela));

            migrationBuilder.Sql(CriarSubs("Renda fixa", "Poupança", "CDB", "LCI e LCA", "Tesouro Direto", "Debêntures", "CRI e CRA", "Fundos de renda fixa"));
            migrationBuilder.Sql(CriarSubs("Renda variável", "Ações", "Fundos imobiliários", "ETFs", "BDRs", "Fundos de ações", "Fundos multimercado"));
            migrationBuilder.Sql(CriarSubs("Previdência", "Previdência privada", "Previdência da empresa"));
            migrationBuilder.Sql(CriarSubs("Criptomoedas", "Bitcoin", "Ethereum", "Stablecoins", "Outras moedas"));
            migrationBuilder.Sql(CriarSubs("Investimentos no exterior", "Ações no exterior", "ETFs no exterior", "Fundos no exterior", "Conta em moeda estrangeira"));
            migrationBuilder.Sql(CriarSubs("Outros investimentos", "Imóveis", "Consórcio", "Ouro e metais", "Negócio próprio", "Crowdfunding e P2P"));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Só dado: as categorias e subcategorias ficam (podem ter lançamento apontando). Nada a desfazer.
        }
    }
}
