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
        new(ctx, TestHelpers.Notif(ctx), TestHelpers.EventLog(ctx));

    private static Guid SeedUsuario(AppDbContext ctx, string email, string nome = "User")
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = email, Nome = nome, PasswordHash = "x" };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u.Id;
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
