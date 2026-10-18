using Microsoft.EntityFrameworkCore;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.CartaoCredito;
using ControleFinanceiro.Api.DTOs.Conta;
using ControleFinanceiro.Api.DTOs.Parcelamento;
using ControleFinanceiro.Api.DTOs.Recorrente;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.DTOs.Reconciliacao;
using ControleFinanceiro.Api.DTOs.Transferencia;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;

namespace ControleFinanceiro.Api.Data;

/// <summary>
/// Registros de demonstração do front v2 — pra ver as telas com dado de verdade (usabilidade), na conta
/// de exemplo do <see cref="DevDataSeeder"/> (Gabriel + Marina, em família). Só Development e só com
/// <c>SEED_DEMO=true</c> no .env local: o CI/E2E não liga, então o atlas do Playwright segue igual.
/// Dados fictícios (nada de pessoa real). Tudo passa pelos services — as mesmas regras do app
/// (previsões da conta fixa, parcelas nas faturas, limite) — em vez de gravar entidade solta.
/// Idempotente por seção: cada bloco tem um marcador e não roda de novo; um bloco novo (tela nova do
/// v2) entra aqui e roda sozinho no próximo boot.
/// </summary>
public static class DemoSeeder
{
    public static async Task SeedAsync(IServiceProvider sp)
    {
        var context = sp.GetRequiredService<AppDbContext>();
        await DevDataSeeder.SeedAsync(context); // base: usuários, contas, cartão Nubank, faturas, família

        var dev = await context.Usuarios.FirstAsync(u => u.Email == DevDataSeeder.DevEmail);
        var contas = await context.Contas.Where(c => c.UsuarioIdProprietario == dev.Id).ToListAsync();
        var corrente = contas.First(c => c.Nome == "Conta Corrente");
        var poupanca = contas.First(c => c.Nome == "Poupança");
        var carteira = contas.First(c => c.IsCarteira);
        var nubank = await context.CartoesCredito.FirstAsync(c => c.CriadoPor == dev.Id && c.Nome == "Nubank");
        var categorias = await context.Categorias.Where(c => c.UsuarioId == null).ToListAsync();
        Guid Cat(string desc) => categorias.First(c => c.Descricao.StartsWith(desc)).Id;
        var hoje = DateTime.UtcNow.Date;

        await ContasFixasAsync(sp, context, dev.Id, corrente.Id, poupanca.Id, carteira.Id, nubank.Id, Cat, hoje);
        var itau = await CartoesAsync(sp, context, dev.Id, corrente.Id, Cat, hoje);
        await ParcelamentosAsync(sp, context, dev.Id, nubank, itau, Cat, hoje);
        await ContasAsync(sp, context, dev.Id, hoje);
        await CategoriasAsync(sp, context, dev.Id, corrente.Id, hoje);
        await NotificacoesAsync(sp, context, dev.Id, nubank.Id);
        await ReconciliacaoAsync(sp, context, dev.Id, corrente.Id, hoje);
        await FamiliaAsync(sp, context, dev.Id, hoje);
    }

    private static DateTime Utc(DateTime d) => DateTime.SpecifyKind(d.Date, DateTimeKind.Utc);

    // ── Contas fixas: todas as situações (ativa, pausada, cancelada, encerrada), as três frequências,
    //    receita e despesa, em conta e no cartão. Começam hoje (as já existentes do DevDataSeeder cobrem
    //    o passado); a "encerrada" é a única com início no passado — as cobranças de lá viram pagas.
    private static async Task ContasFixasAsync(IServiceProvider sp, AppDbContext context, Guid dev,
        Guid corrente, Guid poupanca, Guid carteira, Guid nubank, Func<string, Guid> Cat, DateTime hoje)
    {
        if (await context.Recorrentes.AnyAsync(r => r.CriadoPor == dev && r.Descricao == "Plano de saúde"))
            return;
        var svc = sp.GetRequiredService<RecorrenteService>();
        async Task<Guid> Criar(string desc, decimal valor, TipoTransacao tipo, string cat, FrequenciaRecorrencia freq,
            DateTime inicio, Guid? conta = null, Guid? cartao = null, DateTime? fim = null, MeioPagamento? meio = null,
            string? sub = null)
        {
            // Subcategoria padrão pelo nome, dentro da categoria (SubcategoriaSeeder).
            var catId = Cat(cat);
            var subId = sub is null ? null : await context.Subcategorias
                .Where(s => s.UsuarioId == null && s.CategoriaId == catId && s.Nome == sub)
                .Select(s => (Guid?)s.Id).FirstOrDefaultAsync();
            var r = await svc.CriarAsync(new CriarRecorrenteDto
            {
                Descricao = desc, Valor = valor, Tipo = (int)tipo, CategoriaId = Cat(cat), SubcategoriaId = subId,
                ContaId = conta, CartaoCreditoId = cartao, MeioPagamento = meio is { } m ? (int)m : null,
                Frequencia = (int)freq, Dia = inicio.Day,
                DataInicio = Utc(inicio), DataFim = fim is { } f ? Utc(f) : null,
            }, dev, Guid.NewGuid().ToString());
            return r.Id;
        }

        var dia = (int d) => new DateTime(hoje.Year, hoje.Month, 1).AddMonths(hoje.Day >= d ? 1 : 0).AddDays(d - 1);
        await Criar("Internet fibra", 99.90m, TipoTransacao.Despesa, "Moradia", FrequenciaRecorrencia.Mensal, dia(12), conta: corrente, meio: MeioPagamento.DebitoAutomatico, sub: "Internet");
        await Criar("Plano de saúde", 389.00m, TipoTransacao.Despesa, "Saúde", FrequenciaRecorrencia.Mensal, dia(20), conta: corrente, meio: MeioPagamento.Boleto, sub: "Plano de saúde");
        await Criar("Feira", 80.00m, TipoTransacao.Despesa, "Alimentação", FrequenciaRecorrencia.Semanal, hoje.AddDays(2), conta: carteira, meio: MeioPagamento.Dinheiro);
        await Criar("Anuidade Amazon Prime", 166.80m, TipoTransacao.Despesa, "Serviços digitais", FrequenciaRecorrencia.Anual, hoje.AddDays(49), cartao: nubank);
        await Criar("Aluguel da garagem", 250.00m, TipoTransacao.Receita, "Renda", FrequenciaRecorrencia.Mensal, dia(1), conta: poupanca);
        // Encerrada: começou há 8 meses e terminou há 2 (as cobranças desse período entram como pagas).
        await Criar("Seguro do celular", 29.90m, TipoTransacao.Despesa, "Seguros", FrequenciaRecorrencia.Mensal,
            new DateTime(hoje.Year, hoje.Month, 5).AddMonths(-8), conta: corrente, fim: new DateTime(hoje.Year, hoje.Month, 5).AddMonths(-2));
        // Pausada (volta quando retomar) e cancelada (definitiva, com motivo).
        var curso = await Criar("Curso de inglês", 249.00m, TipoTransacao.Despesa, "Educação", FrequenciaRecorrencia.Mensal, dia(15), conta: corrente);
        await svc.ToggleAtivoAsync(curso, dev, ativo: false);
        var disney = await Criar("Disney+", 33.90m, TipoTransacao.Despesa, "Serviços digitais", FrequenciaRecorrencia.Mensal, dia(22), cartao: nubank);
        await svc.CancelarAsync(disney, new CancelarRecorrenteDto { Motivo = "Assinei outro streaming" }, dev);
    }

    // ── Cartões: um segundo cartão de crédito (pra lista ter mais de um e os parcelamentos) e um só de débito.
    private static async Task<Domain.Entities.CartaoCredito> CartoesAsync(IServiceProvider sp, AppDbContext context, Guid dev,
        Guid corrente, Func<string, Guid> Cat, DateTime hoje)
    {
        var existente = await context.CartoesCredito.FirstOrDefaultAsync(c => c.CriadoPor == dev && c.Nome == "Itaú Click");
        if (existente != null) return existente;
        var bancos = await context.Bancos.ToListAsync();
        Guid? Banco(string codigo) => bancos.FirstOrDefault(b => b.CodigoBanco == codigo)?.Id;
        var svc = sp.GetRequiredService<CartaoCreditoService>();
        var itau = await svc.CriarAsync(new CriarCartaoCreditoDto
        {
            Nome = "Itaú Click", UltimosDigitos = "7730", Bandeira = BandeiraCartao.Visa, TemCredito = true,
            Limite = 9000m, DiaFechamento = 3, DiaVencimento = 10, BancoId = Banco("341"), ContaId = corrente,
        }, dev);
        await svc.CriarAsync(new CriarCartaoCreditoDto
        {
            Nome = "Caixa", UltimosDigitos = "0912", Bandeira = BandeiraCartao.Elo, TemDebito = true,
            BancoId = Banco("104"), ContaId = corrente,
        }, dev);
        return await context.CartoesCredito.FirstAsync(c => c.Id == itau.Id);
    }

    // ── Parcelamentos: compra nova e compra em andamento (parcelas pagas antes de entrar no app), compra
    //    parcelada e Pix no crédito (com juros). A próxima parcela registrada cai sempre na fatura aberta
    //    hoje — a regra do servidor recusa parcela em fatura que já venceu.
    private static async Task ParcelamentosAsync(IServiceProvider sp, AppDbContext context, Guid dev,
        Domain.Entities.CartaoCredito nubank, Domain.Entities.CartaoCredito itau, Func<string, Guid> Cat, DateTime hoje)
    {
        if (await context.Parcelamentos.AnyAsync(p => p.CriadoPor == dev && p.Descricao == "Notebook Dell"))
            return;
        var svc = sp.GetRequiredService<ParcelamentoService>();
        async Task Criar(Domain.Entities.CartaoCredito cartao, string desc, decimal valor, int parcelas, int jaPagas,
            string cat, TipoParcelamento tipo = TipoParcelamento.CompraParcelada, decimal? juros = null)
        {
            var (_, fechAberta) = FaturaService.CalcularPeriodo(hoje, cartao.DiaFechamento);
            var primeira = new DateTime(fechAberta.Year, fechAberta.Month, 1).AddMonths(-jaPagas);
            var compra = jaPagas == 0 ? hoje : fechAberta.AddMonths(-jaPagas).AddDays(-5);
            if (compra > hoje) compra = hoje;
            await svc.CriarAsync(new CriarParcelamentoDto
            {
                Descricao = desc, Valor = valor, Tipo = tipo, CartaoCreditoId = cartao.Id, DataCompra = Utc(compra),
                Parcelas = parcelas, ParcelasJaPagas = jaPagas, PrimeiraParcelaMes = primeira.ToString("yyyy-MM"),
                CategoriaId = Cat(cat), TaxaJuroMensal = juros, IdempotencyKey = Guid.NewGuid().ToString(),
            }, dev);
        }

        await Criar(itau, "Notebook Dell", 4299.00m, 10, 4, "Compras");
        await Criar(itau, "Geladeira Brastemp", 3600.00m, 12, 0, "Moradia");
        await Criar(itau, "Passagem aérea Recife", 1200.00m, 6, 1, "Lazer", TipoParcelamento.PIXCredito, 3.49m);
        await Criar(nubank, "Celular Samsung", 2400.00m, 12, 2, "Compras");
    }

    // ── Contas (Bancos): uma conta a mais aberta (Inter, com agência e número) e uma antiga já encerrada
    //    (Santander: teve movimento, o saldo foi pro Inter no encerramento) — pras duas listas terem o que mostrar.
    private static async Task ContasAsync(IServiceProvider sp, AppDbContext context, Guid dev, DateTime hoje)
    {
        if (await context.Contas.AnyAsync(c => c.UsuarioIdProprietario == dev && c.Nome == "Inter"))
            return;
        var bancos = await context.Bancos.ToListAsync();
        Guid? Banco(string codigo) => bancos.FirstOrDefault(b => b.CodigoBanco == codigo)?.Id;
        var contas = sp.GetRequiredService<ContaService>();
        var inter = await contas.CriarAsync(new Domain.Entities.Conta
        {
            Nome = "Inter", Tipo = TipoConta.ContaCorrente, BancoId = Banco("077"), Agencia = "0001", NumeroConta = "1234567-8",
        }, dev, 1250m, Utc(hoje.AddDays(-40)));
        var santander = await contas.CriarAsync(new Domain.Entities.Conta
        {
            Nome = "Santander", Tipo = TipoConta.ContaCorrente, BancoId = Banco("033"), Agencia = "3456", NumeroConta = "01023456-7",
        }, dev, 800m, Utc(hoje.AddDays(-90)));
        await sp.GetRequiredService<TransferenciaService>().CriarAsync(new CriarTransferenciaDto
        {
            ContaOrigemId = santander.Id, ContaDestinoId = inter.Id, Valor = 200m,
            Data = DateOnly.FromDateTime(hoje.AddDays(-30)), Descricao = "Transferência pro Inter",
        }, dev);
        // Encerrada com saldo: o que sobrou (R$ 600) vai pro Inter numa transferência de verdade.
        await sp.GetRequiredService<EncerramentoContaService>().EncerrarAsync(santander.Id,
            new EncerrarContaDto { ContaDestinoId = inter.Id, Data = DateOnly.FromDateTime(hoje.AddDays(-5)) }, dev, Guid.NewGuid().ToString());
        // Investimentos (corretora) e um segundo "dinheiro" (cofrinho) — grupos próprios na tela de Bancos.
        await contas.CriarAsync(new Domain.Entities.Conta
        {
            Nome = "XP", Tipo = TipoConta.Investimento, BancoId = Banco("102"),
        }, dev, 5000m, Utc(hoje.AddDays(-120)));
        await contas.CriarAsync(new Domain.Entities.Conta { Nome = "Cofrinho", Tipo = TipoConta.Dinheiro }, dev, 200m, Utc(hoje.AddDays(-10)));
    }

    // ── Categorias: as da pessoa (despesa, receita e as duas), subcategoria própria numa padrão (Moradia) e uma
    //    categoria com lançamentos e conta fixa (Pets), pra ver o "pra onde vai" ao excluir. Via services.
    private static async Task CategoriasAsync(IServiceProvider sp, AppDbContext context, Guid dev, Guid corrente, DateTime hoje)
    {
        if (await context.Categorias.AnyAsync(c => c.UsuarioId == dev && c.Descricao == "Pets"))
            return;
        var cats = sp.GetRequiredService<CategoriaService>();
        var subs = sp.GetRequiredService<SubcategoriaService>();
        var pets = await cats.CriarAsync(new Domain.Entities.Categoria { Descricao = "Pets", Finalidade = Finalidade.Despesa }, dev);
        var racao = await subs.CriarAsync(new Domain.Entities.Subcategoria { Nome = "Ração", CategoriaId = pets.Id }, dev);
        await subs.CriarAsync(new Domain.Entities.Subcategoria { Nome = "Veterinário", CategoriaId = pets.Id }, dev);
        var freelas = await cats.CriarAsync(new Domain.Entities.Categoria { Descricao = "Freelas", Finalidade = Finalidade.Receita }, dev);
        await subs.CriarAsync(new Domain.Entities.Subcategoria { Nome = "Design", CategoriaId = freelas.Id }, dev);
        await cats.CriarAsync(new Domain.Entities.Categoria { Descricao = "Reembolsos", Finalidade = Finalidade.Ambas }, dev);
        if (await context.Categorias.FirstOrDefaultAsync(c => c.UsuarioId == null && c.Descricao == "Moradia") is { } moradia)
            await subs.CriarAsync(new Domain.Entities.Subcategoria { Nome = "Jardinagem", CategoriaId = moradia.Id }, dev);

        var tx = sp.GetRequiredService<TransacaoService>();
        foreach (var (desc, valor, dias, sub) in new[] { ("Ração 15kg", 189.90m, -12, (Guid?)racao.Id), ("Banho e tosa", 80m, -5, null) })
            await tx.CriarTransacaoAsync(new Domain.Entities.Transacao
            {
                Id = Guid.NewGuid(), Descricao = desc, Valor = valor, Tipo = TipoTransacao.Despesa, CategoriaId = pets.Id,
                SubcategoriaId = sub, ContaId = corrente, MeioPagamento = MeioPagamento.Pix,
                StatusTransacao = StatusTransacao.Executado, Data = DateOnly.FromDateTime(hoje.AddDays(dias)),
            }, dev, Guid.NewGuid().ToString());
        var inicio = Utc(hoje.AddDays(7));
        await sp.GetRequiredService<RecorrenteService>().CriarAsync(new CriarRecorrenteDto
        {
            Descricao = "Ração mensal", Valor = 189.90m, Tipo = (int)TipoTransacao.Despesa, CategoriaId = pets.Id, SubcategoriaId = racao.Id,
            ContaId = corrente, MeioPagamento = (int)MeioPagamento.Pix, Frequencia = (int)FrequenciaRecorrencia.Mensal,
            Dia = inicio.Day, DataInicio = inicio,
        }, dev, Guid.NewGuid().ToString());
    }

    // ── Reconciliação: três conferências na conta corrente, uma de cada jeito — bateu (20 dias atrás), com
    //    diferença já ajustada (10 dias atrás, lançamento de ajuste) e com diferença em aberto (3 dias atrás,
    //    pra a tela oferecer Ajustar / Lançar o que falta). O saldo inicial aparece como ponto de partida.
    private static async Task ReconciliacaoAsync(IServiceProvider sp, AppDbContext context, Guid dev, Guid corrente, DateTime hoje)
    {
        if (await context.ReconciliacoesSaldo.AnyAsync(r => r.UsuarioId == dev))
            return;
        var svc = sp.GetRequiredService<ReconciliacaoService>();
        async Task Marco(int diasAtras, decimal desvio, string? resolucao)
        {
            var dataHora = Utc(hoje.AddDays(-diasAtras)).AddHours(23).AddMinutes(59);
            var calculado = await svc.CalcularSaldoAteAsync(dev, corrente, dataHora);
            await svc.CriarMarcoAsync(dev, new CriarMarcoReconciliacaoDto
            {
                ContaId = corrente, DataHora = dataHora, SaldoDeclarado = calculado + desvio, Tipo = 2, Resolucao = resolucao,
            }, Guid.NewGuid().ToString());
        }
        await Marco(20, 0m, null);
        await Marco(10, -35.90m, "ajustar");
        await Marco(3, 120m, null);
    }

    // ── Família (Casa Dev, do DevDataSeeder: Gabriel + Marina com despesas compartilhadas): dependentes (criança
    //    e pet), um convite pendente de quem só vê, aprovação a partir de R$ 1.500 e um acerto do mês.
    private static async Task FamiliaAsync(IServiceProvider sp, AppDbContext context, Guid dev, DateTime hoje)
    {
        var familia = await context.Familias.FirstOrDefaultAsync(f => f.CriadoPorUsuarioId == dev);
        if (familia is null || await context.Dependentes.AnyAsync(d => d.FamiliaId == familia.Id))
            return;
        var dependentes = sp.GetRequiredService<DependenteService>();
        await dependentes.CriarAsync(familia.Id, dev, new CriarDependenteDto("Theo", null, Utc(hoje.AddYears(-5).AddMonths(-3)), TipoDependente.Crianca));
        await dependentes.CriarAsync(familia.Id, dev, new CriarDependenteDto("Bolt", "Boltinho", null, TipoDependente.Pet));
        await sp.GetRequiredService<ConviteService>().CriarAsync(familia.Id, new CriarConviteDto("avo@exemplo.com", "Avó", PapelFamilia.Dependente), dev);
        await sp.GetRequiredService<FamiliaService>().DefinirLimiteAprovacaoAsync(familia.Id, dev, 1500m);
        var conjuge = await context.MembrosFamilia.Where(m => m.FamiliaId == familia.Id && m.UsuarioId != dev).Select(m => m.UsuarioId).FirstAsync();
        await sp.GetRequiredService<AcertoService>().RegistrarAsync(familia.Id, dev, new RegistrarAcertoDto(
            conjuge, dev, 150m, hoje.Month, hoje.Year, "Pix do mercado", Guid.NewGuid().ToString()));
    }
    // ── Notificações: pro sino ter o que mostrar (uma já lida).
    private static async Task NotificacoesAsync(IServiceProvider sp, AppDbContext context, Guid dev, Guid nubank)
    {
        if (await context.Notificacoes.AnyAsync(n => n.UsuarioId == dev))
            return;
        var svc = sp.GetRequiredService<NotificacaoService>();
        await svc.CriarAsync(dev, TipoNotificacao.FaturaVencendo, "Fatura do Nubank vence em 3 dias",
            "Confira o valor e pague antes do vencimento pra não pagar juros.", $"/cartoes/{nubank}");
        await svc.CriarAsync(dev, TipoNotificacao.DespesaCompartilhada, "Marina lançou uma despesa da casa",
            "Supermercado — R$ 312,40, dividido igualmente na Casa Dev.", "/transacoes");
        await svc.CriarAsync(dev, TipoNotificacao.OrcamentoEstourado, "Alimentação passou de 80% do limite",
            "Você já usou R$ 1.640,00 dos R$ 2.000,00 do mês.", "/limites");
        var antiga = await context.Notificacoes.Where(n => n.UsuarioId == dev).OrderBy(n => n.CriadoEm).FirstAsync();
        antiga.Lida = true;
        await context.SaveChangesAsync();
    }
}
