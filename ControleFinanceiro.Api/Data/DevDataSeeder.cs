using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using ControleFinanceiro.Api.Services;
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
        ("Supermercado", 180m, 520m, "Alimentação"),
        ("Aluguel", 1800m, 1800m, "Moradia"),
        ("Restaurante", 45m, 160m, "Alimentação"),
        ("Uber", 12m, 48m, "Transporte"),
        ("Farmácia", 25m, 130m, "Saúde"),
        ("Netflix", 39m, 39m, "Serviços digitais"),
        ("Conta de luz", 90m, 210m, "Moradia"),
        ("Internet", 99m, 99m, "Moradia"),
        ("Academia", 89m, 89m, "Lazer"),
        ("Roupas", 70m, 340m, "Compras"),
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

        Conta NovaConta(string nome, TipoConta tipo, Guid dono, bool carteira = false, Guid? bancoId = null) => new()
        {
            Id = Guid.NewGuid(),
            Nome = nome,
            Tipo = tipo,
            IsCarteira = carteira,
            BancoId = bancoId,
            UsuarioIdProprietario = dono,
        };

        Transacao Nova(Guid criadoPor, string desc, decimal valor, TipoTransacao tipo,
            Guid? catId, Guid contaId, DateTime data, Guid? familiaId = null,
            MeioPagamento? meio = null) => new()
        {
            Id = Guid.NewGuid(),
            Descricao = desc,
            Valor = valor,
            Tipo = tipo,
            CategoriaId = catId,
            ContaId = contaId,
            CriadoPor = criadoPor,
            FamiliaId = familiaId,
            MeioPagamento = meio,
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
                    Cat("Renda"), corrente.Id, new DateTime(refMes.Year, refMes.Month, 5),
                    meio: MeioPagamento.Ted));
                transacoes.Add(Nova(dono.Id, "Projeto freelance", rng.Next(800, 2200),
                    TipoTransacao.Receita, Cat("Renda"), corrente.Id,
                    new DateTime(refMes.Year, refMes.Month, 18), meio: MeioPagamento.Pix));
                // Saque em dinheiro: abastece a carteira para os gastos pequenos.
                transacoes.Add(Nova(dono.Id, "Saque em dinheiro", 600m, TipoTransacao.Receita,
                    Cat("Outros"), carteira.Id, new DateTime(refMes.Year, refMes.Month, 3),
                    meio: MeioPagamento.Dinheiro));
                // Rendimento mensal da poupança (quando há poupança).
                if (poupanca != null)
                    transacoes.Add(Nova(dono.Id, "Rendimentos",
                        Math.Round(35m + (decimal)rng.NextDouble() * 30, 2),
                        TipoTransacao.Receita, Cat("Renda"), poupanca.Id,
                        new DateTime(refMes.Year, refMes.Month, 1)));

                foreach (var d in Despesas)
                {
                    var valor = d.min == d.max
                        ? d.min
                        : Math.Round(d.min + (decimal)rng.NextDouble() * (d.max - d.min), 2);
                    var dia = rng.Next(1, 28);
                    // Gastos pequenos do dia a dia saem da carteira; o resto da conta corrente.
                    var naCarteira = d.desc is "Café" or "Uber" or "Restaurante";
                    var contaId = naCarteira ? carteira.Id : corrente.Id;
                    // Meio de pagamento: carteira → dinheiro; contas fixas → boleto; resto → pix/débito.
                    var meio = naCarteira ? MeioPagamento.Dinheiro
                        : d.desc is "Aluguel" or "Conta de luz" or "Internet" or "Netflix" or "Academia"
                            ? MeioPagamento.Boleto
                            : (rng.Next(2) == 0 ? MeioPagamento.Pix : MeioPagamento.Debito);
                    // Algumas despesas de casa entram como compartilhadas com a família.
                    Guid? fam = familia != null && d.desc is "Aluguel" or "Conta de luz" or "Supermercado"
                        ? familia.Id
                        : null;
                    transacoes.Add(Nova(dono.Id, d.desc, valor, TipoTransacao.Despesa,
                        Cat(d.cat), contaId, new DateTime(refMes.Year, refMes.Month, dia), fam, meio));
                }
            }
        }

        // ── Usuários ──
        var dev = NovoUsuario(DevEmail, "Gabriel Dev");
        var conjuge = NovoUsuario("conjuge@controle.test", "Marina Dev");
        var solo = NovoUsuario("solo@controle.test", "Rafael Solo");
        context.Usuarios.AddRange(dev, conjuge, solo);

        // ── Bancos pra vincular (do BancoSeeder; null se faltar/offline) ──
        var bancos = await context.Bancos.ToListAsync();
        Banco? BancoPorCodigo(string codigo) => bancos.FirstOrDefault(b => b.CodigoBanco == codigo);
        // Garante logo no banco vinculado mesmo se foi seedado antes do mapa.
        Guid? Vincular(string codigo)
        {
            var b = BancoPorCodigo(codigo);
            if (b == null) return null;
            if (string.IsNullOrEmpty(b.LogoUrl)) b.LogoUrl = BancoSeeder.LogoForCodigo(codigo);
            if (string.IsNullOrEmpty(b.Cor)) b.Cor = BancoSeeder.CorForCodigo(codigo);
            return b.Id;
        }

        // ── Contas (corrente/poupança vinculadas a bancos reais; carteira não) ──
        var devCorrente = NovaConta("Conta Corrente", TipoConta.ContaCorrente, dev.Id, bancoId: Vincular("260")); // Nubank
        var devPoupanca = NovaConta("Poupança", TipoConta.ContaPoupanca, dev.Id, bancoId: Vincular("341")); // Itaú
        var devCarteira = NovaConta("Carteira", TipoConta.Dinheiro, dev.Id, carteira: true);
        var soloCorrente = NovaConta("Conta Corrente", TipoConta.ContaCorrente, solo.Id, bancoId: Vincular("077")); // Inter
        var soloCarteira = NovaConta("Carteira", TipoConta.Dinheiro, solo.Id, carteira: true);
        context.Contas.AddRange(devCorrente, devPoupanca, devCarteira, soloCorrente, soloCarteira);

        // ── Cartão de crédito do dev (pra testar crédito + parcelamento) ──
        var devCartao = new CartaoCredito
        {
            Id = Guid.NewGuid(),
            Nome = "Nubank",
            UltimosDigitos = "4218",
            Bandeira = BandeiraCartao.Mastercard,
            TemCredito = true,
            LimiteTotal = 5000m,
            DiaFechamento = 20,
            DiaVencimento = 28,
            BancoId = Vincular("260"),       // emissor: Nubank
            ContaId = devCorrente.Id,        // conta que paga a fatura (padrão; opcional no modelo)
            CriadoPor = dev.Id,
            Ativo = true,
        };
        context.CartoesCredito.Add(devCartao);

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

        // Compras no crédito do dev → gera faturas reais (atual aberta + passadas pagas).
        var faturas = new List<Fatura>();
        void SeedCartaoFaturas(Usuario dono, CartaoCredito cartao, Conta contaPaga)
        {
            var rng = new Random(99); // seed fixo → atlas determinístico
            var compras = new (string desc, decimal min, decimal max, string cat)[]
            {
                ("Mercado Livre", 60m, 380m, "Compras"),
                ("iFood", 28m, 110m, "Alimentação"),
                ("Posto Ipiranga", 90m, 250m, "Transporte"),
                ("Amazon", 45m, 320m, "Compras"),
                ("Spotify", 21m, 21m, "Serviços digitais"),
                ("Farmácia", 20m, 90m, "Saúde"),
            };

            var porFechamento = new Dictionary<DateTime, Fatura>();
            Fatura FaturaDe(DateTime data)
            {
                var (inicio, fechamento) = FaturaService.CalcularPeriodo(data.Date, cartao.DiaFechamento);
                if (!porFechamento.TryGetValue(fechamento, out var f))
                {
                    f = new Fatura
                    {
                        Id = Guid.NewGuid(),
                        CartaoCreditoId = cartao.Id,
                        DataInicio = inicio,
                        DataFechamento = fechamento,
                        DataVencimento = FaturaService.CalcularVencimento(fechamento, cartao.DiaVencimento),
                        EstadoCiclo = EstadoCicloFatura.Aberta,
                        EstadoPagamento = EstadoPagamentoFatura.NaoPago,
                        ValorPago = 0,
                        CriadoPor = dono.Id,
                    };
                    porFechamento[fechamento] = f;
                }
                return f;
            }

            for (int m = 0; m < 3; m++)
            {
                var refMes = hoje.AddMonths(-m);
                int qtd = rng.Next(3, 6);
                for (int i = 0; i < qtd; i++)
                {
                    var d = compras[rng.Next(compras.Length)];
                    var valor = d.min == d.max
                        ? d.min
                        : Math.Round(d.min + (decimal)rng.NextDouble() * (d.max - d.min), 2);
                    var data = new DateTime(refMes.Year, refMes.Month, rng.Next(1, 28));
                    var fatura = FaturaDe(data);
                    transacoes.Add(new Transacao
                    {
                        Id = Guid.NewGuid(),
                        Descricao = d.desc,
                        Valor = valor,
                        Tipo = TipoTransacao.Despesa,
                        CategoriaId = Cat(d.cat),
                        CartaoCreditoId = cartao.Id,
                        FaturaId = fatura.Id,
                        UsadoComoCredito = true,
                        MeioPagamento = MeioPagamento.Credito,
                        Data = data,
                        CriadoPor = dono.Id,
                        StatusTransacao = StatusTransacao.Executado,
                        Ativo = true,
                    });
                }
            }

            // Fatura passada (já fechou) → paga; gera a transação de pagamento (debita a conta).
            foreach (var f in porFechamento.Values)
            {
                var total = transacoes.Where(t => t.FaturaId == f.Id).Sum(t => t.Valor);
                if (f.DataFechamento.Date <= hoje)
                {
                    f.EstadoCiclo = EstadoCicloFatura.Fechada;
                    f.EstadoPagamento = EstadoPagamentoFatura.Pago;
                    f.ValorPago = total;
                    f.DataFechamentoEfetiva = f.DataFechamento;
                    f.DataPagamentoTotal = f.DataVencimento;
                    transacoes.Add(new Transacao
                    {
                        Id = Guid.NewGuid(),
                        Descricao = $"Pagamento fatura {cartao.Nome} ({f.DataFechamento:MM/yyyy})",
                        Valor = total,
                        Tipo = TipoTransacao.Despesa,
                        ContaId = contaPaga.Id,
                        EhPagamentoFatura = true,
                        FaturaPagaId = f.Id,
                        MeioPagamento = MeioPagamento.Pix,
                        Data = f.DataVencimento,
                        CriadoPor = dono.Id,
                        StatusTransacao = StatusTransacao.Executado,
                        Ativo = true,
                    });
                }
                faturas.Add(f);
            }
        }

        // ── Movimentação ──
        SeedFinancas(dev, devCorrente, devCarteira, devPoupanca, familia, salario: 7500m, rngSeed: 42);
        SeedFinancas(solo, soloCorrente, soloCarteira, poupanca: null, familia: null, salario: 4200m, rngSeed: 7);
        SeedCartaoFaturas(dev, devCartao, devCorrente);

        // ── Recorrentes / Assinaturas (repetição automática mensal) ──
        DateTime ProximaGeracao(int dia)
        {
            var d = new DateTime(hoje.Year, hoje.Month, Math.Min(dia, DateTime.DaysInMonth(hoje.Year, hoje.Month)));
            return d <= hoje ? d.AddMonths(1) : d;
        }
        Recorrente NovaRecorrente(Guid dono, string desc, decimal valor, TipoTransacao tipo,
            string cat, int dia, Guid? contaId, Guid? cartaoId) => new()
        {
            Id = Guid.NewGuid(),
            Descricao = desc,
            Valor = valor,
            Tipo = tipo,
            CategoriaId = Cat(cat),
            ContaId = contaId,
            CartaoCreditoId = cartaoId,
            Frequencia = FrequenciaRecorrencia.Mensal,
            Dia = dia,
            DataInicio = hoje.AddMonths(-3),
            DataProximaGeracao = ProximaGeracao(dia),
            Ativo = true,
            CriadoPor = dono,
        };

        var recorrentes = new List<Recorrente>
        {
            // Dev: renda automática + assinaturas (digitais no cartão; academia em débito).
            NovaRecorrente(dev.Id, "Salário", 7500m, TipoTransacao.Receita, "Renda", 5, devCorrente.Id, null),
            NovaRecorrente(dev.Id, "Netflix", 39.90m, TipoTransacao.Despesa, "Serviços digitais", 15, null, devCartao.Id),
            NovaRecorrente(dev.Id, "Spotify", 21.90m, TipoTransacao.Despesa, "Serviços digitais", 8, null, devCartao.Id),
            NovaRecorrente(dev.Id, "Academia", 89.90m, TipoTransacao.Despesa, "Lazer", 5, devCorrente.Id, null),
            // Solo: renda + uma assinatura em débito.
            NovaRecorrente(solo.Id, "Salário", 4200m, TipoTransacao.Receita, "Renda", 5, soloCorrente.Id, null),
            NovaRecorrente(solo.Id, "Spotify", 21.90m, TipoTransacao.Despesa, "Serviços digitais", 8, soloCorrente.Id, null),
        };

        // Hora realista por transação (data + horário comercial) para permitir
        // ordenação cronológica por data E hora nas listas (ex.: lançamentos da fatura).
        var rngHora = new Random(2026);
        foreach (var t in transacoes)
            t.CriadoEm = t.Data.AddHours(rngHora.Next(8, 22)).AddMinutes(rngHora.Next(0, 60));

        context.Faturas.AddRange(faturas);
        context.Recorrentes.AddRange(recorrentes);
        context.Transacoes.AddRange(transacoes);
        await context.SaveChangesAsync();
    }
}
