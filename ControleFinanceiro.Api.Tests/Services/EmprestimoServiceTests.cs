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

    private static Guid SeedBanco(AppDbContext ctx, string nome = "Nubank", bool ativo = true)
    {
        var b = new Banco
        {
            Id = Guid.NewGuid(), Nome = nome, Tipo = TipoBanco.Fintech, Ativo = ativo,
            LogoUrl = "https://logo.test/nu.png", Cor = "#820AD1",
        };
        ctx.Bancos.Add(b);
        ctx.SaveChanges();
        return b.Id;
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
    public async Task CriarAsync_ComBancoValido_VinculaBancoEOrigemManual()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var usuarioId = Guid.NewGuid();
        var bancoId = SeedBanco(ctx, "Nubank");
        var dto = DtoValido();
        dto.BancoId = bancoId;

        var resultado = await svc.CriarAsync(dto, usuarioId);

        Assert.Equal(bancoId, resultado.BancoId);
        Assert.Equal("Nubank", resultado.BancoNome);
        Assert.Equal("#820AD1", resultado.BancoCor);
        Assert.Equal((int)OrigemEmprestimo.Manual, resultado.Origem);
    }

    [Fact]
    public async Task CriarAsync_BancoInexistente_LancaException()
    {
        var svc = NewSvc(CreateContext());
        var dto = DtoValido();
        dto.BancoId = Guid.NewGuid();

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(dto, Guid.NewGuid()));
        Assert.Contains("Banco", ex.Message);
    }

    [Fact]
    public async Task CriarAsync_BancoInativo_LancaException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var bancoId = SeedBanco(ctx, "Banco Morto", ativo: false);
        var dto = DtoValido();
        dto.BancoId = bancoId;

        await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(dto, Guid.NewGuid()));
    }

    [Fact]
    public async Task CriarAsync_SemBanco_OrigemManualEBancoNulo()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);

        var resultado = await svc.CriarAsync(DtoValido(), Guid.NewGuid());

        Assert.Null(resultado.BancoId);
        Assert.Null(resultado.BancoNome);
        Assert.Equal((int)OrigemEmprestimo.Manual, resultado.Origem);
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

    // ── Quitação ─────────────────────────────────────────────────────────────

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

    /// <summary>Achado do Gustavo (2026-08-13): empréstimo quitado na marra continuava mostrando
    /// "Aguardando sua aprovação" — solicitação Pendente esquecida nunca era resolvida. Quitar agora
    /// rejeita automaticamente qualquer solicitação Pendente, com motivo explícito.</summary>
    [Fact]
    public async Task Quitar_RejeitaAutomaticamenteSolicitacoesPendentesEsquecidas()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoParceladoAsync(ctx, svc);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);

        var solicitacao = (await svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
        {
            Valor = 50, ContaId = contaId, CategoriaId = categoriaId, Data = DateTime.UtcNow,
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, devedorId)).Single();

        await svc.QuitarAsync(emprestimoId, credorId);

        var solicitacaoDepois = await ctx.EmprestimoPagamentoSolicitacoes.FindAsync(solicitacao.Id);
        Assert.Equal(StatusAprovacaoPagamentoEmprestimo.Rejeitada, solicitacaoDepois!.StatusAprovacao);
        Assert.NotNull(solicitacaoDepois.MotivoRejeicao);
    }

    // ── Arquivar ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Arquivar_NaoQuitado_LancaArgumentException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var usuarioId = Guid.NewGuid();
        var criado = await svc.CriarAsync(DtoValido(), usuarioId);

        await Assert.ThrowsAsync<ArgumentException>(() => svc.ArquivarAsync(criado.Id, usuarioId));
    }

    [Fact]
    public async Task Arquivar_EsondeDaListagemSoDoLadoDeQuemArquivou()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoParceladoAsync(ctx, svc, quantidade: 2);
        await svc.QuitarAsync(emprestimoId, credorId);

        var ok = await svc.ArquivarAsync(emprestimoId, credorId);
        Assert.True(ok);

        var listaCredor = await svc.ListarAsync(credorId);
        Assert.DoesNotContain(listaCredor.Items, e => e.Id == emprestimoId);

        var listaCredorComArquivados = await svc.ListarAsync(credorId, incluirArquivados: true);
        Assert.Contains(listaCredorComArquivados.Items, e => e.Id == emprestimoId && e.Arquivado);

        var listaDevedor = await svc.ListarAsync(devedorId);
        Assert.Contains(listaDevedor.Items, e => e.Id == emprestimoId && !e.Arquivado); // lado dela intacto
    }

    [Fact]
    public async Task Desarquivar_VoltaAAparecerNaListagemPrincipal()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var usuarioId = Guid.NewGuid();
        var criado = await svc.CriarAsync(DtoValido(), usuarioId);
        await svc.QuitarAsync(criado.Id, usuarioId);
        await svc.ArquivarAsync(criado.Id, usuarioId);

        var ok = await svc.DesarquivarAsync(criado.Id, usuarioId);
        Assert.True(ok);

        var lista = await svc.ListarAsync(usuarioId);
        Assert.Contains(lista.Items, e => e.Id == criado.Id);
    }

    [Fact]
    public async Task Arquivar_EstranhoAoRegistro_RetornaFalse()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var usuarioId = Guid.NewGuid();
        var criado = await svc.CriarAsync(DtoValido(), usuarioId);
        await svc.QuitarAsync(criado.Id, usuarioId);

        var ok = await svc.ArquivarAsync(criado.Id, Guid.NewGuid());
        Assert.False(ok);
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
    public async Task DeletarAsync_VinculadoSemAtividade_SoftDeletaNaoRemove()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var criado = await svc.CriarAsync(DtoValido(), credorId);

        var link = await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("devedor@x.com"), credorId);
        var token = link.LinkConvite.Split('/').Last();
        await svc.AceitarVinculoAsync(token, devedorId);

        var ok = await svc.DeletarAsync(criado.Id, credorId);

        Assert.True(ok);
        var linha = await ctx.Emprestimos.FirstOrDefaultAsync(e => e.Id == criado.Id);
        Assert.NotNull(linha);
        Assert.False(linha!.Ativo);
    }

    [Fact]
    public async Task DeletarAsync_VinculadoComSolicitacaoPendente_LancaForbidden()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var criado = await svc.CriarAsync(DtoValido(), credorId);

        var link = await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("devedor@x.com"), credorId);
        var token = link.LinkConvite.Split('/').Last();
        await svc.AceitarVinculoAsync(token, devedorId);

        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        await svc.SolicitarPagamentoAsync(criado.Id, SolicitarDtoValido(contaId, categoriaId), devedorId);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() => svc.DeletarAsync(criado.Id, credorId));
    }

    [Fact]
    public async Task DeletarAsync_VinculadoComSolicitacaoRejeitada_LancaForbidden()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var criado = await svc.CriarAsync(DtoValido(), credorId);

        var link = await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("devedor@x.com"), credorId);
        var token = link.LinkConvite.Split('/').Last();
        await svc.AceitarVinculoAsync(token, devedorId);

        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        var solicitacao = (await svc.SolicitarPagamentoAsync(criado.Id, SolicitarDtoValido(contaId, categoriaId), devedorId)).Single();
        await svc.RejeitarPagamentoSolicitacaoAsync(solicitacao.Id, new RejeitarPagamentoEmprestimoDto(), credorId);

        // mesmo rejeitada, a solicitação é rastro real que o devedor viu — continua bloqueando.
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
    public async Task Quitar_TipoEmprestei_SoCredorCriadorConfirma()
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
            () => svc.QuitarAsync(criado.Id, devedorId));

        // Credor (criador) confirma normalmente.
        var ok = await svc.QuitarAsync(criado.Id, credorId);
        Assert.True(ok);
    }

    [Fact]
    public async Task Quitar_TipoPeguiEmprestado_SoCredorContraparteConfirma()
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
    public async Task Quitar_AntesDeVincular_SoCriadorConfirma()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var criadorId = SeedUsuario(ctx, "criador@x.com");
        var criado = await svc.CriarAsync(DtoValido(), criadorId);

        // Comportamento preservado: sem vínculo, só o criador existe no registro.
        var ok = await svc.QuitarAsync(criado.Id, criadorId);
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
    public async Task ObterStatsAsync_AVistaVencido_SomaSoOAtrasadoEmTotalAReceberVencido()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var uid = Guid.NewGuid();

        var vencido = NovoDto("Vencido", "X", 300, TipoEmprestimo.Emprestei);
        vencido.DataInicio = DateTime.UtcNow.AddDays(-10);
        vencido.DataVencimento = DateTime.UtcNow.AddDays(-5);
        await svc.CriarAsync(vencido, uid);

        var futuro = NovoDto("Futuro", "Y", 200, TipoEmprestimo.Emprestei);
        futuro.DataVencimento = DateTime.UtcNow.AddDays(5);
        await svc.CriarAsync(futuro, uid);

        var stats = await svc.ObterStatsAsync(uid);

        Assert.Equal(300m, stats.TotalAReceberVencido);
        Assert.Equal(500m, stats.TotalAReceber);
    }

    [Fact]
    public async Task ObterStatsAsync_AVistaVencidoComMulta_SomaValorComMultaNoTotalVencido()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var uid = Guid.NewGuid();
        var dto = DtoValido();
        dto.ValorTotal = 200;
        dto.DataInicio = DateTime.UtcNow.AddDays(-10);
        dto.DataVencimento = DateTime.UtcNow.AddDays(-5);
        dto.PercentualMultaAtraso = 20;
        await svc.CriarAsync(dto, uid);
        await svc.ListarAsync(uid); // dispara o snapshot da multa

        var stats = await svc.ObterStatsAsync(uid);

        Assert.Equal(240m, stats.TotalAReceberVencido); // 200 * 1.20, não só o principal
    }

    [Fact]
    public async Task ObterStatsAsync_ParceladoComParcelaAtrasada_SomaValorDaParcelaVencida()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var uid = Guid.NewGuid();

        var dto = NovoDto("Parcelado", "X", 1000, TipoEmprestimo.Emprestei);
        dto.FormaPagamento = FormaPagamentoEmprestimo.Parcelado;
        dto.QuantidadeParcelas = 2;
        dto.PrimeiroVencimento = DateTime.UtcNow.AddDays(-5); // 1ª parcela vencida, 2ª (+1 mês) ainda não
        await svc.CriarAsync(dto, uid);

        var stats = await svc.ObterStatsAsync(uid);

        Assert.Equal(500m, stats.TotalAReceberVencido); // só a 1ª parcela (500 de 1000/2)
        Assert.Equal(1000m, stats.TotalAReceber); // total inclui as duas parcelas
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
    public async Task BuscarPorIdAsync_ValorPendenteERecusado_RefletemSolicitacoesSemAlterarValorPago()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);

        // Uma solicitação fica Pendente, outra é rejeitada.
        var pendente = (await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId, "chave-pendente"), devedorId)).Single();
        var rejeitada = (await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId, "chave-rejeitada"), devedorId)).Single();
        await svc.RejeitarPagamentoSolicitacaoAsync(rejeitada.Id, new RejeitarPagamentoEmprestimoDto(), credorId);

        var dto = await svc.BuscarPorIdAsync(emprestimoId, credorId);

        Assert.Equal(pendente.Valor, dto!.ValorPendente);
        Assert.Equal(rejeitada.Valor, dto.ValorRecusado);
        Assert.Equal(0, dto.ValorPago); // nenhuma das duas confirmada — saldo real intacto
    }

    [Fact]
    public async Task SolicitarPagamentoAsync_Devedor_CriaSolicitacaoPendente_NaoMexeValorPago()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, _, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);

        var resultado = (await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId)).Single();

        Assert.Equal(1, resultado.StatusAprovacao); // Pendente
        var emprestimo = await ctx.Emprestimos.FindAsync(emprestimoId);
        Assert.Equal(0, emprestimo!.ValorPago);

        var solicitacao = await ctx.EmprestimoPagamentoSolicitacoes.FindAsync(resultado.Id);
        Assert.NotEqual(Guid.Empty, solicitacao!.TransacaoComprovanteId);
        var transacao = await ctx.Transacoes.FindAsync(solicitacao.TransacaoComprovanteId);
        Assert.NotNull(transacao);
        Assert.Equal(TipoTransacao.Despesa, transacao!.Tipo);
    }

    /// <summary>Credor registrando o próprio recebimento (unificado com o fluxo do devedor em
    /// 2026-08-08, achado do Gustavo: dois caminhos diferentes pro mesmo conceito quebrava
    /// usabilidade) — nasce já Aprovada, cria Receita (não Despesa), avança ValorPago na hora,
    /// sem precisar de autoaprovação.</summary>
    [Fact]
    public async Task SolicitarPagamentoAsync_Credor_CriaSolicitacaoJaAprovada_AvancaValorPagoNaHora()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, _) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, categoriaId) = SeedContaECategoriaReceita(ctx, credorId);

        var resultado = (await svc.SolicitarPagamentoAsync(
            emprestimoId, SolicitarDtoValido(contaId, categoriaId), credorId)).Single();

        Assert.Equal(2, resultado.StatusAprovacao); // Aprovada
        Assert.True(resultado.RegistradoPeloCredor);

        var emprestimo = await ctx.Emprestimos.FindAsync(emprestimoId);
        Assert.Equal(100, emprestimo!.ValorPago); // já avançou, sem esperar aprovação de ninguém

        var solicitacao = await ctx.EmprestimoPagamentoSolicitacoes.FindAsync(resultado.Id);
        Assert.Null(solicitacao!.TransacaoComprovanteId); // não existe "saída do devedor" nesse caminho
        Assert.NotNull(solicitacao.TransacaoRecebimentoId);
        var transacao = await ctx.Transacoes.FindAsync(solicitacao.TransacaoRecebimentoId!.Value);
        Assert.Equal(TipoTransacao.Receita, transacao!.Tipo);
    }

    [Fact]
    public async Task SolicitarPagamentoAsync_CredorComParcela_MarcaParcelaPagaNaHora()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var dto = DtoValido();
        dto.FormaPagamento = FormaPagamentoEmprestimo.Parcelado;
        dto.QuantidadeParcelas = 2;
        dto.PrimeiroVencimento = DateTime.UtcNow;
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var criado = await svc.CriarAsync(dto, credorId);
        var link = await svc.VincularAsync(criado.Id, new VincularEmprestimoDto("devedor@x.com"), credorId);
        await svc.AceitarVinculoAsync(link.LinkConvite.Split('/').Last(), devedorId);
        var parcelas = await svc.ListarParcelasAsync(criado.Id, credorId);
        var (contaId, categoriaId) = SeedContaECategoriaReceita(ctx, credorId);

        await svc.SolicitarPagamentoAsync(criado.Id, new SolicitarPagamentoEmprestimoDto
        {
            Valor = parcelas[0].Valor,
            ContaId = contaId,
            CategoriaId = categoriaId,
            Data = DateTime.UtcNow,
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, credorId);

        var parcela = await ctx.EmprestimoParcelas.FindAsync(parcelas[0].Id);
        Assert.Equal(StatusParcelaEmprestimo.Paga, parcela!.Status);
    }

    /// <summary>Empréstimo sem vínculo (registro solo, sem contraparte) — o criador é sempre
    /// "credor" (EhCredor), então registra normalmente, já aprovado, sem tentar notificar
    /// ninguém (não existe devedor real pra avisar).</summary>
    [Fact]
    public async Task SolicitarPagamentoAsync_SemVinculo_RegistraComoCredorSemNotificar()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var usuarioId = SeedUsuario(ctx, "solo@x.com");
        var criado = await svc.CriarAsync(DtoValido(), usuarioId);
        var (contaId, categoriaId) = SeedContaECategoriaReceita(ctx, usuarioId);

        var resultado = (await svc.SolicitarPagamentoAsync(criado.Id, SolicitarDtoValido(contaId, categoriaId), usuarioId)).Single();

        Assert.Equal(2, resultado.StatusAprovacao); // Aprovada
        var emprestimo = await ctx.Emprestimos.FindAsync(criado.Id);
        Assert.Equal(100, emprestimo!.ValorPago);
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

        var resultado = (await svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
        {
            TransacaoExistenteId = despesa.Id,
            Data = DateTime.UtcNow,
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, devedorId)).Single();

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

        var primeira = (await svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
        {
            TransacaoExistenteId = despesa.Id, Data = DateTime.UtcNow, IdempotencyKey = Guid.NewGuid().ToString(),
        }, devedorId)).Single();
        await svc.RejeitarPagamentoSolicitacaoAsync(primeira.Id, new RejeitarPagamentoEmprestimoDto(), credorId);

        var segunda = (await svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
        {
            TransacaoExistenteId = despesa.Id, Data = DateTime.UtcNow, IdempotencyKey = Guid.NewGuid().ToString(),
        }, devedorId)).Single();

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
        var solicitacao = (await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaDevedorId, categoriaId), devedorId)).Single();

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
        var solicitacao = (await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId)).Single();

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
        var solicitacao = (await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaDevedorId, categoriaId), devedorId)).Single();
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
        var solicitacao = (await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaDevedorId, categoriaId), devedorId)).Single();
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
        var solicitacao = (await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId)).Single();

        var ok = await svc.RejeitarPagamentoSolicitacaoAsync(solicitacao.Id, new RejeitarPagamentoEmprestimoDto(), credorId);

        Assert.True(ok);
        var emprestimo = await ctx.Emprestimos.FindAsync(emprestimoId);
        Assert.Equal(0, emprestimo!.ValorPago);
        var linha = await ctx.EmprestimoPagamentoSolicitacoes.FindAsync(solicitacao.Id);
        Assert.Equal(StatusAprovacaoPagamentoEmprestimo.Rejeitada, linha!.StatusAprovacao);
    }

    [Fact]
    public async Task RejeitarPagamentoSolicitacaoAsync_ComMotivo_GravaEDevolveNoHistorico()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        var solicitacao = (await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId)).Single();

        await svc.RejeitarPagamentoSolicitacaoAsync(solicitacao.Id,
            new RejeitarPagamentoEmprestimoDto { Motivo = "Valor não bateu com o combinado" }, credorId);

        var linha = await ctx.EmprestimoPagamentoSolicitacoes.FindAsync(solicitacao.Id);
        Assert.Equal("Valor não bateu com o combinado", linha!.MotivoRejeicao);

        var historico = await svc.ListarSolicitacoesAsync(emprestimoId, devedorId);
        Assert.Equal("Valor não bateu com o combinado", historico.Single().MotivoRejeicao);
    }

    [Fact]
    public async Task RejeitarPagamentoSolicitacaoAsync_SemMotivo_FicaNulo()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        var solicitacao = (await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId)).Single();

        await svc.RejeitarPagamentoSolicitacaoAsync(solicitacao.Id, new RejeitarPagamentoEmprestimoDto(), credorId);

        var linha = await ctx.EmprestimoPagamentoSolicitacoes.FindAsync(solicitacao.Id);
        Assert.Null(linha!.MotivoRejeicao);
    }

    [Fact]
    public async Task AvaliarPagamento_Devedor_LancaForbidden()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, _, devedorId) = await CriarVinculadoAsync(ctx, svc);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        var solicitacao = (await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId)).Single();

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
        var solicitacao = (await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId)).Single();
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
        var solicitacao = (await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId)).Single();
        var (contaCredorId, categoriaReceitaId) = SeedContaECategoriaReceita(ctx, credorId);
        await svc.AprovarPagamentoSolicitacaoAsync(solicitacao.Id, AprovarDtoValido(contaCredorId, categoriaReceitaId), credorId);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.RejeitarPagamentoSolicitacaoAsync(solicitacao.Id, new RejeitarPagamentoEmprestimoDto(), credorId));
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

        var solicitacao = (await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId)).Single();
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

        var r1 = (await svc.SolicitarPagamentoAsync(emprestimoId, dto, devedorId)).Single();
        var r2 = (await svc.SolicitarPagamentoAsync(emprestimoId, dto, devedorId)).Single();

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
        var solicitacao = (await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId)).Single();
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
        var solicitacao = (await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId)).Single();
        await svc.RejeitarPagamentoSolicitacaoAsync(solicitacao.Id, new RejeitarPagamentoEmprestimoDto(), credorId);

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
        var solicitacao = (await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId)).Single();

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
        var solicitacao = (await svc.SolicitarPagamentoAsync(emprestimoId, SolicitarDtoValido(contaId, categoriaId), devedorId)).Single();
        await svc.RejeitarPagamentoSolicitacaoAsync(solicitacao.Id, new RejeitarPagamentoEmprestimoDto(), credorId);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            svc.ReenviarPagamentoSolicitacaoAsync(solicitacao.Id, credorId));
    }

    // ── Forma de pagamento — parcelas (docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md) ──

    [Fact]
    public async Task CriarAsync_Parcelado_GeraParcelas_ValorSomaBateComTotal()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var dto = DtoValido();
        dto.ValorTotal = 100;
        dto.FormaPagamento = FormaPagamentoEmprestimo.Parcelado;
        dto.QuantidadeParcelas = 3;
        dto.PrimeiroVencimento = new DateTime(2026, 9, 1);

        var criado = await svc.CriarAsync(dto, Guid.NewGuid());

        var parcelas = await ctx.EmprestimoParcelas
            .Where(p => p.EmprestimoId == criado.Id).OrderBy(p => p.Numero).ToListAsync();
        Assert.Equal(3, parcelas.Count);
        Assert.Equal(100, parcelas.Sum(p => p.Valor)); // ajuste de centavos na última, sem sobra nem falta
        Assert.Equal(1, parcelas[0].Numero);
        Assert.Equal(3, parcelas[0].QuantidadeTotal);
        Assert.Equal(parcelas[0].DataVencimento.AddMonths(1), parcelas[1].DataVencimento);
        Assert.Equal(3, criado.QuantidadeParcelas);
        Assert.Equal((int)FormaPagamentoEmprestimo.Parcelado, criado.FormaPagamento);
    }

    [Fact]
    public async Task CriarAsync_Parcelado_ComJuros_CalculaValorComJurosSobreValorDaParcela()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var dto = DtoValido();
        dto.ValorTotal = 200;
        dto.FormaPagamento = FormaPagamentoEmprestimo.Parcelado;
        dto.QuantidadeParcelas = 2;
        dto.PrimeiroVencimento = DateTime.UtcNow;
        dto.TaxaJuroMensal = 10; // 10% sobre o valor de cada parcela (decisão do Gustavo, não sobre saldo devedor)

        var criado = await svc.CriarAsync(dto, Guid.NewGuid());

        var parcelas = await ctx.EmprestimoParcelas
            .Where(p => p.EmprestimoId == criado.Id).OrderBy(p => p.Numero).ToListAsync();
        Assert.Equal(100, parcelas[0].Valor);
        Assert.Equal(110, parcelas[0].ValorComJuros);
        Assert.Equal(110, parcelas[1].ValorComJuros); // simples por parcela, sem efeito cascata
    }

    /// <summary>À vista com juros também suportado (achado do Gustavo, 2026-08-08: "juros ao mes
    /// e multa por atraso tambem deve ter pra forma de pagamento a vista") — mesma regra flat do
    /// Parcelado, só que sobre o total inteiro em vez de por parcela.</summary>
    [Fact]
    public async Task CriarAsync_AVista_ComJuros_CalculaValorComJurosSobreOTotal()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var dto = DtoValido();
        dto.ValorTotal = 200;
        dto.TaxaJuroMensal = 10; // 10% sobre o total, uma vez, sem compor

        var criado = await svc.CriarAsync(dto, Guid.NewGuid());

        Assert.Equal(220, criado.ValorComJuros);
        Assert.Null(criado.ValorComMulta); // ainda não venceu
    }

    [Fact]
    public async Task CriarAsync_AVista_SemJuros_ValorComJurosFicaNull()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);

        var criado = await svc.CriarAsync(DtoValido(), Guid.NewGuid());

        Assert.Null(criado.ValorComJuros);
    }

    [Fact]
    public async Task ListarAsync_AVistaVencidoComMulta_SnapshotaValorComMultaUmaVez()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var uid = Guid.NewGuid();
        var dto = DtoValido();
        dto.ValorTotal = 200;
        dto.DataInicio = DateTime.UtcNow.AddDays(-10);
        dto.DataVencimento = DateTime.UtcNow.AddDays(-5); // já vencido
        dto.PercentualMultaAtraso = 20;
        await svc.CriarAsync(dto, uid);

        var pagina1 = await svc.ListarAsync(uid);
        Assert.Equal(240, pagina1.Items.Single().ValorComMulta); // 200 * 1.20

        // Muda a multa configurada depois — não deveria alterar o snapshot já feito.
        var emprestimo = await ctx.Emprestimos.FirstAsync();
        emprestimo.PercentualMultaAtraso = 50;
        await ctx.SaveChangesAsync();

        var pagina2 = await svc.ListarAsync(uid);
        Assert.Equal(240, pagina2.Items.Single().ValorComMulta); // continua o mesmo snapshot
    }

    [Fact]
    public async Task ListarAsync_AVistaAindaNaoVencido_NaoAplicaMulta()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var uid = Guid.NewGuid();
        var dto = DtoValido();
        dto.DataVencimento = DateTime.UtcNow.AddDays(5); // ainda não venceu
        dto.PercentualMultaAtraso = 20;
        await svc.CriarAsync(dto, uid);

        var pagina = await svc.ListarAsync(uid);

        Assert.Null(pagina.Items.Single().ValorComMulta);
    }

    [Fact]
    public async Task CriarAsync_Parcelado_SemQuantidade_LancaArgumentException()
    {
        var svc = NewSvc(CreateContext());
        var dto = DtoValido();
        dto.FormaPagamento = FormaPagamentoEmprestimo.Parcelado;
        dto.PrimeiroVencimento = DateTime.UtcNow;

        await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(dto, Guid.NewGuid()));
    }

    [Fact]
    public async Task CriarAsync_Parcelado_SemPrimeiroVencimento_LancaArgumentException()
    {
        var svc = NewSvc(CreateContext());
        var dto = DtoValido();
        dto.FormaPagamento = FormaPagamentoEmprestimo.Parcelado;
        dto.QuantidadeParcelas = 3;

        await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(dto, Guid.NewGuid()));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(37)]
    public async Task CriarAsync_Parcelado_QuantidadeForaDoRange_LancaArgumentException(int quantidade)
    {
        var svc = NewSvc(CreateContext());
        var dto = DtoValido();
        dto.FormaPagamento = FormaPagamentoEmprestimo.Parcelado;
        dto.QuantidadeParcelas = quantidade;
        dto.PrimeiroVencimento = DateTime.UtcNow;

        await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(dto, Guid.NewGuid()));
    }

    [Fact]
    public async Task CriarAsync_AVista_NaoGeraParcelas()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var criado = await svc.CriarAsync(DtoValido(), Guid.NewGuid());

        Assert.Equal(0, await ctx.EmprestimoParcelas.CountAsync(p => p.EmprestimoId == criado.Id));
        Assert.Null(criado.QuantidadeParcelas);
        Assert.Equal((int)FormaPagamentoEmprestimo.AVista, criado.FormaPagamento);
    }

    /// <summary>Empréstimo Parcelado, vinculado, pronto pra testar solicitar/aprovar por parcela.</summary>
    private static async Task<(Guid emprestimoId, Guid credorId, Guid devedorId)> CriarVinculadoParceladoAsync(
        AppDbContext ctx, EmprestimoService svc, int quantidade = 2,
        DateTime? primeiroVencimento = null, decimal? percentualMultaAtraso = null)
    {
        var credorId = SeedUsuario(ctx, $"credor-{Guid.NewGuid()}@x.com");
        var devedorId = SeedUsuario(ctx, $"devedor-{Guid.NewGuid()}@x.com");
        var dto = DtoValido();
        dto.ValorTotal = 200;
        dto.FormaPagamento = FormaPagamentoEmprestimo.Parcelado;
        dto.QuantidadeParcelas = quantidade;
        dto.PrimeiroVencimento = primeiroVencimento ?? DateTime.UtcNow.AddDays(30);
        dto.PercentualMultaAtraso = percentualMultaAtraso;

        var criado = await svc.CriarAsync(dto, credorId);
        var link = await svc.VincularAsync(criado.Id, new VincularEmprestimoDto(
            (await ctx.Usuarios.FindAsync(devedorId))!.Email), credorId);
        await svc.AceitarVinculoAsync(link.LinkConvite.Split('/').Last(), devedorId);

        return (criado.Id, credorId, devedorId);
    }

    [Fact]
    public async Task SolicitarPagamentoAsync_ComParcelaId_LigaParcela_NaoMarcaPagaAinda()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, _, devedorId) = await CriarVinculadoParceladoAsync(ctx, svc);
        var parcela = await ctx.EmprestimoParcelas
            .Where(p => p.EmprestimoId == emprestimoId).OrderBy(p => p.Numero).FirstAsync();
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);

        var resultado = (await svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
        {
            Valor = parcela.Valor, ContaId = contaId, CategoriaId = categoriaId, Data = DateTime.UtcNow,
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, devedorId)).Single();

        var solicitacao = await ctx.EmprestimoPagamentoSolicitacoes.FindAsync(resultado.Id);
        Assert.Equal(parcela.Id, solicitacao!.ParcelaId);
        Assert.Equal(parcela.Id, resultado.ParcelaId); // DTO expõe ParcelaId — front filtra histórico por parcela
        var parcelaDepois = await ctx.EmprestimoParcelas.FindAsync(parcela.Id);
        Assert.Equal(StatusParcelaEmprestimo.Pendente, parcelaDepois!.Status); // só vira Paga na aprovação
    }

    /// <summary>Sem escolha manual de parcela (2026-08-12) — um segundo pagamento do mesmo valor
    /// não trava mais esperando a mesma parcela: pula pra próxima pendente sem solicitação ativa,
    /// mesmo princípio de amortização em sequência.</summary>
    [Fact]
    public async Task SolicitarPagamentoAsync_ParcelaJaTemSolicitacaoAtiva_PulaPraProximaPendente()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, _, devedorId) = await CriarVinculadoParceladoAsync(ctx, svc, quantidade: 2);
        var parcela1 = await ctx.EmprestimoParcelas
            .Where(p => p.EmprestimoId == emprestimoId).OrderBy(p => p.Numero).FirstAsync();
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);

        var primeira = (await svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
        {
            Valor = parcela1.Valor, ContaId = contaId, CategoriaId = categoriaId, Data = DateTime.UtcNow,
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, devedorId)).Single();

        var segunda = (await svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
        {
            Valor = parcela1.Valor, ContaId = contaId, CategoriaId = categoriaId, Data = DateTime.UtcNow,
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, devedorId)).Single();

        Assert.NotEqual(primeira.ParcelaId, segunda.ParcelaId);
    }

    /// <summary>Se nenhuma parcela pendente-sem-solicitação-ativa é coberta por completo pelo
    /// valor (todas já ocupadas, ou valor não fecha nenhuma), a chamada falha alto em vez de
    /// silenciosamente não fazer nada.</summary>
    [Fact]
    public async Task SolicitarPagamentoAsync_ValorNaoCobreNenhumaParcelaPendente_LancaArgumentException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, _, devedorId) = await CriarVinculadoParceladoAsync(ctx, svc, quantidade: 2);
        var emprestimo = await ctx.Emprestimos.FindAsync(emprestimoId);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);

        // Cobre as 2 parcelas de uma vez com o valor total — não sobra nenhuma pendente.
        await svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
        {
            Valor = emprestimo!.ValorTotal, ContaId = contaId, CategoriaId = categoriaId, Data = DateTime.UtcNow,
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, devedorId);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
            {
                Valor = 50, ContaId = contaId, CategoriaId = categoriaId, Data = DateTime.UtcNow,
                IdempotencyKey = Guid.NewGuid().ToString(),
            }, devedorId));
    }

    /// <summary>O caso real que motivou o redesenho (achado do Gustavo, 2026-08-12): "associação de
    /// uma entrada de 200 numa parcela de 50, não dava pra colocar outra sendo que esse 200 dava pra
    /// pagar tudo". Um valor que cobre N parcelas de uma vez gera N solicitações numa chamada só,
    /// em sequência (mais antiga primeiro) — mesmo princípio de amortização bancária real.</summary>
    [Fact]
    public async Task SolicitarPagamentoAsync_ValorCobreVariasParcelas_CriaUmaSolicitacaoPorParcelaEmSequencia()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, _, devedorId) = await CriarVinculadoParceladoAsync(ctx, svc, quantidade: 4);
        // ValorTotal padrão (200) / 4 = 50 por parcela.
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);

        var resultado = await svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
        {
            Valor = 200, ContaId = contaId, CategoriaId = categoriaId, Data = DateTime.UtcNow,
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, devedorId);

        Assert.Equal(4, resultado.Count);
        var parcelas = await ctx.EmprestimoParcelas
            .Where(p => p.EmprestimoId == emprestimoId).OrderBy(p => p.Numero).ToListAsync();
        Assert.All(parcelas, p => Assert.Equal(StatusParcelaEmprestimo.Pendente, p.Status)); // só vira Paga na aprovação (devedor)
        Assert.Equal(parcelas.Select(p => p.Id).ToArray(), resultado.Select(r => r.ParcelaId!.Value).ToArray());
        Assert.Equal(4, await ctx.EmprestimoPagamentoSolicitacoes.CountAsync());
    }

    /// <summary>Sobra que não fecha uma parcela inteira entra como adiantamento parcial nela —
    /// mesma lógica de pagar uma fatura de cartão antes de fechar (achado do Gustavo, 2026-08-13:
    /// "ela poderia pagar uma parte da outra parcela com esses 50 poderia não?"). Nada se perde.</summary>
    [Fact]
    public async Task SolicitarPagamentoAsync_ValorCobreParcialmenteAProximaParcela_AplicaComoAdiantamento()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, _, devedorId) = await CriarVinculadoParceladoAsync(ctx, svc, quantidade: 4);
        // 4 parcelas de 50 — 120 cobre 2 inteiras (100) e mais 20 de adiantamento na 3ª.
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);

        var resultado = await svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
        {
            Valor = 120, ContaId = contaId, CategoriaId = categoriaId, Data = DateTime.UtcNow,
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, devedorId);

        Assert.Equal(3, resultado.Count); // 2 solicitações cheias + 1 parcial
        Assert.Equal(120, resultado.Sum(r => r.Valor)); // valor todo aplicado, nada descartado
        Assert.Equal(20, resultado.Last().Valor); // a parcial, na 3ª parcela

        var parcelas = await ctx.EmprestimoParcelas
            .Where(p => p.EmprestimoId == emprestimoId).OrderBy(p => p.Numero).ToListAsync();
        Assert.Equal(0, parcelas[0].ValorPago); // devedor: ValorPago só muda na aprovação
        Assert.Equal(0, parcelas[2].ValorPago);
    }

    /// <summary>Pagar mais do que resta em todas as parcelas pendentes falha alto em vez de sumir
    /// com o excedente.</summary>
    [Fact]
    public async Task SolicitarPagamentoAsync_ValorMaiorQueTotalDasParcelasPendentes_LancaArgumentException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, _, devedorId) = await CriarVinculadoParceladoAsync(ctx, svc, quantidade: 2);
        var emprestimo = await ctx.Emprestimos.FindAsync(emprestimoId);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
            {
                Valor = emprestimo!.ValorTotal + 50, ContaId = contaId, CategoriaId = categoriaId,
                Data = DateTime.UtcNow, IdempotencyKey = Guid.NewGuid().ToString(),
            }, devedorId));
        Assert.Contains("maior que o total", ex.Message);
    }

    /// <summary>Credor path: pagamento parcial avança ValorPago da parcela e do empréstimo na hora
    /// (auto-aprovado), mas não fecha (Status continua Pendente) enquanto não cobrir tudo.</summary>
    [Fact]
    public async Task SolicitarPagamentoAsync_CredorPagaParcial_AtualizaValorPagoSemFecharParcela()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, _) = await CriarVinculadoParceladoAsync(ctx, svc, quantidade: 4);
        var (contaId, categoriaId) = SeedContaECategoriaReceita(ctx, credorId);

        var resultado = (await svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
        {
            Valor = 20, ContaId = contaId, CategoriaId = categoriaId, Data = DateTime.UtcNow,
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, credorId)).Single();

        var parcela1 = await ctx.EmprestimoParcelas
            .Where(p => p.EmprestimoId == emprestimoId).OrderBy(p => p.Numero).FirstAsync();
        Assert.Equal(20, parcela1.ValorPago);
        Assert.Equal(StatusParcelaEmprestimo.Pendente, parcela1.Status); // 20 de 50, ainda não fechou
        Assert.Equal(20, resultado.Valor);
        var emprestimo = await ctx.Emprestimos.FindAsync(emprestimoId);
        Assert.Equal(20, emprestimo!.ValorPago);
    }

    /// <summary>Um segundo adiantamento na mesma parcela (já com Aprovada anterior) completa o que
    /// falta e fecha — confirma que solicitação Aprovada não bloqueia mais re-mirar a mesma parcela
    /// (só a Pendente/não-confirmada bloqueia).</summary>
    [Fact]
    public async Task SolicitarPagamentoAsync_SegundoAdiantamentoFechaParcelaQueJaTinhaParcial()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, _) = await CriarVinculadoParceladoAsync(ctx, svc, quantidade: 4);
        var (contaId, categoriaId) = SeedContaECategoriaReceita(ctx, credorId);

        await svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
        {
            Valor = 20, ContaId = contaId, CategoriaId = categoriaId, Data = DateTime.UtcNow,
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, credorId);

        await svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
        {
            Valor = 30, ContaId = contaId, CategoriaId = categoriaId, Data = DateTime.UtcNow,
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, credorId);

        var parcela1 = await ctx.EmprestimoParcelas
            .Where(p => p.EmprestimoId == emprestimoId).OrderBy(p => p.Numero).FirstAsync();
        Assert.Equal(50, parcela1.ValorPago);
        Assert.Equal(StatusParcelaEmprestimo.Paga, parcela1.Status);
        var emprestimo = await ctx.Emprestimos.FindAsync(emprestimoId);
        Assert.Equal(50, emprestimo!.ValorPago);
    }

    /// <summary>Mesmo cenário do achado real, mas do lado do credor (souCredor) — auto-aprovado,
    /// avança ValorPago e marca as parcelas cobertas como Paga na hora, sem esperar ninguém.</summary>
    [Fact]
    public async Task SolicitarPagamentoAsync_CredorComValorMaiorQueParcela_MarcaVariasParcelasPagasNaHora()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, _) = await CriarVinculadoParceladoAsync(ctx, svc, quantidade: 4);
        var (contaId, categoriaId) = SeedContaECategoriaReceita(ctx, credorId);

        var resultado = await svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
        {
            Valor = 100, ContaId = contaId, CategoriaId = categoriaId, Data = DateTime.UtcNow,
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, credorId);

        Assert.Equal(2, resultado.Count);
        Assert.All(resultado, r => Assert.Equal(2, r.StatusAprovacao)); // Aprovada
        var parcelasPagas = await ctx.EmprestimoParcelas
            .Where(p => p.EmprestimoId == emprestimoId && p.Status == StatusParcelaEmprestimo.Paga).CountAsync();
        Assert.Equal(2, parcelasPagas);
        var emprestimo = await ctx.Emprestimos.FindAsync(emprestimoId);
        Assert.Equal(100, emprestimo!.ValorPago);
    }

    [Fact]
    public async Task AprovarPagamentoSolicitacaoAsync_ComParcela_MarcaParcelaPaga()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoParceladoAsync(ctx, svc);
        var parcela = await ctx.EmprestimoParcelas
            .Where(p => p.EmprestimoId == emprestimoId).OrderBy(p => p.Numero).FirstAsync();
        var (contaDevedorId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        var (contaCredorId, categoriaReceitaId) = SeedContaECategoriaReceita(ctx, credorId);

        var solicitacao = (await svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
        {
            Valor = parcela.Valor, ContaId = contaDevedorId, CategoriaId = categoriaId, Data = DateTime.UtcNow,
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, devedorId)).Single();

        await svc.AprovarPagamentoSolicitacaoAsync(solicitacao.Id, AprovarDtoValido(contaCredorId, categoriaReceitaId), credorId);

        var parcelaDepois = await ctx.EmprestimoParcelas.FindAsync(parcela.Id);
        Assert.Equal(StatusParcelaEmprestimo.Paga, parcelaDepois!.Status);
        Assert.Equal(solicitacao.Id, parcelaDepois.SolicitacaoPagamentoId);
    }

    /// <summary>Aprovar um adiantamento parcial do devedor soma no ValorPago da parcela, mas não
    /// fecha (Status continua Pendente) enquanto não cobrir tudo.</summary>
    [Fact]
    public async Task AprovarPagamentoSolicitacaoAsync_ComParcelaParcial_SomaValorPagoSemFechar()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoParceladoAsync(ctx, svc); // 2x100
        var parcela = await ctx.EmprestimoParcelas
            .Where(p => p.EmprestimoId == emprestimoId).OrderBy(p => p.Numero).FirstAsync();
        var (contaDevedorId, categoriaId) = SeedContaECategoria(ctx, devedorId);
        var (contaCredorId, categoriaReceitaId) = SeedContaECategoriaReceita(ctx, credorId);

        var solicitacao = (await svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
        {
            Valor = 20, ContaId = contaDevedorId, CategoriaId = categoriaId, Data = DateTime.UtcNow,
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, devedorId)).Single();

        await svc.AprovarPagamentoSolicitacaoAsync(solicitacao.Id, AprovarDtoValido(contaCredorId, categoriaReceitaId), credorId);

        var parcelaDepois = await ctx.EmprestimoParcelas.FindAsync(parcela.Id);
        Assert.Equal(20, parcelaDepois!.ValorPago);
        Assert.Equal(StatusParcelaEmprestimo.Pendente, parcelaDepois.Status); // 20 de 100, ainda não fechou
    }

    [Fact]
    public async Task ListarParcelasAsync_RetornaOrdenadoENumeroBate()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, _) = await CriarVinculadoParceladoAsync(ctx, svc, quantidade: 3);

        var parcelas = await svc.ListarParcelasAsync(emprestimoId, credorId);

        Assert.Equal(3, parcelas.Count);
        Assert.Equal(new[] { 1, 2, 3 }, parcelas.Select(p => p.Numero).ToArray());
    }

    [Fact]
    public async Task ListarParcelasAsync_ComSolicitacaoPendente_ExpoeSolicitacaoPendenteIdSoNaParcelaCerta()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, devedorId) = await CriarVinculadoParceladoAsync(ctx, svc, quantidade: 2);
        var (contaId, categoriaId) = SeedContaECategoria(ctx, devedorId);

        var parcelasAntes = await svc.ListarParcelasAsync(emprestimoId, devedorId);
        var parcela1 = parcelasAntes.First(p => p.Numero == 1);

        var solicitacao = (await svc.SolicitarPagamentoAsync(emprestimoId, new SolicitarPagamentoEmprestimoDto
        {
            ContaId = contaId,
            CategoriaId = categoriaId,
            Valor = parcela1.Valor,
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, devedorId)).Single();

        var parcelasDepois = await svc.ListarParcelasAsync(emprestimoId, credorId);
        Assert.Equal(solicitacao.Id, parcelasDepois.First(p => p.Numero == 1).SolicitacaoPendenteId);
        Assert.Null(parcelasDepois.First(p => p.Numero == 2).SolicitacaoPendenteId);
    }

    [Fact]
    public async Task ListarParcelasAsync_Estranho_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, _, _) = await CriarVinculadoParceladoAsync(ctx, svc);
        var estranhoId = SeedUsuario(ctx, "estranho@x.com");

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.ListarParcelasAsync(emprestimoId, estranhoId));
    }

    [Fact]
    public async Task ListarParcelasAsync_ParcelaAtrasadaComMulta_CalculaESnapshotaValor()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var (emprestimoId, credorId, _) = await CriarVinculadoParceladoAsync(
            ctx, svc, quantidade: 2, primeiroVencimento: DateTime.UtcNow.AddDays(-10), percentualMultaAtraso: 5);

        var primeira = await svc.ListarParcelasAsync(emprestimoId, credorId);
        var atrasada = primeira.First(p => p.Numero == 1);
        Assert.True(atrasada.Atrasada);
        Assert.NotNull(atrasada.ValorComMulta);
        Assert.Equal(Math.Round(atrasada.Valor * 1.05m, 2), atrasada.ValorComMulta);
        Assert.False(primeira.First(p => p.Numero == 2).Atrasada); // vencimento no futuro

        // Segunda leitura não recalcula — snapshot congelado na primeira detecção.
        var segunda = await svc.ListarParcelasAsync(emprestimoId, credorId);
        Assert.Equal(atrasada.ValorComMulta, segunda.First(p => p.Numero == 1).ValorComMulta);
    }

    // ── Busca / direção server-side ──────────────────────────────────────────

    [Fact]
    public async Task ListarAsync_Busca_FiltraPorDescricaoOuPessoa()
    {
        using var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var u = SeedUsuario(ctx, "busca@x.com");
        await svc.CriarAsync(NovoDto("Aluguel do mês", "Maria", 100, TipoEmprestimo.Emprestei), u);
        await svc.CriarAsync(NovoDto("Compra do carro", "Pedro", 200, TipoEmprestimo.Emprestei), u);

        var porDescricao = await svc.ListarAsync(u, busca: "alug");
        Assert.Equal(1, porDescricao.Total);
        Assert.Equal("Aluguel do mês", porDescricao.Items.Single().Descricao);

        var porPessoa = await svc.ListarAsync(u, busca: "PEDRO"); // case-insensitive
        Assert.Equal(1, porPessoa.Total);
        Assert.Equal("Compra do carro", porPessoa.Items.Single().Descricao);

        var semMatch = await svc.ListarAsync(u, busca: "zzz");
        Assert.Equal(0, semMatch.Total);
    }

    [Fact]
    public async Task ListarAsync_Direcao_SeparaReceberEPagar()
    {
        using var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var u = SeedUsuario(ctx, "direcao@x.com");
        await svc.CriarAsync(NovoDto("Emprestei pra alguém", "A", 100, TipoEmprestimo.Emprestei), u);
        await svc.CriarAsync(NovoDto("Peguei emprestado", "B", 50, TipoEmprestimo.PeguiEmprestado), u);

        var receber = await svc.ListarAsync(u, direcao: "receber");
        Assert.Equal(1, receber.Total);
        Assert.Equal("Emprestei pra alguém", receber.Items.Single().Descricao);

        var pagar = await svc.ListarAsync(u, direcao: "pagar");
        Assert.Equal(1, pagar.Total);
        Assert.Equal("Peguei emprestado", pagar.Items.Single().Descricao);

        var tudo = await svc.ListarAsync(u);
        Assert.Equal(2, tudo.Total);
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
