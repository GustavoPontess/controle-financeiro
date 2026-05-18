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
/// Cria (senha de todos: <c>Dev@123456</c>):
/// - <c>dev@controle.test</c> — 3 contas, ~40 transações e uma família (casal)
/// - <c>conjuge@controle.test</c> — 2º membro da família do dev
/// - <c>solo@controle.test</c> — usuário sozinho: 2 contas e transações, sem família
/// </summary>
public static class DevDataSeeder
{
    private const string DevEmail = "dev@controle.test";
    private const string Senha = "Dev@123456";

    private static readonly (string desc, decimal min, decimal max, string cat)[] Despesas =
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

    public static async Task SeedAsync(AppDbContext context)
    {
        if (await context.Usuarios.AnyAsync(u => u.Email == DevEmail))
            return;

        var hoje = DateTime.UtcNow.Date;
        var hash = PasswordHasher.HashPassword(Senha);

        // Categorias padrão (já seedadas por CategoriaSeeder).
        var categorias = await context.Categorias
            .Where(c => c.UsuarioId == null)
            .ToListAsync();
        Guid Cat(string desc) => categorias.First(c => c.Descricao.StartsWith(desc)).Id;

        var transacoes = new List<Transacao>();

        Usuario NovoUsuario(string email, string nome) => new()
        {
            Id = Guid.NewGuid(),
            Email = email,
            Nome = nome,
            PasswordHash = hash,
            OnboardingConcluido = true,
        };

        Conta NovaConta(string nome, TipoConta tipo, Guid dono, bool carteira = false) => new()
        {
            Id = Guid.NewGuid(),
            Nome = nome,
            Tipo = tipo,
            IsCarteira = carteira,
            UsuarioIdProprietario = dono,
        };

        Transacao Nova(Guid criadoPor, string desc, decimal valor, TipoTransacao tipo,
            Guid? catId, Guid contaId, DateTime data, Guid? familiaId = null) => new()
        {
            Id = Guid.NewGuid(),
            Descricao = desc,
            Valor = valor,
            Tipo = tipo,
            CategoriaId = catId,
            ContaId = contaId,
            CriadoPor = criadoPor,
            FamiliaId = familiaId,
            Data = data,
            StatusTransacao = StatusTransacao.Executado,
            Ativo = true,
        };

        // Gera saldo inicial + 3 meses de movimentação para um usuário.
        void SeedFinancas(Usuario dono, Conta corrente, Conta carteira, Conta? poupanca,
            Familia? familia, decimal salario, int rngSeed)
        {
            var rng = new Random(rngSeed); // seed fixo → atlas determinístico
            var abertura = hoje.AddMonths(-3).AddDays(-10);

            // Saldo inicial — mesmo padrão do ContaService.CriarAsync: Receita sem categoria.
            transacoes.Add(Nova(dono.Id, "Saldo Inicial", 5000m, TipoTransacao.Receita, null, corrente.Id, abertura));
            transacoes.Add(Nova(dono.Id, "Saldo Inicial", 200m, TipoTransacao.Receita, null, carteira.Id, abertura));
            if (poupanca != null)
                transacoes.Add(Nova(dono.Id, "Saldo Inicial", 8000m, TipoTransacao.Receita, null, poupanca.Id, abertura));

            for (int m = 0; m < 3; m++)
            {
                var refMes = hoje.AddMonths(-m);

                transacoes.Add(Nova(dono.Id, "Salário", salario, TipoTransacao.Receita,
                    Cat("Salário"), corrente.Id, new DateTime(refMes.Year, refMes.Month, 5)));
                transacoes.Add(Nova(dono.Id, "Projeto freelance", rng.Next(800, 2200),
                    TipoTransacao.Receita, Cat("Freelance"), corrente.Id,
                    new DateTime(refMes.Year, refMes.Month, 18)));
                // Saque em dinheiro: abastece a carteira para os gastos pequenos.
                transacoes.Add(Nova(dono.Id, "Saque em dinheiro", 600m, TipoTransacao.Receita,
                    Cat("Outros"), carteira.Id, new DateTime(refMes.Year, refMes.Month, 3)));
                // Rendimento mensal da poupança (quando há poupança).
                if (poupanca != null)
                    transacoes.Add(Nova(dono.Id, "Rendimentos",
                        Math.Round(35m + (decimal)rng.NextDouble() * 30, 2),
                        TipoTransacao.Receita, Cat("Rendimentos"), poupanca.Id,
                        new DateTime(refMes.Year, refMes.Month, 1)));

                foreach (var d in Despesas)
                {
                    var valor = d.min == d.max
                        ? d.min
                        : Math.Round(d.min + (decimal)rng.NextDouble() * (d.max - d.min), 2);
                    var dia = rng.Next(1, 28);
                    // Gastos pequenos do dia a dia saem da carteira; o resto da conta corrente.
                    var contaId = d.desc is "Café" or "Uber" or "Restaurante"
                        ? carteira.Id
                        : corrente.Id;
                    // Algumas despesas de casa entram como compartilhadas com a família.
                    Guid? fam = familia != null && d.desc is "Aluguel" or "Conta de luz" or "Supermercado"
                        ? familia.Id
                        : null;
                    transacoes.Add(Nova(dono.Id, d.desc, valor, TipoTransacao.Despesa,
                        Cat(d.cat), contaId, new DateTime(refMes.Year, refMes.Month, dia), fam));
                }
            }
        }

        // ── Usuários ──
        var dev = NovoUsuario(DevEmail, "Gabriel Dev");
        var conjuge = NovoUsuario("conjuge@controle.test", "Marina Dev");
        var solo = NovoUsuario("solo@controle.test", "Rafael Solo");
        context.Usuarios.AddRange(dev, conjuge, solo);

        // ── Contas ──
        var devCorrente = NovaConta("Conta Corrente", TipoConta.ContaCorrente, dev.Id);
        var devPoupanca = NovaConta("Poupança", TipoConta.ContaPoupanca, dev.Id);
        var devCarteira = NovaConta("Carteira", TipoConta.Dinheiro, dev.Id, carteira: true);
        var soloCorrente = NovaConta("Conta Corrente", TipoConta.ContaCorrente, solo.Id);
        var soloCarteira = NovaConta("Carteira", TipoConta.Dinheiro, solo.Id, carteira: true);
        context.Contas.AddRange(devCorrente, devPoupanca, devCarteira, soloCorrente, soloCarteira);

        // ── Família do dev (casal) ──
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

        // ── Movimentação ──
        SeedFinancas(dev, devCorrente, devCarteira, devPoupanca, familia, salario: 7500m, rngSeed: 42);
        SeedFinancas(solo, soloCorrente, soloCarteira, poupanca: null, familia: null, salario: 4200m, rngSeed: 7);

        context.Transacoes.AddRange(transacoes);
        await context.SaveChangesAsync();
    }
}
