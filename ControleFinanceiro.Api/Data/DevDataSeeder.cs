using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Data;

/// <summary>
/// Popula o banco com dados de exemplo para desenvolvimento — usado para o
/// atlas Playwright (#59) e revisão visual do redesign (#61). Só roda em
/// ambiente Development e só se o usuário dev ainda não existir (idempotente).
///
/// Cria o usuário <c>dev@controle.test</c> (senha <c>Dev@123456</c>) com contas,
/// ~40 transações nos últimos 3 meses e uma família com 2 membros.
/// </summary>
public static class DevDataSeeder
{
    private const string DevEmail = "dev@controle.test";
    private const string DevSenha = "Dev@123456";

    public static async Task SeedAsync(AppDbContext context)
    {
        if (await context.Usuarios.AnyAsync(u => u.Email == DevEmail))
            return;

        var hoje = DateTime.UtcNow.Date;
        var hash = PasswordHasher.HashPassword(DevSenha);

        // ── Usuários ──
        var dev = new Usuario
        {
            Id = Guid.NewGuid(),
            Email = DevEmail,
            Nome = "Gabriel Dev",
            PasswordHash = hash,
            OnboardingConcluido = true,
        };
        var conjuge = new Usuario
        {
            Id = Guid.NewGuid(),
            Email = "conjuge@controle.test",
            Nome = "Marina Dev",
            PasswordHash = hash,
            OnboardingConcluido = true,
        };
        context.Usuarios.AddRange(dev, conjuge);

        // ── Contas ──
        var corrente = new Conta
        {
            Id = Guid.NewGuid(),
            Nome = "Conta Corrente",
            Tipo = TipoConta.ContaCorrente,
            UsuarioIdProprietario = dev.Id,
        };
        var poupanca = new Conta
        {
            Id = Guid.NewGuid(),
            Nome = "Poupança",
            Tipo = TipoConta.ContaPoupanca,
            UsuarioIdProprietario = dev.Id,
        };
        var carteira = new Conta
        {
            Id = Guid.NewGuid(),
            Nome = "Carteira",
            Tipo = TipoConta.Dinheiro,
            IsCarteira = true,
            UsuarioIdProprietario = dev.Id,
        };
        context.Contas.AddRange(corrente, poupanca, carteira);

        // ── Categorias padrão (já seedadas por CategoriaSeeder) ──
        var categorias = await context.Categorias
            .Where(c => c.UsuarioId == null)
            .ToListAsync();
        Guid CatDespesa(string desc) =>
            categorias.First(c => c.Descricao.StartsWith(desc)).Id;
        Guid CatReceita(string desc) =>
            categorias.First(c => c.Descricao.StartsWith(desc)).Id;

        // ── Família ──
        var familia = new Familia
        {
            Id = Guid.NewGuid(),
            Nome = "Casa Dev",
            CriadoPorUsuarioId = dev.Id,
            ModoRateioPadrao = ModoRateio.Igualitario,
        };
        context.Familias.Add(familia);
        context.MembrosFamilia.AddRange(
            new MembroFamilia
            {
                Id = Guid.NewGuid(),
                FamiliaId = familia.Id,
                UsuarioId = dev.Id,
                Papel = "Eu",
                RendaMensal = 7500m,
            },
            new MembroFamilia
            {
                Id = Guid.NewGuid(),
                FamiliaId = familia.Id,
                UsuarioId = conjuge.Id,
                Papel = "Cônjuge",
                RendaMensal = 5200m,
            });

        // ── Transações: últimos 3 meses ──
        var rng = new Random(42); // seed fixo → atlas determinístico
        var transacoes = new List<Transacao>();

        Transacao Nova(string desc, decimal valor, TipoTransacao tipo, Guid? catId,
            Guid contaId, DateTime data, Guid? familiaId = null) => new()
        {
            Id = Guid.NewGuid(),
            Descricao = desc,
            Valor = valor,
            Tipo = tipo,
            CategoriaId = catId,
            ContaId = contaId,
            CriadoPor = dev.Id,
            FamiliaId = familiaId,
            Data = data,
            StatusTransacao = StatusTransacao.Executado,
            Ativo = true,
        };

        (string desc, decimal min, decimal max, string cat)[] despesas =
        {
            ("Supermercado", 180m, 520m, "Supermercado"),
            ("Aluguel", 1800m, 1800m, "Moradia"),
            ("Restaurante", 45m, 160m, "Alimentação"),
            ("Uber", 12m, 48m, "Transporte"),
            ("Farmácia", 25m, 130m, "Saúde"),
            ("Netflix", 39m, 39m, "Serviços"),
            ("Conta de luz", 90m, 210m, "Moradia"),
            ("Internet", 99m, 99m, "Comunicação"),
            ("Academia", 89m, 89m, "Lazer"),
            ("Roupas", 70m, 340m, "Vestuário"),
            ("Curso online", 50m, 200m, "Educação"),
            ("Café", 8m, 25m, "Alimentação"),
        };

        // Saldo inicial de cada conta — mesmo padrão do ContaService.CriarAsync:
        // uma Receita "Saldo Inicial" sem categoria, datada na abertura da conta.
        var abertura = hoje.AddMonths(-3).AddDays(-10);
        transacoes.Add(Nova("Saldo Inicial", 5000m, TipoTransacao.Receita, null, corrente.Id, abertura));
        transacoes.Add(Nova("Saldo Inicial", 8000m, TipoTransacao.Receita, null, poupanca.Id, abertura));
        transacoes.Add(Nova("Saldo Inicial", 200m, TipoTransacao.Receita, null, carteira.Id, abertura));

        for (int m = 0; m < 3; m++)
        {
            var refMes = hoje.AddMonths(-m);

            // Receitas do mês
            transacoes.Add(Nova("Salário", 7500m, TipoTransacao.Receita,
                CatReceita("Salário"), corrente.Id,
                new DateTime(refMes.Year, refMes.Month, 5)));
            transacoes.Add(Nova("Projeto freelance", rng.Next(800, 2200),
                TipoTransacao.Receita, CatReceita("Freelance"), corrente.Id,
                new DateTime(refMes.Year, refMes.Month, 18)));
            // Saque em dinheiro: abastece a carteira para os gastos pequenos.
            transacoes.Add(Nova("Saque em dinheiro", 600m, TipoTransacao.Receita,
                CatReceita("Outros"), carteira.Id,
                new DateTime(refMes.Year, refMes.Month, 3)));
            // Rendimento mensal da poupança.
            transacoes.Add(Nova("Rendimentos", Math.Round(35m + (decimal)rng.NextDouble() * 30, 2),
                TipoTransacao.Receita, CatReceita("Rendimentos"), poupanca.Id,
                new DateTime(refMes.Year, refMes.Month, 1)));

            // Despesas do mês
            foreach (var d in despesas)
            {
                var valor = d.min == d.max
                    ? d.min
                    : Math.Round(d.min + (decimal)rng.NextDouble() * (d.max - d.min), 2);
                var dia = rng.Next(1, 28);
                // Gastos pequenos do dia a dia saem da carteira; o resto da conta corrente.
                var conta = d.desc is "Café" or "Uber" or "Restaurante"
                    ? carteira.Id
                    : corrente.Id;
                // Algumas despesas de casa entram como compartilhadas com a família.
                Guid? fam = d.desc is "Aluguel" or "Conta de luz" or "Supermercado"
                    ? familia.Id
                    : null;
                transacoes.Add(Nova(d.desc, valor, TipoTransacao.Despesa,
                    CatDespesa(d.cat), conta,
                    new DateTime(refMes.Year, refMes.Month, dia), fam));
            }
        }

        context.Transacoes.AddRange(transacoes);
        await context.SaveChangesAsync();
    }
}
