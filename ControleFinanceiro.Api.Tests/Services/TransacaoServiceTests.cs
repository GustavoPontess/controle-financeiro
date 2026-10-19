using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Transacao;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class TransacaoServiceTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static (AppDbContext ctx, TransacaoService svc) Build()
    {
        var ctx = CreateContext();
        var faturaService = new FaturaService(ctx);
        return (ctx, new TransacaoService(ctx, faturaService, new FinancialEventLogService(ctx)));
    }

    private static async Task<(Guid contaId, Guid usuarioId)> SeedConta(AppDbContext ctx)
    {
        var usuarioId = Guid.NewGuid();
        var conta = new Conta
        {
            Id = Guid.NewGuid(),
            Nome = "Conta Teste",
            UsuarioIdProprietario = usuarioId,
            Tipo = TipoConta.ContaCorrente,
        };
        ctx.Contas.Add(conta);
        await ctx.SaveChangesAsync();
        return (conta.Id, usuarioId);
    }

    [Fact]
    public async Task CriarTransacaoAsync_ValorZero_LancaException()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            Descricao = "Teste",
            Valor = 0,
            Tipo = TipoTransacao.Despesa,
            Data = DateOnly.FromDateTime(DateTime.UtcNow),
        };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarTransacaoAsync(transacao, usuarioId));
        Assert.Contains("positivo", ex.Message);
    }

    [Fact]
    public async Task CriarTransacaoAsync_ValorNegativo_LancaException()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            Descricao = "Teste",
            Valor = -10,
            Tipo = TipoTransacao.Despesa,
            Data = DateOnly.FromDateTime(DateTime.UtcNow),
        };

        await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarTransacaoAsync(transacao, usuarioId));
    }

    [Fact]
    public async Task CriarTransacaoAsync_DataFutura_LancaException()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            Descricao = "Teste",
            Valor = 100,
            Tipo = TipoTransacao.Despesa,
            Data = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
        };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarTransacaoAsync(transacao, usuarioId));
        Assert.Contains("futura", ex.Message);
    }

    [Fact]
    public async Task CriarTransacaoAsync_PrevisaoComDataFutura_PersisteSucesso()
    {
        // Previsão (ex.: salário do próximo mês) PODE ser futura — é o ponto dela.
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            Descricao = "Salário (previsto)",
            Valor = 5000,
            Tipo = TipoTransacao.Receita,
            StatusTransacao = StatusTransacao.Previsao,
            Data = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(15)),
        };

        var resultado = await svc.CriarTransacaoAsync(transacao, usuarioId);

        Assert.Equal(StatusTransacao.Previsao, resultado.StatusTransacao);
        Assert.True(resultado.Data > DateOnly.FromDateTime(DateTime.UtcNow));
    }

    [Fact]
    public async Task CriarTransacaoAsync_Efetivado_PersisteComoExecutado()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            Descricao = "Compra à vista",
            Valor = 100,
            Tipo = TipoTransacao.Despesa,
            StatusTransacao = StatusTransacao.Executado,
            Data = DateOnly.FromDateTime(DateTime.UtcNow),
        };

        var resultado = await svc.CriarTransacaoAsync(transacao, usuarioId);

        Assert.Equal(StatusTransacao.Executado, resultado.StatusTransacao);
    }

    [Fact]
    public async Task CriarTransacaoAsync_ContaNaoEncontrada_LancaException()
    {
        var (_, svc) = Build();
        var usuarioId = Guid.NewGuid();

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = Guid.NewGuid(),
            Descricao = "Teste",
            Valor = 100,
            Tipo = TipoTransacao.Despesa,
            Data = DateOnly.FromDateTime(DateTime.UtcNow),
        };

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.CriarTransacaoAsync(transacao, usuarioId));
    }

    [Fact]
    public async Task CriarTransacaoAsync_SemContaNemCartao_LancaException()
    {
        var (_, svc) = Build();
        var usuarioId = Guid.NewGuid();

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            Descricao = "Teste",
            Valor = 100,
            Tipo = TipoTransacao.Despesa,
            Data = DateOnly.FromDateTime(DateTime.UtcNow),
        };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarTransacaoAsync(transacao, usuarioId));
        Assert.Contains("conta ou", ex.Message.ToLower());
    }

    [Fact]
    public async Task CriarTransacaoAsync_CategoriaIncompativelDespesa_LancaException()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var categoria = new Categoria
        {
            Id = Guid.NewGuid(),
            Descricao = "Salário",
            Finalidade = Finalidade.Receita,
            UsuarioId = usuarioId,
        };
        ctx.Categorias.Add(categoria);
        await ctx.SaveChangesAsync();

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            CategoriaId = categoria.Id,
            Descricao = "Teste",
            Valor = 100,
            Tipo = TipoTransacao.Despesa,
            Data = DateOnly.FromDateTime(DateTime.UtcNow),
        };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarTransacaoAsync(transacao, usuarioId));
        Assert.Contains("inválida", ex.Message);
    }

    [Fact]
    public async Task CriarTransacaoAsync_DadosValidos_PersisteSucesso()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            Descricao = "Supermercado",
            Valor = 150,
            Tipo = TipoTransacao.Despesa,
            Data = DateOnly.FromDateTime(DateTime.UtcNow),
        };

        var resultado = await svc.CriarTransacaoAsync(transacao, usuarioId);

        Assert.Equal(transacao.Id, resultado.Id);
        Assert.Equal(usuarioId, resultado.CriadoPor);
        Assert.Equal(1, await ctx.Transacoes.CountAsync());
    }

    // ── Data (DateOnly) + Hora (TimeOnly?) — a Transacao deixou de ter um timestamp único ────────────

    [Fact]
    public async Task CriarTransacaoAsync_DataEHora_PersistemEVoltamIdenticos()
    {
        // Round-trip do modelo: o que entra (dia + hora) é exatamente o que sai — sem deslocamento de fuso.
        // 23:30 de propósito: qualquer shift de horas viraria o DIA.
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        var dia = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-7);
        var hora = new TimeOnly(23, 30, 15);
        var transacao = new Transacao
        {
            Id = Guid.NewGuid(), ContaId = contaId, Descricao = "Jantar", Valor = 120, Tipo = TipoTransacao.Despesa,
            Data = dia, Hora = hora,
        };

        await svc.CriarTransacaoAsync(transacao, usuarioId);
        ctx.ChangeTracker.Clear(); // força a leitura de volta do banco, não do objeto em memória

        var porId = await svc.BuscarPorIdAsync(transacao.Id, usuarioId);
        Assert.NotNull(porId);
        Assert.Equal(dia, porId!.Data);
        Assert.Equal(hora, porId.Hora);

        var daLista = (await svc.ListarAsync(usuarioId)).Items.Single();
        Assert.Equal(dia, daLista.Data);
        Assert.Equal(hora, daLista.Hora);
    }

    [Fact]
    public async Task CriarTransacaoAsync_SemHora_PersisteHoraNula()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        var dia = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-3);
        var transacao = new Transacao
        {
            Id = Guid.NewGuid(), ContaId = contaId, Descricao = "Sem hora", Valor = 10, Tipo = TipoTransacao.Despesa,
            Data = dia, Hora = null,
        };

        await svc.CriarTransacaoAsync(transacao, usuarioId);
        ctx.ChangeTracker.Clear();

        var doBanco = await ctx.Transacoes.AsNoTracking().SingleAsync(t => t.Id == transacao.Id);
        Assert.Equal(dia, doBanco.Data);
        Assert.Null(doBanco.Hora); // null = lançamento sem hora, não "00:00"
    }

    [Fact]
    public async Task CriarTransacaoAsync_DataHojeComHoraMaisTardeNoDia_EhAceita()
    {
        // A regra de "data futura" é por DIA: hoje passa (mesmo com Hora ainda por vir); só amanhã em diante é recusado.
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        var transacao = new Transacao
        {
            Id = Guid.NewGuid(), ContaId = contaId, Descricao = "Hoje", Valor = 10, Tipo = TipoTransacao.Despesa,
            Data = DateOnly.FromDateTime(DateTime.UtcNow), Hora = new TimeOnly(23, 59),
        };

        var resultado = await svc.CriarTransacaoAsync(transacao, usuarioId);

        Assert.Equal(transacao.Id, resultado.Id);
        Assert.Equal(1, await ctx.Transacoes.CountAsync());
    }

    [Fact]
    public async Task AtualizarAsync_TrocaDataEHora_ELimpaAHoraQuandoNula()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        var hoje = DateOnly.FromDateTime(DateTime.UtcNow);
        var transacao = new Transacao
        {
            Id = Guid.NewGuid(), ContaId = contaId, Descricao = "Original", Valor = 100, Tipo = TipoTransacao.Despesa,
            Data = hoje.AddDays(-9), Hora = new TimeOnly(8, 15), CriadoPor = usuarioId,
        };
        ctx.Transacoes.Add(transacao);
        await ctx.SaveChangesAsync();

        // 1) troca dia e hora
        var ok1 = await svc.AtualizarAsync(transacao.Id, new Transacao
        {
            Descricao = "Editada", Valor = 100, Tipo = TipoTransacao.Despesa,
            Data = hoje.AddDays(-4), Hora = new TimeOnly(17, 5),
        }, usuarioId);
        Assert.True(ok1);
        ctx.ChangeTracker.Clear();
        var apos1 = await ctx.Transacoes.AsNoTracking().SingleAsync(t => t.Id == transacao.Id);
        Assert.Equal(hoje.AddDays(-4), apos1.Data);
        Assert.Equal(new TimeOnly(17, 5), apos1.Hora);

        // 2) Hora nula no payload → a hora é LIMPA (editar não herda a hora antiga)
        var ok2 = await svc.AtualizarAsync(transacao.Id, new Transacao
        {
            Descricao = "Editada", Valor = 100, Tipo = TipoTransacao.Despesa,
            Data = hoje.AddDays(-4), Hora = null,
        }, usuarioId);
        Assert.True(ok2);
        ctx.ChangeTracker.Clear();
        var apos2 = await ctx.Transacoes.AsNoTracking().SingleAsync(t => t.Id == transacao.Id);
        Assert.Equal(hoje.AddDays(-4), apos2.Data);
        Assert.Null(apos2.Hora);
    }

    [Fact]
    public async Task ListarAsync_FiltraPorIntervaloDeDatas_FromInclusivo_ToExclusivo()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        var hoje = DateOnly.FromDateTime(DateTime.UtcNow);
        var d1 = hoje.AddDays(-20);
        var d2 = hoje.AddDays(-10);
        var d3 = hoje.AddDays(-5);
        ctx.Transacoes.AddRange(
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "d1", Valor = 1, Tipo = TipoTransacao.Despesa, Data = d1, Hora = new TimeOnly(9, 0) },
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "d2", Valor = 2, Tipo = TipoTransacao.Despesa, Data = d2, Hora = new TimeOnly(23, 59) },
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "d3", Valor = 3, Tipo = TipoTransacao.Despesa, Data = d3, Hora = null });
        await ctx.SaveChangesAsync();

        // [d2, d3): d2 entra mesmo às 23:59 (a hora não empurra o lançamento pra fora do dia), d3 não entra.
        var faixa = await svc.ListarAsync(usuarioId, from: d2, to: d3);
        Assert.Equal(["d2"], faixa.Items.Select(t => t.Descricao));

        Assert.Equal(2, (await svc.ListarAsync(usuarioId, from: d2)).Total);   // d2, d3
        Assert.Equal(2, (await svc.ListarAsync(usuarioId, to: d3)).Total);     // d1, d2
    }

    [Fact]
    public async Task ListarAsync_MesmoDia_OrdenaPelaHora_DiaPrimeiroDepoisHora()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        var dia = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-2);
        ctx.Transacoes.AddRange(
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "cedo", Valor = 1, Tipo = TipoTransacao.Despesa, Data = dia, Hora = new TimeOnly(8, 0) },
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "tarde", Valor = 2, Tipo = TipoTransacao.Despesa, Data = dia, Hora = new TimeOnly(18, 30) },
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "vespera", Valor = 3, Tipo = TipoTransacao.Despesa, Data = dia.AddDays(-1), Hora = new TimeOnly(23, 0) });
        await ctx.SaveChangesAsync();

        var desc = (await svc.ListarAsync(usuarioId)).Items.Select(t => t.Descricao).ToList();
        Assert.Equal(["tarde", "cedo", "vespera"], desc); // dia desc; no mesmo dia, hora desc

        var asc = (await svc.ListarAsync(usuarioId, ordenacao: "data_asc")).Items.Select(t => t.Descricao).ToList();
        Assert.Equal(["vespera", "cedo", "tarde"], asc);
    }

    [Fact]
    public async Task ListarAsync_MesmoDia_SemHoraVemDepoisDosComHora_EDesempataPelaCriacao()
    {
        // Extrato importado não tem hora: no mesmo dia, quem tem hora vem antes (cronológico) e os sem
        // hora saem pela ordem de criação (= ordem do extrato). Antes: NULL primeiro no DESC e empate aleatório.
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        var dia = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-2);
        var t0 = DateTime.UtcNow.AddHours(-1);
        ctx.Transacoes.AddRange(
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "sem-hora-1", Valor = 1, Tipo = TipoTransacao.Despesa, Data = dia, Hora = null, CriadoEm = t0 },
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "com-hora-manha", Valor = 2, Tipo = TipoTransacao.Despesa, Data = dia, Hora = new TimeOnly(9, 0), CriadoEm = t0.AddMinutes(1) },
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "sem-hora-2", Valor = 3, Tipo = TipoTransacao.Despesa, Data = dia, Hora = null, CriadoEm = t0.AddMinutes(2) },
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "com-hora-noite", Valor = 4, Tipo = TipoTransacao.Despesa, Data = dia, Hora = new TimeOnly(21, 0), CriadoEm = t0.AddMinutes(3) });
        await ctx.SaveChangesAsync();

        // (Não usar Descricoes(): ela ordena alfabeticamente — aqui a ORDEM é o que se testa.)
        var desc = (await svc.ListarAsync(usuarioId)).Items.Select(t => t.Descricao).ToList();
        Assert.Equal(["com-hora-noite", "com-hora-manha", "sem-hora-2", "sem-hora-1"], desc);
        var asc = (await svc.ListarAsync(usuarioId, ordenacao: "data_asc")).Items.Select(t => t.Descricao).ToList();
        Assert.Equal(["com-hora-manha", "com-hora-noite", "sem-hora-1", "sem-hora-2"], asc);
    }

    [Fact]
    public async Task AtualizarAsync_ValorNegativo_LancaException()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            Descricao = "Original",
            Valor = 100,
            Tipo = TipoTransacao.Despesa,
            Data = DateOnly.FromDateTime(DateTime.UtcNow),
            CriadoPor = usuarioId,
        };
        ctx.Transacoes.Add(transacao);
        await ctx.SaveChangesAsync();

        var dados = new Transacao { Descricao = "Editada", Valor = -50, Tipo = TipoTransacao.Despesa, Data = DateOnly.FromDateTime(DateTime.UtcNow) };

        await Assert.ThrowsAsync<ArgumentException>(() => svc.AtualizarAsync(transacao.Id, dados, usuarioId));
    }

    [Fact]
    public async Task AtualizarAsync_DataFutura_LancaException()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            Descricao = "Original",
            Valor = 100,
            Tipo = TipoTransacao.Despesa,
            Data = DateOnly.FromDateTime(DateTime.UtcNow),
            CriadoPor = usuarioId,
        };
        ctx.Transacoes.Add(transacao);
        await ctx.SaveChangesAsync();

        var dados = new Transacao { Descricao = "Editada", Valor = 100, Tipo = TipoTransacao.Despesa, Data = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)) };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.AtualizarAsync(transacao.Id, dados, usuarioId));
        Assert.Contains("futura", ex.Message);
    }

    [Fact] // Regressão: editar PREVISÃO com data futura (salário do próximo mês) — antes dava 400
    public async Task AtualizarAsync_PrevisaoComDataFutura_Permite()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            Descricao = "Salário previsto",
            Valor = 5000,
            Tipo = TipoTransacao.Receita,
            Data = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(20)),
            StatusTransacao = StatusTransacao.Previsao,
            CriadoPor = usuarioId,
        };
        ctx.Transacoes.Add(transacao);
        await ctx.SaveChangesAsync();

        // Edita só a descrição, mantendo a data futura da previsão
        var dados = new Transacao
        {
            Descricao = "Salário (editado)",
            Valor = 5000,
            Tipo = TipoTransacao.Receita,
            Data = transacao.Data,
            StatusTransacao = StatusTransacao.Previsao,
        };

        var ok = await svc.AtualizarAsync(transacao.Id, dados, usuarioId);
        Assert.True(ok);
        var atualizada = await ctx.Transacoes.FindAsync(transacao.Id);
        Assert.Equal("Salário (editado)", atualizada!.Descricao);
    }

    [Fact] // Regressão: editar compra de CRÉDITO pós-datada — antes dava 400
    public async Task AtualizarAsync_CreditoComDataFutura_Permite()
    {
        var (ctx, svc) = Build();
        var usuarioId = Guid.NewGuid();

        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(),
            Nome = "Cartão",
            TemCredito = true,
            LimiteTotal = 5000,
            DiaFechamento = 10,
            DiaVencimento = 20,
            CriadoPor = usuarioId,
            Ativo = true,
        };
        ctx.CartoesCredito.Add(cartao);
        await ctx.SaveChangesAsync();

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            CartaoCreditoId = cartao.Id,
            Descricao = "Compra pós-datada",
            Valor = 200,
            Tipo = TipoTransacao.Despesa,
            Data = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10)),
            CriadoPor = usuarioId,
        };
        ctx.Transacoes.Add(transacao);
        await ctx.SaveChangesAsync();

        var dados = new Transacao
        {
            Descricao = "Compra pós-datada (editada)",
            Valor = 200,
            Tipo = TipoTransacao.Despesa,
            Data = transacao.Data,
        };

        var ok = await svc.AtualizarAsync(transacao.Id, dados, usuarioId);
        Assert.True(ok);
    }

    [Fact]
    public async Task CriarTransacaoAsync_ComSubcategoriaValida_Persiste()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var cat = new Categoria { Id = Guid.NewGuid(), Descricao = "Alimentação", Finalidade = Finalidade.Despesa, UsuarioId = usuarioId };
        var sub = new Subcategoria { Id = Guid.NewGuid(), Nome = "Supermercado", CategoriaId = cat.Id, UsuarioId = usuarioId };
        ctx.Categorias.Add(cat);
        ctx.Subcategorias.Add(sub);
        await ctx.SaveChangesAsync();

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            CategoriaId = cat.Id,
            SubcategoriaId = sub.Id,
            Descricao = "Compra mercado",
            Valor = 142.30m,
            Tipo = TipoTransacao.Despesa,
            Data = DateOnly.FromDateTime(DateTime.UtcNow),
        };

        var criada = await svc.CriarTransacaoAsync(transacao, usuarioId);

        Assert.Equal(sub.Id, criada.SubcategoriaId);
        Assert.Equal(sub.Id, (await ctx.Transacoes.FindAsync(criada.Id))!.SubcategoriaId);
    }

    [Fact]
    public async Task CriarTransacaoAsync_SubcategoriaDeOutraCategoria_Lanca()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var cat = new Categoria { Id = Guid.NewGuid(), Descricao = "Alimentação", Finalidade = Finalidade.Despesa, UsuarioId = usuarioId };
        var outraCat = new Categoria { Id = Guid.NewGuid(), Descricao = "Transporte", Finalidade = Finalidade.Despesa, UsuarioId = usuarioId };
        var subOutra = new Subcategoria { Id = Guid.NewGuid(), Nome = "Combustível", CategoriaId = outraCat.Id, UsuarioId = usuarioId };
        ctx.Categorias.AddRange(cat, outraCat);
        ctx.Subcategorias.Add(subOutra);
        await ctx.SaveChangesAsync();

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            CategoriaId = cat.Id,
            SubcategoriaId = subOutra.Id, // não pertence a cat
            Descricao = "Inconsistente",
            Valor = 50m,
            Tipo = TipoTransacao.Despesa,
            Data = DateOnly.FromDateTime(DateTime.UtcNow),
        };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarTransacaoAsync(transacao, usuarioId));
        Assert.Contains("pertence", ex.Message);
    }

    // ── Filtro tipo (#185 redesign) ─────────────────────────────────────────
    // Busca `q` usa EF.Functions.Like (relacional) e não roda no provider
    // InMemory — validada manualmente em Postgres. Aqui cobrimos só o filtro
    // de tipo, que é Where puro e roda em qualquer provider.

    [Fact]
    public async Task ListarAsync_FiltroTipo_RetornaSomenteDoTipo()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        ctx.Transacoes.AddRange(
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "Salário", Valor = 1000, Tipo = TipoTransacao.Receita, Data = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2)) },
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "Mercado", Valor = 200, Tipo = TipoTransacao.Despesa, Data = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)) },
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "Uber", Valor = 30, Tipo = TipoTransacao.Despesa, Data = DateOnly.FromDateTime(DateTime.UtcNow) });
        await ctx.SaveChangesAsync();

        // tipo=1 (Despesa) → 2 itens
        var despesas = await svc.ListarAsync(usuarioId, tipo: 1);
        Assert.Equal(2, despesas.Total);
        Assert.All(despesas.Items, t => Assert.Equal(TipoTransacao.Despesa, t.Tipo));

        // tipo=2 (Receita) → 1 item
        var receitas = await svc.ListarAsync(usuarioId, tipo: 2);
        Assert.Equal(1, receitas.Total);
        Assert.Equal(TipoTransacao.Receita, receitas.Items.Single().Tipo);

        // sem tipo → todos
        var todos = await svc.ListarAsync(usuarioId);
        Assert.Equal(3, todos.Total);
    }

    // ── Filtros ricos (#1.1) ────────────────────────────────────────────────

    [Fact]
    public async Task ListarAsync_FiltraPorFaixaDeValor()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        ctx.Transacoes.AddRange(
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "A", Valor = 50, Tipo = TipoTransacao.Despesa, Data = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-3)) },
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "B", Valor = 200, Tipo = TipoTransacao.Despesa, Data = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2)) },
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "C", Valor = 500, Tipo = TipoTransacao.Despesa, Data = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)) });
        await ctx.SaveChangesAsync();

        var r = await svc.ListarAsync(usuarioId, valorMin: 100, valorMax: 300);

        Assert.Equal(1, r.Total);
        Assert.Equal("B", r.Items.Single().Descricao);
    }

    [Fact]
    public async Task ListarAsync_FiltraPorStatus()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        ctx.Transacoes.AddRange(
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "Exec", Valor = 100, Tipo = TipoTransacao.Despesa, Data = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), StatusTransacao = StatusTransacao.Executado },
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "Prev", Valor = 100, Tipo = TipoTransacao.Despesa, Data = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)), StatusTransacao = StatusTransacao.Previsao });
        await ctx.SaveChangesAsync();

        var previstas = await svc.ListarAsync(usuarioId, status: (int)StatusTransacao.Previsao);
        Assert.Equal(1, previstas.Total);
        Assert.Equal("Prev", previstas.Items.Single().Descricao);

        var efetivadas = await svc.ListarAsync(usuarioId, status: (int)StatusTransacao.Executado);
        Assert.Equal("Exec", efetivadas.Items.Single().Descricao);
    }

    [Fact]
    public async Task ListarAsync_OrdenaPorValorDesc()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        ctx.Transacoes.AddRange(
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "m", Valor = 50, Tipo = TipoTransacao.Despesa, Data = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)) },
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "g", Valor = 500, Tipo = TipoTransacao.Despesa, Data = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2)) },
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "p", Valor = 200, Tipo = TipoTransacao.Despesa, Data = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-3)) });
        await ctx.SaveChangesAsync();

        var r = await svc.ListarAsync(usuarioId, ordenacao: "valor_desc");

        Assert.Equal(new[] { 500m, 200m, 50m }, r.Items.Select(t => t.Valor).ToArray());
    }

    [Fact]
    public async Task ListarAsync_FiltraPorConta()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        var conta2 = new Conta { Id = Guid.NewGuid(), Nome = "Conta 2", UsuarioIdProprietario = usuarioId, Tipo = TipoConta.ContaCorrente };
        ctx.Contas.Add(conta2);
        ctx.Transacoes.AddRange(
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "na 1", Valor = 100, Tipo = TipoTransacao.Despesa, Data = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)) },
            new Transacao { Id = Guid.NewGuid(), ContaId = conta2.Id, Descricao = "na 2", Valor = 100, Tipo = TipoTransacao.Despesa, Data = DateOnly.FromDateTime(DateTime.UtcNow) });
        await ctx.SaveChangesAsync();

        var r = await svc.ListarAsync(usuarioId, contaId: conta2.Id);

        Assert.Equal(1, r.Total);
        Assert.Equal("na 2", r.Items.Single().Descricao);
    }

    // ── Extrato de caixa: apenasCaixa + meioPagamento + natureza ───────────────
    // Tela Transações virou extrato de caixa (só o que mexe no saldo da conta).
    // Os 3 filtros rodam no banco; aqui provamos o escopo de cada um com um
    // extrato "misto" (uma de cada natureza + compra no crédito + saldo inicial).

    /// <summary>
    /// Semeia, na conta do usuário, um extrato misto de 8 lançamentos (uma de cada
    /// natureza + compra no crédito + saldo inicial). Compra no crédito tem só
    /// CartaoCreditoId (ContaId nulo).
    /// </summary>
    private static async Task SeedExtratoMisto(AppDbContext ctx, Guid contaId, Guid usuarioId)
    {
        var cartao = new CartaoCredito { Id = Guid.NewGuid(), Nome = "Cartão", CriadoPor = usuarioId, Ativo = true, TemCredito = true, LimiteTotal = 5000 };
        ctx.CartoesCredito.Add(cartao);

        var d = DateTime.UtcNow;
        ctx.Transacoes.AddRange(
            // Receita comum de conta (Pix)
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "Salário", Valor = 5000, Tipo = TipoTransacao.Receita, MeioPagamento = MeioPagamento.Pix, Data = DateOnly.FromDateTime(d.AddDays(-9)) },
            // Despesa comum de conta (Débito)
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "Mercado", Valor = 200, Tipo = TipoTransacao.Despesa, MeioPagamento = MeioPagamento.Debito, Data = DateOnly.FromDateTime(d.AddDays(-8)) },
            // Despesa de conta sem meio de pagamento informado (MeioPagamento nulo)
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "Sem meio", Valor = 15, Tipo = TipoTransacao.Despesa, MeioPagamento = null, Data = DateOnly.FromDateTime(d.AddDays(-7)) },
            // Compra no crédito: só CartaoCreditoId, ContaId nulo → NÃO mexe no saldo da conta
            new Transacao { Id = Guid.NewGuid(), CartaoCreditoId = cartao.Id, Descricao = "Compra crédito", Valor = 300, Tipo = TipoTransacao.Despesa, MeioPagamento = MeioPagamento.Credito, Data = DateOnly.FromDateTime(d.AddDays(-6)) },
            // Pagamento de fatura: tem ContaId (sai do caixa) e a marca EhPagamentoFatura
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "Pagto fatura", Valor = 300, Tipo = TipoTransacao.Despesa, EhPagamentoFatura = true, MeioPagamento = MeioPagamento.Boleto, Data = DateOnly.FromDateTime(d.AddDays(-5)) },
            // Pernas de transferência entre contas próprias
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "Transf saída", Valor = 100, Tipo = TipoTransacao.Despesa, EhTransferencia = true, MeioPagamento = MeioPagamento.Ted,Data = DateOnly.FromDateTime(d.AddDays(-4)) },
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "Transf entrada", Valor = 100, Tipo = TipoTransacao.Receita, EhTransferencia = true, MeioPagamento = MeioPagamento.Ted, Data = DateOnly.FromDateTime(d.AddDays(-3)) },
            // Saldo inicial (abertura da conta): compõe o saldo, mas não é movimento
            new Transacao { Id = Guid.NewGuid(), ContaId = contaId, Descricao = "Saldo inicial", Valor = 1000, Tipo = TipoTransacao.Receita, EhSaldoInicial = true, Data = DateOnly.FromDateTime(d.AddDays(-30)) });
        await ctx.SaveChangesAsync();
    }

    private static string[] Descricoes(DTOs.Common.PagedResult<Transacao> r) =>
        r.Items.Select(t => t.Descricao).OrderBy(x => x).ToArray();

    [Fact]
    public async Task ListarAsync_SemApenasCaixa_RetornaTudoInclusiveCreditoESaldoInicial()
    {
        // Regressão: o default (false) NÃO muda o comportamento das outras telas
        // (Cartão, relatórios) que listam compra no crédito e saldo inicial.
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        await SeedExtratoMisto(ctx, contaId, usuarioId);

        var r = await svc.ListarAsync(usuarioId);

        Assert.Equal(8, r.Total);
        Assert.Contains("Compra crédito", Descricoes(r));
        Assert.Contains("Saldo inicial", Descricoes(r));
    }

    [Fact]
    public async Task ListarAsync_ApenasCaixa_ExcluiCompraNoCreditoESaldoInicial()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        await SeedExtratoMisto(ctx, contaId, usuarioId);

        var r = await svc.ListarAsync(usuarioId, apenasCaixa: true);

        // 8 semeadas − compra no crédito − saldo inicial = 6
        Assert.Equal(6, r.Total);
        Assert.DoesNotContain("Compra crédito", Descricoes(r));
        Assert.DoesNotContain("Saldo inicial", Descricoes(r));
        // Nada sem conta: todo item do extrato de caixa mexe no saldo de uma conta.
        Assert.All(r.Items, t => Assert.NotNull(t.ContaId));
        Assert.All(r.Items, t => Assert.False(t.EhSaldoInicial));
    }

    [Fact]
    public async Task ListarAsync_ApenasCaixa_MantemPagamentoDeFaturaETransferencia()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        await SeedExtratoMisto(ctx, contaId, usuarioId);

        var r = await svc.ListarAsync(usuarioId, apenasCaixa: true);

        Assert.Contains("Pagto fatura", Descricoes(r));
        Assert.Contains("Transf saída", Descricoes(r));
        Assert.Contains("Transf entrada", Descricoes(r));
        Assert.Contains("Salário", Descricoes(r));
        Assert.Contains("Mercado", Descricoes(r));
        Assert.Contains("Sem meio", Descricoes(r));
    }

    [Fact]
    public async Task ListarAsync_ApenasCaixa_NaoVazaExtratoDeOutroUsuario()
    {
        // IDOR: apenasCaixa só restringe escopo, nunca amplia — o dono continua
        // valendo (a conta de outro usuário não aparece no extrato de caixa).
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        await SeedExtratoMisto(ctx, contaId, usuarioId);
        var (contaOutro, outroUsuarioId) = await SeedConta(ctx);
        ctx.Transacoes.Add(new Transacao { Id = Guid.NewGuid(), ContaId = contaOutro, Descricao = "Do outro", Valor = 999, Tipo = TipoTransacao.Despesa, Data = DateOnly.FromDateTime(DateTime.UtcNow) });
        await ctx.SaveChangesAsync();

        var meu = await svc.ListarAsync(usuarioId, apenasCaixa: true);
        var dele = await svc.ListarAsync(outroUsuarioId, apenasCaixa: true);

        Assert.DoesNotContain("Do outro", Descricoes(meu));
        Assert.Equal(6, meu.Total);
        Assert.Equal("Do outro", dele.Items.Single().Descricao);
    }

    [Fact]
    public async Task ListarAsync_ApenasCaixa_NaoRetornaCancelada()
    {
        // Soft delete continua valendo com o novo escopo (global query filter).
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        var manter = await svc.CriarTransacaoAsync(NovaDespesa(contaId), usuarioId);
        var excluir = await svc.CriarTransacaoAsync(NovaDespesa(contaId), usuarioId);
        await svc.DeletarAsync(excluir.Id, usuarioId);

        var r = await svc.ListarAsync(usuarioId, apenasCaixa: true);

        Assert.Equal(manter.Id, r.Items.Single().Id);
    }

    [Fact]
    public async Task ListarAsync_MeioPagamento_RetornaSomenteDoMeio()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        await SeedExtratoMisto(ctx, contaId, usuarioId);

        var pix = await svc.ListarAsync(usuarioId, meioPagamento: (int)MeioPagamento.Pix);
        Assert.Equal("Salário", pix.Items.Single().Descricao);

        var debito = await svc.ListarAsync(usuarioId, meioPagamento: (int)MeioPagamento.Debito);
        Assert.Equal("Mercado", debito.Items.Single().Descricao);

        var ted = await svc.ListarAsync(usuarioId, meioPagamento: (int)MeioPagamento.Ted);
        Assert.Equal(new[] { "Transf entrada", "Transf saída" }, Descricoes(ted));
    }

    [Fact]
    public async Task ListarAsync_MeioPagamento_IgnoraTransacaoSemMeioInformado()
    {
        // MeioPagamento é anulável: "Sem meio" não pode cair em nenhum meio
        // (nem em Dinheiro=1, o "primeiro" valor do enum).
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        await SeedExtratoMisto(ctx, contaId, usuarioId);

        foreach (var meio in Enum.GetValues<MeioPagamento>())
        {
            var r = await svc.ListarAsync(usuarioId, meioPagamento: (int)meio);
            Assert.DoesNotContain("Sem meio", Descricoes(r));
        }
    }

    [Fact]
    public async Task ListarAsync_MeioPagamento_SemNenhumaTransacao_RetornaVazio()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        await SeedExtratoMisto(ctx, contaId, usuarioId);

        var r = await svc.ListarAsync(usuarioId, meioPagamento: (int)MeioPagamento.Dinheiro);

        Assert.Equal(0, r.Total);
        Assert.Empty(r.Items);
    }

    [Fact]
    public async Task ListarAsync_MeioPagamento_CombinaComApenasCaixa()
    {
        // Crédito (3) só existe na compra no cartão; no extrato de caixa some.
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        await SeedExtratoMisto(ctx, contaId, usuarioId);

        var semEscopo = await svc.ListarAsync(usuarioId, meioPagamento: (int)MeioPagamento.Credito);
        Assert.Equal("Compra crédito", semEscopo.Items.Single().Descricao);

        var comEscopo = await svc.ListarAsync(usuarioId, meioPagamento: (int)MeioPagamento.Credito, apenasCaixa: true);
        Assert.Equal(0, comEscopo.Total);
    }

    [Fact]
    public async Task ListarAsync_NaturezaEntrada_SoReceitaReal()
    {
        // Entrada = Receita que NÃO é perna de transferência, pagamento de
        // fatura nem saldo inicial. Aqui só "Salário".
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        await SeedExtratoMisto(ctx, contaId, usuarioId);

        var r = await svc.ListarAsync(usuarioId, natureza: "entrada");

        Assert.Equal("Salário", r.Items.Single().Descricao);
    }

    [Fact]
    public async Task ListarAsync_NaturezaSaida_SoDespesaRealSemTransferenciaNemFatura()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        await SeedExtratoMisto(ctx, contaId, usuarioId);

        // Sem escopo de caixa a compra no crédito também é despesa "de saída".
        var todas = await svc.ListarAsync(usuarioId, natureza: "saida");
        Assert.Equal(new[] { "Compra crédito", "Mercado", "Sem meio" }, Descricoes(todas));

        // Com o escopo do extrato de caixa, a compra no crédito cai fora.
        var caixa = await svc.ListarAsync(usuarioId, natureza: "saida", apenasCaixa: true);
        Assert.Equal(new[] { "Mercado", "Sem meio" }, Descricoes(caixa));
        Assert.DoesNotContain("Pagto fatura", Descricoes(caixa));
        Assert.DoesNotContain("Transf saída", Descricoes(caixa));
    }

    [Fact]
    public async Task ListarAsync_NaturezaTransferencia_SoAsDuasPernas()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        await SeedExtratoMisto(ctx, contaId, usuarioId);

        var r = await svc.ListarAsync(usuarioId, natureza: "transferencia");

        Assert.Equal(new[] { "Transf entrada", "Transf saída" }, Descricoes(r));
        Assert.All(r.Items, t => Assert.True(t.EhTransferencia));
    }

    [Fact]
    public async Task ListarAsync_NaturezaFatura_SoPagamentoDeFatura()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        await SeedExtratoMisto(ctx, contaId, usuarioId);

        var r = await svc.ListarAsync(usuarioId, natureza: "fatura");

        Assert.Equal("Pagto fatura", r.Items.Single().Descricao);
        Assert.True(r.Items.Single().EhPagamentoFatura);
    }

    [Fact]
    public async Task ListarAsync_NaturezaDesconhecidaOuVazia_NaoFiltra()
    {
        // Valor fora da lista (ou string vazia do "Todos" do front) = sem filtro,
        // nunca "nada" nem erro 500.
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        await SeedExtratoMisto(ctx, contaId, usuarioId);

        var desconhecida = await svc.ListarAsync(usuarioId, natureza: "qualquer-coisa");
        var vazia = await svc.ListarAsync(usuarioId, natureza: "");
        var nula = await svc.ListarAsync(usuarioId, natureza: null);

        Assert.Equal(8, desconhecida.Total);
        Assert.Equal(8, vazia.Total);
        Assert.Equal(8, nula.Total);
    }

    [Fact]
    public async Task ListarAsync_NaturezaEntradaComApenasCaixa_ExcluiSaldoInicialMesmoSendoReceita()
    {
        // Saldo inicial é Receita, mas não é "entrada" — nem sem o escopo de caixa.
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        await SeedExtratoMisto(ctx, contaId, usuarioId);

        var semEscopo = await svc.ListarAsync(usuarioId, natureza: "entrada");
        var comEscopo = await svc.ListarAsync(usuarioId, natureza: "entrada", apenasCaixa: true);

        Assert.DoesNotContain("Saldo inicial", Descricoes(semEscopo));
        Assert.Equal(Descricoes(semEscopo), Descricoes(comEscopo));
    }

    [Fact]
    public async Task ListarAsync_FiltrosDeExtrato_CombinamComPaginacao()
    {
        // O total reflete o conjunto JÁ filtrado (paginação server-side).
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        await SeedExtratoMisto(ctx, contaId, usuarioId);

        var pagina1 = await svc.ListarAsync(usuarioId, page: 1, pageSize: 4, apenasCaixa: true);
        var pagina2 = await svc.ListarAsync(usuarioId, page: 2, pageSize: 4, apenasCaixa: true);

        Assert.Equal(6, pagina1.Total);
        Assert.Equal(4, pagina1.Items.Count());
        Assert.Equal(2, pagina2.Items.Count());
        Assert.Empty(pagina1.Items.Select(t => t.Id).Intersect(pagina2.Items.Select(t => t.Id)));
    }

    // ── C3: soft delete de Transacao ───────────────────────────────────────────

    private static Transacao NovaDespesa(Guid contaId) => new()
    {
        Id = Guid.NewGuid(),
        ContaId = contaId,
        Descricao = "Despesa",
        Valor = 100m,
        Tipo = TipoTransacao.Despesa,
        Data = DateOnly.FromDateTime(DateTime.UtcNow),
    };

    [Fact]
    public async Task DeletarAsync_FazSoftDelete_NaoRemoveFisicamente()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        var criada = await svc.CriarTransacaoAsync(NovaDespesa(contaId), usuarioId);

        var ok = await svc.DeletarAsync(criada.Id, usuarioId);

        Assert.True(ok);
        // A linha NÃO foi removida fisicamente (preserva histórico/FinancialEventLog).
        var fisica = await ctx.Transacoes.IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == criada.Id);
        Assert.NotNull(fisica);
        Assert.False(fisica!.Ativo);
        Assert.Equal(StatusTransacao.Cancelado, fisica.StatusTransacao);
        Assert.NotNull(fisica.CanceladoEm);
        Assert.False(string.IsNullOrWhiteSpace(fisica.MotivoCancelamento));
    }

    [Fact]
    public async Task ListarAsync_NaoRetornaTransacaoCancelada()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        var manter = await svc.CriarTransacaoAsync(NovaDespesa(contaId), usuarioId);
        var excluir = await svc.CriarTransacaoAsync(NovaDespesa(contaId), usuarioId);

        await svc.DeletarAsync(excluir.Id, usuarioId);

        // Regressão C3: a listagem não pode mais misturar canceladas com ativas.
        var lista = await svc.ListarAsync(usuarioId);
        Assert.Equal(1, lista.Total);
        Assert.Equal(manter.Id, lista.Items.Single().Id);
    }

    [Fact]
    public async Task DbSetFiltrado_ExcluiCancelada_mas_IgnoreQueryFilters_aVe()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        var criada = await svc.CriarTransacaoAsync(NovaDespesa(contaId), usuarioId);
        await svc.DeletarAsync(criada.Id, usuarioId);

        Assert.Empty(await ctx.Transacoes.ToListAsync());
        Assert.Single(await ctx.Transacoes.IgnoreQueryFilters().ToListAsync());
    }

    // ── Isolamento entre usuários (fix P0 — DonoRecursos) ────────────────────────

    [Fact]
    public async Task CriarTransacaoAsync_CategoriaDeOutroUsuario_LancaKeyNotFoundException()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        var outroUsuarioId = Guid.NewGuid();

        var categoriaDeOutro = new Categoria { Id = Guid.NewGuid(), Descricao = "Privada", Finalidade = Finalidade.Despesa, UsuarioId = outroUsuarioId };
        ctx.Categorias.Add(categoriaDeOutro);
        await ctx.SaveChangesAsync();

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            CategoriaId = categoriaDeOutro.Id,
            Descricao = "Tentativa",
            Valor = 100,
            Tipo = TipoTransacao.Despesa,
            Data = DateOnly.FromDateTime(DateTime.UtcNow),
        };

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.CriarTransacaoAsync(transacao, usuarioId));
        Assert.Equal(0, await ctx.Transacoes.CountAsync());
    }

    [Fact]
    public async Task CriarTransacaoAsync_CategoriaGlobal_PersisteSucesso()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);

        var categoriaGlobal = new Categoria { Id = Guid.NewGuid(), Descricao = "Mercado", Finalidade = Finalidade.Despesa, UsuarioId = null };
        ctx.Categorias.Add(categoriaGlobal);
        await ctx.SaveChangesAsync();

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            CategoriaId = categoriaGlobal.Id,
            Descricao = "Compra",
            Valor = 80,
            Tipo = TipoTransacao.Despesa,
            Data = DateOnly.FromDateTime(DateTime.UtcNow),
        };

        var resultado = await svc.CriarTransacaoAsync(transacao, usuarioId);

        Assert.Equal(categoriaGlobal.Id, resultado.CategoriaId);
    }

    [Fact]
    public async Task AtualizarAsync_CategoriaDeOutroUsuario_LancaKeyNotFoundException_NaoPersisteAlteracao()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        var outroUsuarioId = Guid.NewGuid();

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = contaId,
            Descricao = "Original",
            Valor = 100,
            Tipo = TipoTransacao.Despesa,
            Data = DateOnly.FromDateTime(DateTime.UtcNow),
            CriadoPor = usuarioId,
        };
        ctx.Transacoes.Add(transacao);
        await ctx.SaveChangesAsync();

        var categoriaDeOutro = new Categoria { Id = Guid.NewGuid(), Descricao = "Privada", Finalidade = Finalidade.Despesa, UsuarioId = outroUsuarioId };
        ctx.Categorias.Add(categoriaDeOutro);
        await ctx.SaveChangesAsync();

        var dados = new Transacao
        {
            Descricao = "Editada", Valor = 999m, Tipo = TipoTransacao.Despesa,
            Data = DateOnly.FromDateTime(DateTime.UtcNow), CategoriaId = categoriaDeOutro.Id,
        };

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.AtualizarAsync(transacao.Id, dados, usuarioId));

        var naoAlterada = await ctx.Transacoes.FindAsync(transacao.Id);
        Assert.Equal("Original", naoAlterada!.Descricao);
        Assert.Equal(100, naoAlterada.Valor);
        Assert.Null(naoAlterada.CategoriaId);
    }

    [Fact]
    public async Task AtualizarAsync_SubcategoriaDeOutroUsuario_LancaKeyNotFoundException()
    {
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        var outroUsuarioId = Guid.NewGuid();

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(), ContaId = contaId, Descricao = "Original", Valor = 100,
            Tipo = TipoTransacao.Despesa, Data = DateOnly.FromDateTime(DateTime.UtcNow), CriadoPor = usuarioId,
        };
        ctx.Transacoes.Add(transacao);

        var categoriaDeOutro = new Categoria { Id = Guid.NewGuid(), Descricao = "Cat", Finalidade = Finalidade.Despesa, UsuarioId = outroUsuarioId };
        var subcategoriaDeOutro = new Subcategoria { Id = Guid.NewGuid(), Nome = "Sub", CategoriaId = categoriaDeOutro.Id, UsuarioId = outroUsuarioId };
        ctx.Categorias.Add(categoriaDeOutro);
        ctx.Subcategorias.Add(subcategoriaDeOutro);
        await ctx.SaveChangesAsync();

        var dados = new Transacao
        {
            Descricao = "Editada", Valor = 100, Tipo = TipoTransacao.Despesa,
            Data = DateOnly.FromDateTime(DateTime.UtcNow), SubcategoriaId = subcategoriaDeOutro.Id,
        };

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.AtualizarAsync(transacao.Id, dados, usuarioId));
    }

    [Fact]
    public async Task AtualizarAsync_OcorrenciaDeContaFixa_MarcaEditadaPeloUsuario_LancamentoComumNao()
    {
        // A marca é o que faz alterar a conta fixa / realinhar preservarem a edição (P2-4 do motor).
        var (ctx, svc) = Build();
        var (contaId, usuarioId) = await SeedConta(ctx);
        var hoje = DateOnly.FromDateTime(DateTime.UtcNow);
        Transacao Nova(Guid? recorrente) => new()
        {
            Id = Guid.NewGuid(), ContaId = contaId, Descricao = "X", Valor = 100, Tipo = TipoTransacao.Despesa,
            Data = hoje.AddDays(5), CriadoPor = usuarioId, StatusTransacao = StatusTransacao.Previsao,
            RecorrenteOrigemId = recorrente,
        };
        var ocorrencia = Nova(Guid.NewGuid());
        var comum = Nova(null);
        ctx.Transacoes.AddRange(ocorrencia, comum);
        await ctx.SaveChangesAsync();
        var edicao = new Transacao { Descricao = "Y", Valor = 80, Tipo = TipoTransacao.Despesa, Data = hoje.AddDays(6) };

        await svc.AtualizarAsync(ocorrencia.Id, edicao, usuarioId);
        await svc.AtualizarAsync(comum.Id, edicao, usuarioId);

        ctx.ChangeTracker.Clear();
        Assert.True((await ctx.Transacoes.SingleAsync(t => t.Id == ocorrencia.Id)).EditadaPeloUsuario);
        Assert.False((await ctx.Transacoes.SingleAsync(t => t.Id == comum.Id)).EditadaPeloUsuario);
    }
}
