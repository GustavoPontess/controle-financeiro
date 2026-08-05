using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Emprestimo;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class EmprestimoServiceTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static EmprestimoService NewSvc(AppDbContext ctx) =>
        new(ctx, TestHelpers.Notif(ctx), TestHelpers.EventLog(ctx), new TransacaoService(ctx, new FaturaService(ctx)));

    private static Guid SeedUsuario(AppDbContext ctx, string email, string nome = "User")
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = email, Nome = nome, PasswordHash = "x" };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u.Id;
    }

    private static (Guid contaId, Guid categoriaId) SeedContaECategoria(AppDbContext ctx, Guid usuarioId)
    {
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Conta", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuarioId };
        var categoria = new Categoria { Id = Guid.NewGuid(), Descricao = "Outros", Finalidade = Finalidade.Despesa };
        ctx.Contas.Add(conta);
        ctx.Categorias.Add(categoria);
        ctx.SaveChanges();
        return (conta.Id, categoria.Id);
    }

    /// <summary>Conta + categoria de Receita — pra aprovar pagamento (Tipo=Receita) na conta do credor.</summary>
    private static (Guid contaId, Guid categoriaId) SeedContaECategoriaReceita(AppDbContext ctx, Guid usuarioId)
    {
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Conta", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuarioId };
        var categoria = new Categoria { Id = Guid.NewGuid(), Descricao = "Outros", Finalidade = Finalidade.Receita };
        ctx.Contas.Add(conta);
        ctx.Categorias.Add(categoria);
        ctx.SaveChanges();
        return (conta.Id, categoria.Id);
    }

    private static SolicitarPagamentoEmprestimoDto SolicitarDtoValido(Guid contaId, Guid categoriaId, string? key = null) => new()
    {
        Valor = 100,
        ContaId = contaId,
        CategoriaId = categoriaId,
        Data = DateTime.UtcNow,
        IdempotencyKey = key ?? Guid.NewGuid().ToString(),
    };

    /// <summary>Empréstimo vinculado (Emprestei, credorId=criador) pronto pra testar pagamento/aprovação.</summary>
    private static async Task<(Guid emprestimoId, Guid credorId, Guid devedorId)> CriarVinculadoAsync(
        AppDbContext ctx, EmprestimoService svc, TipoEmprestimo tipo = TipoEmprestimo.Emprestei)
    {
        var credorId = tipo == TipoEmprestimo.Emprestei ? SeedUsuario(ctx, $"credor-{Guid.NewGuid()}@x.com") : Guid.Empty;
        var devedorId = tipo == TipoEmprestimo.Emprestei ? SeedUsuario(ctx, $"devedor-{Guid.NewGuid()}@x.com") : Guid.Empty;

        // Pra PeguiEmprestado, quem cria é o devedor e a contraparte vinculada é o credor real.
        var criadorId = tipo == TipoEmprestimo.Emprestei ? credorId : SeedUsuario(ctx, $"criador-{Guid.NewGuid()}@x.com");
        var contraparteId = tipo == TipoEmprestimo.Emprestei ? devedorId : SeedUsuario(ctx, $"contraparte-{Guid.NewGuid()}@x.com");

        var dto = DtoValido();
        dto.Tipo = tipo;
        var criado = await svc.CriarAsync(dto, criadorId);
        var link = await svc.VincularAsync(criado.Id, new VincularEmprestimoDto(
            (await ctx.Usuarios.FindAsync(contraparteId))!.Email), criadorId);
        await svc.AceitarVinculoAsync(link.LinkConvite.Split('/').Last(), contraparteId);

        return tipo == TipoEmprestimo.Emprestei
            ? (criado.Id, criadorId, contraparteId)
            : (criado.Id, contraparteId, criadorId); // PeguiEmprestado: contraparte vinculada é a credora
    }

    private static CriarEmprestimoDto DtoValido(string? key = null) => new()
    {
        Descricao = "Empréstimo para João",
        Pessoa = "João",
        ValorTotal = 500,
        Tipo = TipoEmprestimo.Emprestei,
        DataInicio = DateTime.UtcNow,
        DataVencimento = DateTime.UtcNow.AddDays(30),
        IdempotencyKey = key ?? Guid.NewGuid().ToString(),
    };

    // ── Criar ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CriarAsync_ValorZero_LancaException()
    {
        var svc = NewSvc(CreateContext());
        var dto = DtoValido();
        dto.ValorTotal = 0;

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(dto, Guid.NewGuid()));
        Assert.Contains("positivo", ex.Message);
    }

    [Fact]
    public async Task CriarAsync_ValorNegativo_LancaException()
    {
        var svc = NewSvc(CreateContext());
        var dto = DtoValido();
        dto.ValorTotal = -100;

        await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(dto, Guid.NewGuid()));
    }

    [Fact]
    public async Task CriarAsync_DataVencimentoAnteriorInicio_LancaException()
    {
        var svc = NewSvc(CreateContext());
        var dto = DtoValido();
        dto.DataInicio = DateTime.UtcNow;
        dto.DataVencimento = DateTime.UtcNow.AddDays(-1);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(dto, Guid.NewGuid()));
        Assert.Contains("anterior", ex.Message);
    }

    [Fact]
    public async Task CriarAsync_SemIdempotencyKey_LancaException()
    {
        var svc = NewSvc(CreateContext());
        var dto = DtoValido();
        dto.IdempotencyKey = "";

        await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(dto, Guid.NewGuid()));
    }

    [Fact]
    public async Task CriarAsync_DadosValidos_CriaSucesso()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var usuarioId = Guid.NewGuid();

        var resultado = await svc.CriarAsync(DtoValido(), usuarioId);

        Assert.Equal(500, resultado.ValorTotal);
        Assert.Equal(0, resultado.ValorPago);
        Assert.False(resultado.Quitado);
        Assert.True(resultado.SouCredor); // criador, Emprestei, sem vínculo ainda
        Assert.Equal(1, await ctx.Emprestimos.CountAsync());
    }

    [Fact]
    public async Task CriarAsync_SemDataVencimento_CriaSucesso()
    {
        var svc = NewSvc(CreateContext());
        var dto = DtoValido();
        dto.DataVencimento = null;

        var resultado = await svc.CriarAsync(dto, Guid.NewGuid());

        Assert.Null(resultado.DataVencimento);
        Assert.False(resultado.Vencido);
    }

    [Fact]
    public async Task CriarAsync_ReplayMesmaIdempotencyKey_NaoDuplica()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var usuarioId = Guid.NewGuid();
        var dto = DtoValido("chave-fixa-123");

        var primeiro = await svc.CriarAsync(dto, usuarioId);
        var segundo = await svc.CriarAsync(dto, usuarioId);

        Assert.Equal(primeiro.Id, segundo.Id);
        Assert.Equal(1, await ctx.Emprestimos.CountAsync());
    }

    [Fact]
    public async Task CriarAsync_GravaFinancialEventLog()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var criado = await svc.CriarAsync(DtoValido(), Guid.NewGuid());

        var log = await ctx.FinancialEventLogs.FirstOrDefaultAsync(l => l.EntidadeId == criado.Id
            && l.Tipo == FinancialEventType.EmprestimoCriado);
        Assert.NotNull(log);
    }

    [Fact]
    public async Task CriarAsync_VinculaTransacaoExistente_NaoCriaNova()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var usuarioId = Guid.NewGuid();
        var (contaId, _) = SeedContaECategoria(ctx, usuarioId);
        var despesa = SeedDespesaExistente(ctx, usuarioId, contaId, 500);
        var totalAntes = await ctx.Transacoes.CountAsync();

        var dto = DtoValido(); // Tipo = Emprestei → espera Despesa
        dto.TransacaoExistenteId = despesa.Id;
        var criado = await svc.CriarAsync(dto, usuarioId);

        Assert.Equal(despesa.Id, criado.TransacaoId);
        Assert.Equal(totalAntes, await ctx.Transacoes.CountAsync());
    }

    [Fact]
    public async Task CriarAsync_TransacaoExistenteTipoErrado_LancaArgumentException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var usuarioId = Guid.NewGuid();
        var (contaId, categoriaReceitaId) = SeedContaECategoriaReceita(ctx, usuarioId);
        var receita = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Receita", Valor = 100, Tipo = TipoTransacao.Receita,
            ContaId = contaId, CategoriaId = categoriaReceitaId, Data = DateTime.UtcNow, CriadoPor = usuarioId,
        };
        ctx.Transacoes.Add(receita);
        await ctx.SaveChangesAsync();

        var dto = DtoValido(); // Tipo = Emprestei → espera Despesa, não Receita
        dto.TransacaoExistenteId = receita.Id;

        await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(dto, usuarioId));
    }

    [Fact]
    public async Task CriarAsync_TransacaoJaVinculadaOutroEmprestimo_LancaInvalidOperationException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var usuarioId = Guid.NewGuid();
        var (contaId, _) = SeedContaECategoria(ctx, usuarioId);
        var despesa = SeedDespesaExistente(ctx, usuarioId, contaId);

        var dto1 = DtoValido();
        dto1.TransacaoExistenteId = despesa.Id;
        await svc.CriarAsync(dto1, usuarioId);

        var dto2 = DtoValido("outra-chave");
        dto2.TransacaoExistenteId = despesa.Id;
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.CriarAsync(dto2, usuarioId));
    }

    // ── Pagamento / Quitação ─────────────────────────────────────────────────

    [Fact]
    public async Task RegistrarPagamentoAsync_ValorZero_LancaException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var usuarioId = Guid.NewGuid();
        var resultado = await svc.CriarAsync(DtoValido(), usuarioId);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.RegistrarPagamentoAsync(resultado.Id, 0, usuarioId));
        Assert.Contains("positivo", ex.Message);
    }

    [Fact]
    public async Task RegistrarPagamentoAsync_ValorNegativo_LancaException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var usuarioId = Guid.NewGuid();
        var resultado = await svc.CriarAsync(DtoValido(), usuarioId);

        await Assert.ThrowsAsync<ArgumentException>(() => svc.RegistrarPagamentoAsync(resultado.Id, -50, usuarioId));
    }

    [Fact]
    public async Task RegistrarPagamentoAsync_ValorParcial_AtualizaValorPago()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var usuarioId = Guid.NewGuid();
        var criado = await svc.CriarAsync(DtoValido(), usuarioId);

        await svc.RegistrarPagamentoAsync(criado.Id, 200, usuarioId);

        var emprestimo = await ctx.Emprestimos.FindAsync(criado.Id);
        Assert.Equal(200, emprestimo!.ValorPago);
        Assert.False(emprestimo.Quitado);
    }

    [Fact]
    public async Task RegistrarPagamentoAsync_ValorTotal_QuitaEmprestimo()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var usuarioId = Guid.NewGuid();
        var criado = await svc.CriarAsync(DtoValido(), usuarioId);

        await svc.RegistrarPagamentoAsync(criado.Id, 500, usuarioId);

        var emprestimo = await ctx.Emprestimos.FindAsync(criado.Id);
        Assert.True(emprestimo!.Quitado);
        Assert.Equal(500, emprestimo.ValorPago);
    }

    [Fact]
    public async Task RegistrarPagamentoAsync_Estranho_RetornaFalse()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var criado = await svc.CriarAsync(DtoValido(), Guid.NewGuid());

        var ok = await svc.RegistrarPagamentoAsync(criado.Id, 100, Guid.NewGuid());

        Assert.False(ok); // não existe pra esse usuário — 404, não confirma existência
    }

    [Fact]
    public async Task Pagamento_GravaFinancialEventLog()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var usuarioId = Guid.NewGuid();
        var criado = await svc.CriarAsync(DtoValido(), usuarioId);

        await svc.RegistrarPagamentoAsync(criado.Id, 100, usuarioId);

        var log = await ctx.FinancialEventLogs.FirstOrDefaultAsync(l => l.EntidadeId == criado.Id
            && l.Tipo == FinancialEventType.EmprestimoPagamentoRegistrado);
        Assert.NotNull(log);
    }

    [Fact]
    public async Task Quitar_GravaFinancialEventLog()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var usuarioId = Guid.NewGuid();
        var criado = await svc.CriarAsync(DtoValido(), usuarioId);

        await svc.QuitarAsync(criado.Id, usuarioId);

        var log = await ctx.FinancialEventLogs.FirstOrDefaultAsync(l => l.EntidadeId == criado.Id
            && l.Tipo == FinancialEventType.EmprestimoQuitado);
        Assert.NotNull(log);
    }

    // ── Soft delete ──────────────────────────────────────────────────────────

    [Fact]
    public async Task DeletarAsync_SemVinculo_SoftDeletaNaoRemove()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var usuarioId = Guid.NewGuid();
        var criado = await svc.CriarAsync(DtoValido(), usuarioId);

        var ok = await svc.DeletarAsync(criado.Id, usuarioId);

        Assert.True(ok);
        var linha = await ctx.Emprestimos.FirstOrDefaultAsync(e => e.Id == criado.Id);
        Assert.NotNull(linha); // continua no banco — soft delete, nunca Remove()
        Assert.False(linha!.Ativo);
    }

    [Fact]
    public async Task DeletarAsync_Vinculado_LancaForbidden()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var criado = await svc.CriarAsync(DtoValido(), credorId);

        var link = await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("devedor@x.com"), credorId);
        var token = link.LinkConvite.Split('/').Last();
        await svc.AceitarVinculoAsync(token, devedorId);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() => svc.DeletarAsync(criado.Id, credorId));
    }

    // ── Vínculo — Vincular ───────────────────────────────────────────────────

    [Fact]
    public async Task VincularAsync_NaoCriador_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var criado = await svc.CriarAsync(DtoValido(), Guid.NewGuid());

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.VincularAsync(criado.Id, new VincularEmprestimoDto("x@x.com"), Guid.NewGuid()));
    }

    [Fact]
    public async Task VincularAsync_EmailExistenteOuNao_MesmaFormaDeResposta()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        SeedUsuario(ctx, "existe@x.com");

        var credor1Id = Guid.NewGuid();
        var criado1 = await svc.CriarAsync(DtoValido(), credor1Id);
        var r1 = await svc.VincularAsync(criado1.Id, new VincularEmprestimoDto("existe@x.com"), credor1Id);

        var credor2Id = Guid.NewGuid();
        var criado2 = await svc.CriarAsync(DtoValido(), credor2Id);
        var r2 = await svc.VincularAsync(criado2.Id, new VincularEmprestimoDto("naoexiste@x.com"), credor2Id);

        // Anti-enumeração: os dois retornam o mesmo formato de link, nenhuma exceção diferencia os casos.
        Assert.StartsWith("/convite/emprestimo/", r1.LinkConvite);
        Assert.StartsWith("/convite/emprestimo/", r2.LinkConvite);
    }

    [Fact]
    public async Task VincularAsync_SetaPendenteAceite()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var criado = await svc.CriarAsync(DtoValido(), credorId);

        await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("devedor@x.com"), credorId);

        var linha = await ctx.Emprestimos.FindAsync(criado.Id);
        Assert.Equal(StatusVinculoEmprestimo.PendenteAceite, linha!.StatusVinculo);
        Assert.NotNull(linha.ConviteTokenHash);
        Assert.NotNull(linha.ConviteExpiraEm);
    }

    [Fact]
    public async Task VincularAsync_JaVinculado_LancaInvalidOperation()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var criado = await svc.CriarAsync(DtoValido(), credorId);
        var link = await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("devedor@x.com"), credorId);
        await svc.AceitarVinculoAsync(link.LinkConvite.Split('/').Last(), devedorId);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.VincularAsync(criado.Id, new VincularEmprestimoDto("outro@x.com"), credorId));
    }

    // ── Vínculo — Aceitar / Recusar ──────────────────────────────────────────

    [Fact]
    public async Task AceitarVinculoAsync_EmailErrado_LancaForbidden()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        SeedUsuario(ctx, "devedor@x.com");
        var outraPessoaId = SeedUsuario(ctx, "outra@x.com");
        var criado = await svc.CriarAsync(DtoValido(), credorId);
        var link = await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("devedor@x.com"), credorId);

        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => svc.AceitarVinculoAsync(link.LinkConvite.Split('/').Last(), outraPessoaId));
    }

    [Fact]
    public async Task AceitarVinculoAsync_TokenInvalido_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var usuarioId = SeedUsuario(ctx, "x@x.com");

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.AceitarVinculoAsync("token-que-nao-existe", usuarioId));
    }

    [Fact]
    public async Task ObterConvitePorTokenAsync_EmailCorreto_RetornaDetalhes()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com", "Gustavo");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var criado = await svc.CriarAsync(DtoValido(), credorId);
        var link = await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("devedor@x.com"), credorId);
        var token = link.LinkConvite.Split('/').Last();

        var preview = await svc.ObterConvitePorTokenAsync(token, devedorId);

        Assert.Equal(criado.Id, preview.EmprestimoId);
        Assert.Equal("Gustavo", preview.CredorOuDevedorNome);
        // Não muda estado nenhum — é só leitura.
        var linha = await ctx.Emprestimos.FindAsync(criado.Id);
        Assert.Equal(StatusVinculoEmprestimo.PendenteAceite, linha!.StatusVinculo);
    }

    [Fact]
    public async Task ObterConvitePorTokenAsync_EmailErrado_LancaForbidden()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        SeedUsuario(ctx, "devedor@x.com");
        var outroId = SeedUsuario(ctx, "outro@x.com");
        var criado = await svc.CriarAsync(DtoValido(), credorId);
        var link = await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("devedor@x.com"), credorId);
        var token = link.LinkConvite.Split('/').Last();

        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => svc.ObterConvitePorTokenAsync(token, outroId));
    }

    [Fact]
    public async Task AceitarVinculoAsync_Sucesso_VinculaOsDoisLados()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var criado = await svc.CriarAsync(DtoValido(), credorId);
        var link = await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("devedor@x.com"), credorId);

        await svc.AceitarVinculoAsync(link.LinkConvite.Split('/').Last(), devedorId);

        var linha = await ctx.Emprestimos.FindAsync(criado.Id);
        Assert.Equal(StatusVinculoEmprestimo.Vinculado, linha!.StatusVinculo);
        Assert.Equal(devedorId, linha.ContraparteUsuarioId);
        Assert.Null(linha.ConviteTokenHash); // token de uso único
    }

    [Fact]
    public async Task AceitarVinculoAsync_GravaFinancialEventLog()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var criado = await svc.CriarAsync(DtoValido(), credorId);
        var link = await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("devedor@x.com"), credorId);

        await svc.AceitarVinculoAsync(link.LinkConvite.Split('/').Last(), devedorId);

        var log = await ctx.FinancialEventLogs.FirstOrDefaultAsync(l => l.EntidadeId == criado.Id
            && l.Tipo == FinancialEventType.EmprestimoVinculado);
        Assert.NotNull(log);
    }

    [Fact]
    public async Task RecusarVinculoAsync_Sucesso_VoltaSoDoCriador()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var criado = await svc.CriarAsync(DtoValido(), credorId);
        var link = await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("devedor@x.com"), credorId);

        await svc.RecusarVinculoAsync(link.LinkConvite.Split('/').Last(), devedorId);

        var linha = await ctx.Emprestimos.FindAsync(criado.Id);
        Assert.Equal(StatusVinculoEmprestimo.Recusado, linha!.StatusVinculo);
        Assert.Null(linha.ContraparteUsuarioId);
    }

    [Fact]
    public async Task ListarConvitesPendentesAsync_FiltraPorEmailDoUsuarioLogado()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var outroId = SeedUsuario(ctx, "outro@x.com");
        var criado = await svc.CriarAsync(DtoValido(), credorId);
        await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("devedor@x.com"), credorId);

        var pendentesDevedor = await svc.ListarConvitesPendentesAsync(devedorId);
        var pendentesOutro = await svc.ListarConvitesPendentesAsync(outroId);

        Assert.Single(pendentesDevedor);
        Assert.Empty(pendentesOutro);
    }

    [Fact]
    public async Task AceitarVinculoPorIdAsync_SemToken_FuncionaComEmailBatendo()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var criado = await svc.CriarAsync(DtoValido(), credorId);
        await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("devedor@x.com"), credorId);

        // Aceita pela lista in-app (id), sem token nenhum.
        await svc.AceitarVinculoPorIdAsync(criado.Id, devedorId);

        var linha = await ctx.Emprestimos.FindAsync(criado.Id);
        Assert.Equal(StatusVinculoEmprestimo.Vinculado, linha!.StatusVinculo);
        Assert.Equal(devedorId, linha.ContraparteUsuarioId);
    }

    [Fact]
    public async Task AceitarVinculoPorIdAsync_EmailErrado_LancaForbidden()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        SeedUsuario(ctx, "devedor@x.com");
        var outroId = SeedUsuario(ctx, "outro@x.com");
        var criado = await svc.CriarAsync(DtoValido(), credorId);
        await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("devedor@x.com"), credorId);

        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => svc.AceitarVinculoPorIdAsync(criado.Id, outroId));
    }

    [Fact]
    public async Task RecusarVinculoPorIdAsync_SemToken_Funciona()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var criado = await svc.CriarAsync(DtoValido(), credorId);
        await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("devedor@x.com"), credorId);

        await svc.RecusarVinculoPorIdAsync(criado.Id, devedorId);

        var linha = await ctx.Emprestimos.FindAsync(criado.Id);
        Assert.Equal(StatusVinculoEmprestimo.Recusado, linha!.StatusVinculo);
    }

    // ── Autorização assimétrica de confirmação (o ponto mais fácil de inverter) ─

    [Fact]
    public async Task RegistrarPagamento_TipoEmprestei_SoCredorCriadorConfirma()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com"); // CriadoPor, Tipo=Emprestei => credor
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var dto = DtoValido();
        dto.Tipo = TipoEmprestimo.Emprestei;
        var criado = await svc.CriarAsync(dto, credorId);
        var link = await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("devedor@x.com"), credorId);
        await svc.AceitarVinculoAsync(link.LinkConvite.Split('/').Last(), devedorId);

        // Devedor (contraparte) tentando confirmar -> 403.
        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => svc.RegistrarPagamentoAsync(criado.Id, 100, devedorId));

        // Credor (criador) confirma normalmente.
        var ok = await svc.RegistrarPagamentoAsync(criado.Id, 100, credorId);
        Assert.True(ok);
    }

    [Fact]
    public async Task RegistrarPagamento_TipoPeguiEmprestado_SoCredorContraparteConfirma()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var criadorId = SeedUsuario(ctx, "criador@x.com"); // CriadoPor, Tipo=PeguiEmprestado => devedor
        var credorRealId = SeedUsuario(ctx, "credorreal@x.com"); // contraparte vinculada => credor
        var dto = DtoValido();
        dto.Tipo = TipoEmprestimo.PeguiEmprestado;
        var criado = await svc.CriarAsync(dto, criadorId);
        var link = await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("credorreal@x.com"), criadorId);
        await svc.AceitarVinculoAsync(link.LinkConvite.Split('/').Last(), credorRealId);

        // O CriadoPor (devedor nesse Tipo) NÃO pode mais confirmar sozinho.
        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => svc.QuitarAsync(criado.Id, criadorId));

        // Quem é credor de verdade (a contraparte vinculada) confirma.
        var ok = await svc.QuitarAsync(criado.Id, credorRealId);
        Assert.True(ok);
    }

    [Fact]
    public async Task RegistrarPagamento_AntesDeVincular_SoCriadorConfirma()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var criadorId = SeedUsuario(ctx, "criador@x.com");
        var criado = await svc.CriarAsync(DtoValido(), criadorId);

        // Comportamento preservado: sem vínculo, só o criador existe no registro.
        var ok = await svc.RegistrarPagamentoAsync(criado.Id, 100, criadorId);
        Assert.True(ok);
    }

    // ── Visibilidade após vínculo ────────────────────────────────────────────

    [Fact]
    public async Task ListarAsync_ContrapartVeApósVinculado_EstranhoNaoVe()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var estranhoId = SeedUsuario(ctx, "estranho@x.com");
        var criado = await svc.CriarAsync(DtoValido(), credorId);
        var link = await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("devedor@x.com"), credorId);
        await svc.AceitarVinculoAsync(link.LinkConvite.Split('/').Last(), devedorId);

        var listaDevedor = await svc.ListarAsync(devedorId);
        var listaEstranho = await svc.ListarAsync(estranhoId);

        Assert.Equal(1, listaDevedor.Total);
        Assert.Equal(0, listaEstranho.Total);
    }

    [Fact]
    public async Task BuscarPorIdAsync_ContraparteVePerspectivaInvertida()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var dto = DtoValido();
        dto.Tipo = TipoEmprestimo.Emprestei;
        var criado = await svc.CriarAsync(dto, credorId);
        var link = await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("devedor@x.com"), credorId);
        await svc.AceitarVinculoAsync(link.LinkConvite.Split('/').Last(), devedorId);

        var visaoCredor = await svc.BuscarPorIdAsync(criado.Id, credorId);
        var visaoDevedor = await svc.BuscarPorIdAsync(criado.Id, devedorId);

        Assert.True(visaoCredor!.SouCredor);
        Assert.Equal("Emprestei", visaoCredor.TipoDescricao);

        Assert.False(visaoDevedor!.SouCredor);
        Assert.Equal("Peguei emprestado", visaoDevedor.TipoDescricao);
    }

    // ── Stats (#179) ──────────────────────────────────────────────────────────

    [Fact]
    public async Task ObterStatsAsync_AgregaSomenteDoUsuario()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var uid = Guid.NewGuid();
        var outroUid = Guid.NewGuid();

        // Usuário: 2 emprestou ativos (200 + 300), 1 peguei ativo (500), 1 quitado.
        await svc.CriarAsync(NovoDto("A", "X", 200, TipoEmprestimo.Emprestei), uid);
        await svc.CriarAsync(NovoDto("B", "Y", 300, TipoEmprestimo.Emprestei), uid);
        await svc.CriarAsync(NovoDto("C", "Z", 500, TipoEmprestimo.PeguiEmprestado), uid);
        var quitado = await svc.CriarAsync(NovoDto("D", "W", 100, TipoEmprestimo.Emprestei), uid);
        await svc.QuitarAsync(quitado.Id, uid);

        // Outro usuário — não deve entrar no cálculo.
        await svc.CriarAsync(NovoDto("X", "X", 999, TipoEmprestimo.Emprestei), outroUid);

        var stats = await svc.ObterStatsAsync(uid);

        Assert.Equal(500m, stats.TotalAReceber);   // 200 + 300
        Assert.Equal(500m, stats.TotalAPagar);     // 500
        Assert.Equal(3, stats.Ativos);             // 2 emprestei + 1 peguei (quitado fora)
        Assert.Equal(4, stats.QtdTotal);           // todos do uid, incluindo quitado
    }

    [Fact]
    public async Task ObterStatsAsync_SemEmprestimos_RetornaZero()
    {
        var svc = NewSvc(CreateContext());
        var stats = await svc.ObterStatsAsync(Guid.NewGuid());

        Assert.Equal(0m, stats.TotalAReceber);
        Assert.Equal(0m, stats.TotalAPagar);
        Assert.Equal(0, stats.Ativos);
        Assert.Equal(0, stats.QtdTotal);
    }

    [Fact]
    public async Task ObterStatsAsync_InverteTipoParaContraparte()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var dto = DtoValido();
        dto.Tipo = TipoEmprestimo.Emprestei; // credor emprestou -> pro devedor é "peguei emprestado" (a pagar)
        var criado = await svc.CriarAsync(dto, credorId);
        var link = await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("devedor@x.com"), credorId);
        await svc.AceitarVinculoAsync(link.LinkConvite.Split('/').Last(), devedorId);

        var statsDevedor = await svc.ObterStatsAsync(devedorId);

        Assert.Equal(500m, statsDevedor.TotalAPagar);
        Assert.Equal(0m, statsDevedor.TotalAReceber);
    }

    // ── Pagamento com comprovante + aprovação ───────────────────────────────────

    [Fact]
    public async Task SolicitarPagamentoAsync_Devedor_CriaSolicitacaoPendente_NaoMexeValorPago()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, _, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);

        var resultado = await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId);

        Assert.Equal(1, resultado.StatusAprovacao); // Pendente
        var emprestimo = await ctx.Emprestimos.FindAsync(emprestimoId);
        Assert.Equal(0, emprestimo!.ValorPago);

        var solicitacao = await ctx.EmprestimoPagamentoSolicitacoes.FindAsync(resultado.Id);
        Assert.NotEqual(Guid.Empty, solicitacao!.TransacaoComprovanteId);
        var transacao = await ctx.Transacoes.FindAsync(solicitacao.TransacaoComprovanteId);
        Assert.NotNull(transacao);
        Assert.Equal(TipoTransacao.Despesa, transacao!.Tipo);
    }

    [Fact]
    public async Task SolicitarPagamentoAsync_Credor_LancaForbidden()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, _) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, credorId);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), credorId));
    }

    [Fact]
    public async Task SolicitarPagamentoAsync_SemVinculo_LancaException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var usuarioId = SeedUsuario(ctx, "solo@x.com");
        var criado = await svc.CriarAsync(DtoValido(), usuarioId);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, usuarioId);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.SolicitarPagamentoAsync(criado.Id, SolicitarDtoValido(contaId, categoriaId), usuarioId));
    }

    /// <summary>Simula uma despesa que o devedor já lançou por fora (ex.: viu o Pix sair e
    /// registrou na hora), antes de ir marcar o empréstimo como pago.</summary>
    private static Transacao SeedDespesaExistente(AppDbContext ctx, Guid usuarioId, Guid contaId, decimal valor = 150)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(),
            Descricao = "Despesa já lançada",
            Valor = valor,
            Tipo = TipoTransacao.Despesa,
            ContaId = contaId,
            Data = DateTime.UtcNow,
            CriadoPor = usuarioId,
        };
        ctx.Transacoes.Add(t);
        ctx.SaveChanges();
        return t;
    }

    [Fact]
    public async Task SolicitarPagamentoAsync_VinculaTransacaoExistente_UsaValorDaTransacao_NaoCriaNova()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, _, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, _) = SeedContaECategoria(ctx, devedorId);
        var despesa = SeedDespesaExistente(ctx, devedorId, contaId, 150);
        var totalTransacoesAntes = await ctx.Transacoes.CountAsync();

        var resultado = await svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
        {
            TransacaoExistenteId = despesa.Id,
            Data = DateTime.UtcNow,
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, devedorId);

        Assert.Equal(150, resultado.Valor);
        Assert.Equal(totalTransacoesAntes, await ctx.Transacoes.CountAsync()); // nenhuma nova criada
        var solicitacao = await ctx.EmprestimoPagamentoSolicitacoes.FindAsync(resultado.Id);
        Assert.Equal(despesa.Id, solicitacao!.TransacaoComprovanteId);
    }

    [Fact]
    public async Task SolicitarPagamentoAsync_TransacaoExistenteDeOutroUsuario_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaCredorId, _) = SeedContaECategoria(ctx, credorId);
        var despesaDoCredor = SeedDespesaExistente(ctx, credorId, contaCredorId);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
            {
                TransacaoExistenteId = despesaDoCredor.Id,
                Data = DateTime.UtcNow,
                IdempotencyKey = Guid.NewGuid().ToString(),
            }, devedorId));
    }

    [Fact]
    public async Task SolicitarPagamentoAsync_TransacaoExistenteTipoReceita_LancaArgumentException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, _, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, _) = SeedContaECategoria(ctx, devedorId);
        var receita = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Receita", Valor = 100, Tipo = TipoTransacao.Receita,
            ContaId = contaId, Data = DateTime.UtcNow, CriadoPor = devedorId,
        };
        ctx.Transacoes.Add(receita);
        await ctx.SaveChangesAsync();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
            {
                TransacaoExistenteId = receita.Id,
                Data = DateTime.UtcNow,
                IdempotencyKey = Guid.NewGuid().ToString(),
            }, devedorId));
    }

    [Fact]
    public async Task SolicitarPagamentoAsync_TransacaoJaVinculadaPendente_LancaInvalidOperationException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, _, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, _) = SeedContaECategoria(ctx, devedorId);
        var despesa = SeedDespesaExistente(ctx, devedorId, contaId);

        await svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
        {
            TransacaoExistenteId = despesa.Id, Data = DateTime.UtcNow, IdempotencyKey = Guid.NewGuid().ToString(),
        }, devedorId);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
            {
                TransacaoExistenteId = despesa.Id, Data = DateTime.UtcNow, IdempotencyKey = Guid.NewGuid().ToString(),
            }, devedorId));
    }

    [Fact]
    public async Task SolicitarPagamentoAsync_TransacaoDeSolicitacaoRejeitada_PodeSerReaproveitada()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, _) = SeedContaECategoria(ctx, devedorId);
        var despesa = SeedDespesaExistente(ctx, devedorId, contaId);

        var primeira = await svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
        {
            TransacaoExistenteId = despesa.Id, Data = DateTime.UtcNow, IdempotencyKey = Guid.NewGuid().ToString(),
        }, devedorId);
        await svc.RejeitarPagamentoSolicitacaoAsync(primeira.Id, credorId);

        var segunda = await svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
        {
            TransacaoExistenteId = despesa.Id, Data = DateTime.UtcNow, IdempotencyKey = Guid.NewGuid().ToString(),
        }, devedorId);

        Assert.Equal(despesa.Id, (await ctx.EmprestimoPagamentoSolicitacoes.FindAsync(segunda.Id))!.TransacaoComprovanteId);
    }

    private static AprovarPagamentoEmprestimoDto AprovarDtoValido(Guid contaId, Guid categoriaId) => new()
    {
        ContaId = contaId,
        CategoriaId = categoriaId,
    };

    [Fact]
    public async Task AprovarPagamentoSolicitacaoAsync_Credor_AvancaValorPago_CriaTransacaoRecebimento()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaDevedorId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        var (contaCredorId, categoriaReceitaId) = SeedContaECategoriaReceita(ctx, credorId);
        var solicitacao = await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaDevedorId, categoriaId), devedorId);

        var ok = await svc.AprovarPagamentoSolicitacaoAsync(solicitacao.Id, AprovarDtoValido(contaCredorId, categoriaReceitaId), credorId);

        Assert.True(ok);
        var emprestimo = await ctx.Emprestimos.FindAsync(emprestimoId);
        Assert.Equal(100, emprestimo!.ValorPago);
        var linha = await ctx.EmprestimoPagamentoSolicitacoes.FindAsync(solicitacao.Id);
        Assert.Equal(StatusAprovacaoPagamentoEmprestimo.Aprovada, linha!.StatusAprovacao);
        Assert.Equal(credorId, linha.AprovadoPorUsuarioId);
        Assert.NotNull(linha.TransacaoRecebimentoId);
        var transacaoRecebimento = await ctx.Transacoes.FindAsync(linha.TransacaoRecebimentoId);
        Assert.Equal(TipoTransacao.Receita, transacaoRecebimento!.Tipo);
        Assert.Equal(contaCredorId, transacaoRecebimento.ContaId);
    }

    [Fact]
    public async Task AprovarPagamentoSolicitacaoAsync_SemContaNemTransacaoExistente_LancaArgumentException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        var solicitacao = await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId);

        // Aprovar sem registrar nada não é permitido — credor sempre tem que vincular ou criar.
        await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.AprovarPagamentoSolicitacaoAsync(solicitacao.Id, new AprovarPagamentoEmprestimoDto(), credorId));
    }

    [Fact]
    public async Task AprovarPagamentoSolicitacaoAsync_VinculaTransacaoExistente_NaoCriaNova()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaDevedorId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        var (contaCredorId, categoriaReceitaId) = SeedContaECategoriaReceita(ctx, credorId);
        var solicitacao = await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaDevedorId, categoriaId), devedorId);
        var receitaExistente = SeedDespesaExistente(ctx, credorId, contaCredorId, 100);
        receitaExistente.Tipo = TipoTransacao.Receita;
        receitaExistente.CategoriaId = categoriaReceitaId;
        await ctx.SaveChangesAsync();
        var totalAntes = await ctx.Transacoes.CountAsync();

        var ok = await svc.AprovarPagamentoSolicitacaoAsync(solicitacao.Id,
            new AprovarPagamentoEmprestimoDto { TransacaoExistenteId = receitaExistente.Id }, credorId);

        Assert.True(ok);
        Assert.Equal(totalAntes, await ctx.Transacoes.CountAsync()); // nenhuma nova criada
        var emprestimo = await ctx.Emprestimos.FindAsync(emprestimoId);
        Assert.Equal(100, emprestimo!.ValorPago);
        var linha = await ctx.EmprestimoPagamentoSolicitacoes.FindAsync(solicitacao.Id);
        Assert.Equal(receitaExistente.Id, linha!.TransacaoRecebimentoId);
    }

    [Fact]
    public async Task AprovarPagamentoSolicitacaoAsync_TransacaoExistenteTipoErrado_LancaArgumentException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaDevedorId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        var solicitacao = await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaDevedorId, categoriaId), devedorId);
        var (contaCredorId, _) = SeedContaECategoria(ctx, credorId);
        var despesaDoCredor = SeedDespesaExistente(ctx, credorId, contaCredorId); // Despesa, não Receita

        await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.AprovarPagamentoSolicitacaoAsync(solicitacao.Id,
                new AprovarPagamentoEmprestimoDto { TransacaoExistenteId = despesaDoCredor.Id }, credorId));
    }

    [Fact]
    public async Task RejeitarPagamentoSolicitacaoAsync_Credor_NaoMexeValorPago()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        var solicitacao = await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId);

        var ok = await svc.RejeitarPagamentoSolicitacaoAsync(solicitacao.Id, credorId);

        Assert.True(ok);
        var emprestimo = await ctx.Emprestimos.FindAsync(emprestimoId);
        Assert.Equal(0, emprestimo!.ValorPago);
        var linha = await ctx.EmprestimoPagamentoSolicitacoes.FindAsync(solicitacao.Id);
        Assert.Equal(StatusAprovacaoPagamentoEmprestimo.Rejeitada, linha!.StatusAprovacao);
    }

    [Fact]
    public async Task AvaliarPagamento_Devedor_LancaForbidden()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, _, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        var solicitacao = await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            svc.AprovarPagamentoSolicitacaoAsync(solicitacao.Id, new AprovarPagamentoEmprestimoDto(), devedorId));
    }

    [Fact]
    public async Task AvaliarPagamento_Estranho_RetornaFalse()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, _, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        var solicitacao = await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId);
        var estranhoId = SeedUsuario(ctx, "estranho@x.com");

        var ok = await svc.AprovarPagamentoSolicitacaoAsync(solicitacao.Id, new AprovarPagamentoEmprestimoDto(), estranhoId);

        Assert.False(ok);
    }

    [Fact]
    public async Task AvaliarPagamento_JaAvaliada_LancaException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        var solicitacao = await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId);
        var (contaCredorId, categoriaReceitaId) = SeedContaECategoriaReceita(ctx, credorId);
        await svc.AprovarPagamentoSolicitacaoAsync(solicitacao.Id, AprovarDtoValido(contaCredorId, categoriaReceitaId), credorId);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.RejeitarPagamentoSolicitacaoAsync(solicitacao.Id, credorId));
    }

    [Theory]
    [InlineData(TipoEmprestimo.Emprestei)]
    [InlineData(TipoEmprestimo.PeguiEmprestado)]
    public async Task SolicitarEAprovar_FuncionaParaOsDoisTipos(TipoEmprestimo tipo)
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoAsync(ctx, svc, tipo);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);

        var solicitacao = await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId);
        var (contaCredorId, categoriaReceitaId) = SeedContaECategoriaReceita(ctx, credorId);
        var ok = await svc.AprovarPagamentoSolicitacaoAsync(solicitacao.Id, AprovarDtoValido(contaCredorId, categoriaReceitaId), credorId);

        Assert.True(ok);
        var emprestimo = await ctx.Emprestimos.FindAsync(emprestimoId);
        Assert.Equal(100, emprestimo!.ValorPago);
    }

    [Fact]
    public async Task SolicitarPagamentoAsync_Idempotencia_NaoDuplica()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, _, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        var dto = SolicitarDtoValido(contaId, categoriaId, "chave-fixa-pagamento");

        var r1 = await svc.SolicitarPagamentoAsync(emprestimoId, dto, devedorId);
        var r2 = await svc.SolicitarPagamentoAsync(emprestimoId, dto, devedorId);

        Assert.Equal(r1.Id, r2.Id);
        Assert.Equal(1, await ctx.EmprestimoPagamentoSolicitacoes.CountAsync());
    }

    [Fact]
    public async Task ListarSolicitacoesAsync_VisivelParaOsDoisParticipantes()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId);

        var paraCredor = await svc.ListarSolicitacoesAsync(emprestimoId, credorId);
        var paraDevedor = await svc.ListarSolicitacoesAsync(emprestimoId, devedorId);

        Assert.Single(paraCredor);
        Assert.Single(paraDevedor);
    }

    [Fact]
    public async Task ListarSolicitacoesPendentesAsync_SoParaOCredor()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId);

        var pendentesCredor = await svc.ListarSolicitacoesPendentesAsync(credorId);
        var pendentesDevedor = await svc.ListarSolicitacoesPendentesAsync(devedorId);

        Assert.Single(pendentesCredor);
        Assert.Empty(pendentesDevedor);
    }

    [Fact]
    public async Task AprovarPagamentoSolicitacaoAsync_GravaFinancialEventLog()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        var solicitacao = await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId);
        var (contaCredorId, categoriaReceitaId) = SeedContaECategoriaReceita(ctx, credorId);

        await svc.AprovarPagamentoSolicitacaoAsync(solicitacao.Id, AprovarDtoValido(contaCredorId, categoriaReceitaId), credorId);

        var logSolicitado = await ctx.FinancialEventLogs.FirstOrDefaultAsync(l =>
            l.EntidadeId == solicitacao.Id && l.Tipo == FinancialEventType.EmprestimoPagamentoSolicitado);
        var logAprovado = await ctx.FinancialEventLogs.FirstOrDefaultAsync(l =>
            l.EntidadeId == solicitacao.Id && l.Tipo == FinancialEventType.EmprestimoPagamentoAprovado);
        Assert.NotNull(logSolicitado);
        Assert.NotNull(logAprovado);
    }

    // ── Reenviar após rejeição ───────────────────────────────────────────────────

    [Fact]
    public async Task ReenviarPagamentoSolicitacaoAsync_Devedor_VoltaPendente()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        var solicitacao = await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId);
        await svc.RejeitarPagamentoSolicitacaoAsync(solicitacao.Id, credorId);

        var ok = await svc.ReenviarPagamentoSolicitacaoAsync(solicitacao.Id, devedorId);

        Assert.True(ok);
        var linha = await ctx.EmprestimoPagamentoSolicitacoes.FindAsync(solicitacao.Id);
        Assert.Equal(StatusAprovacaoPagamentoEmprestimo.Pendente, linha!.StatusAprovacao);
        Assert.Null(linha.AprovadoPorUsuarioId);
        Assert.Null(linha.AprovadoEm);
    }

    [Fact]
    public async Task ReenviarPagamentoSolicitacaoAsync_NaoRejeitada_LancaException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, _, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        var solicitacao = await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.ReenviarPagamentoSolicitacaoAsync(solicitacao.Id, devedorId));
    }

    [Fact]
    public async Task ReenviarPagamentoSolicitacaoAsync_NaoSolicitante_LancaForbidden()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        var solicitacao = await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId);
        await svc.RejeitarPagamentoSolicitacaoAsync(solicitacao.Id, credorId);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            svc.ReenviarPagamentoSolicitacaoAsync(solicitacao.Id, credorId));
    }

    // ── helpers de teste ─────────────────────────────────────────────────────

    private static CriarEmprestimoDto NovoDto(string descricao, string pessoa, decimal valor, TipoEmprestimo tipo) => new()
    {
        Descricao = descricao,
        Pessoa = pessoa,
        ValorTotal = valor,
        Tipo = tipo,
        DataInicio = DateTime.UtcNow,
        IdempotencyKey = Guid.NewGuid().ToString(),
    };

}
