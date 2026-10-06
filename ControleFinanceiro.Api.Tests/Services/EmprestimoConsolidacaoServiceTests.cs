using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Emprestimo;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>Unificar/consolidar — credor junta N empréstimos ativos da mesma contraparte
/// vinculada num plano novo, só efetivado depois do devedor aceitar. Spec:
/// docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md § "Unificar/consolidar".</summary>
public class EmprestimoConsolidacaoServiceTests
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
        new(ctx, TestHelpers.Notif(ctx), TestHelpers.EventLog(ctx), new TransacaoService(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx)));

    private static Guid SeedUsuario(AppDbContext ctx, string email, string nome = "User")
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = email, Nome = nome, PasswordHash = "x" };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u.Id;
    }

    /// <summary>Cria + vincula + aceita um empréstimo Emprestei entre um credor e devedor já
    /// existentes — pra montar cenários com múltiplos empréstimos entre o mesmo par.</summary>
    private static async Task<Guid> CriarVinculadoEntreAsync(
        AppDbContext ctx, EmprestimoService svc, Guid credorId, Guid devedorId, decimal valor, string descricao = "Empréstimo")
    {
        var dto = new CriarEmprestimoDto
        {
            Descricao = descricao,
            Pessoa = "Pessoa",
            ValorTotal = valor,
            Tipo = TipoEmprestimo.Emprestei,
            DataInicio = DateTime.UtcNow,
            IdempotencyKey = Guid.NewGuid().ToString(),
        };
        var criado = await svc.CriarAsync(dto, credorId);
        var devedor = (await ctx.Usuarios.FindAsync(devedorId))!;
        var link = await svc.VincularAsync(criado.Id, new VincularEmprestimoDto(devedor.Email), credorId);
        await svc.AceitarVinculoAsync(link.LinkConvite.Split('/').Last(), devedorId);
        return criado.Id;
    }

    private static ProporConsolidacaoDto DtoValido(List<Guid> ids) => new()
    {
        EmprestimoIds = ids,
        Descricao = "Consolidado",
        FormaPagamento = FormaPagamentoEmprestimo.AVista,
    };

    // ── Candidatos ──────────────────────────────────────────────────────────

    [Fact]
    public async Task ListarCandidatosConsolidacaoAsync_2EmprestimosMesmaContraparte_RetornaGrupo()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com", "Credor");
        var devedorId = SeedUsuario(ctx, "devedor@x.com", "Devedor");
        await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 100);
        await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 200);

        var candidatos = await svc.ListarCandidatosConsolidacaoAsync(credorId);

        var grupo = Assert.Single(candidatos);
        Assert.Equal(devedorId, grupo.ContraparteUsuarioId);
        Assert.Equal(2, grupo.Itens.Count);
        Assert.Equal(300, grupo.Itens.Sum(i => i.ValorRestanteSnapshot));
    }

    [Fact]
    public async Task ListarCandidatosConsolidacaoAsync_1SoEmprestimo_NaoAgrupa()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 100);

        var candidatos = await svc.ListarCandidatosConsolidacaoAsync(credorId);

        Assert.Empty(candidatos);
    }

    [Fact]
    public async Task ListarCandidatosConsolidacaoAsync_QuandoSouDevedor_NaoAparece()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 100);
        await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 200);

        var candidatos = await svc.ListarCandidatosConsolidacaoAsync(devedorId);

        Assert.Empty(candidatos); // só quem é credor pode propor
    }

    // ── Propor ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task ProporConsolidacaoAsync_MenosDe2Ids_LancaException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var id1 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 100);

        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => svc.ProporConsolidacaoAsync(DtoValido([id1]), credorId));
        Assert.Contains("pelo menos 2", ex.Message);
    }

    [Fact]
    public async Task ProporConsolidacaoAsync_NaoSouCredor_LancaForbidden()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var id1 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 100);
        var id2 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 200);

        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => svc.ProporConsolidacaoAsync(DtoValido([id1, id2]), devedorId));
    }

    [Fact]
    public async Task ProporConsolidacaoAsync_EmprestimoQuitado_LancaException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var id1 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 100);
        var id2 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 200);
        await svc.QuitarAsync(id1, credorId);

        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => svc.ProporConsolidacaoAsync(DtoValido([id1, id2]), credorId));
        Assert.Contains("quitado", ex.Message);
    }

    [Fact]
    public async Task ProporConsolidacaoAsync_ContrapartesDiferentes_LancaException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedor1Id = SeedUsuario(ctx, "devedor1@x.com");
        var devedor2Id = SeedUsuario(ctx, "devedor2@x.com");
        var id1 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedor1Id, 100);
        var id2 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedor2Id, 200);

        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => svc.ProporConsolidacaoAsync(DtoValido([id1, id2]), credorId));
        Assert.Contains("mesma pessoa", ex.Message);
    }

    [Fact]
    public async Task ProporConsolidacaoAsync_Parcelado_SemQuantidade_LancaException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var id1 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 100);
        var id2 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 200);
        var dto = DtoValido([id1, id2]);
        dto.FormaPagamento = FormaPagamentoEmprestimo.Parcelado;

        await Assert.ThrowsAsync<ArgumentException>(() => svc.ProporConsolidacaoAsync(dto, credorId));
    }

    [Fact]
    public async Task ProporConsolidacaoAsync_JaExisteConsolidacaoPendente_LancaException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var id1 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 100);
        var id2 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 200);
        var id3 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 300);
        await svc.ProporConsolidacaoAsync(DtoValido([id1, id2]), credorId);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.ProporConsolidacaoAsync(DtoValido([id2, id3]), credorId));
    }

    [Fact]
    public async Task ProporConsolidacaoAsync_DadosValidos_CriaPropostaENotifica()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com", "Credor");
        var devedorId = SeedUsuario(ctx, "devedor@x.com", "Devedor");
        var id1 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 100);
        var id2 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 200);

        var resultado = await svc.ProporConsolidacaoAsync(DtoValido([id1, id2]), credorId);

        Assert.Equal(300, resultado.ValorTotalProposto);
        Assert.Equal((int)StatusConsolidacaoEmprestimo.Pendente, resultado.Status);
        Assert.True(resultado.SouCredor);
        Assert.Equal(2, resultado.Itens.Count);
        Assert.Equal(1, await ctx.EmprestimoConsolidacaoPropostas.CountAsync());
        Assert.Equal(1, await ctx.Notificacoes.CountAsync(n => n.UsuarioId == devedorId && n.Tipo == TipoNotificacao.EmprestimoConsolidacaoProposta));
        Assert.True(await ctx.FinancialEventLogs.AnyAsync(e => e.Tipo == FinancialEventType.EmprestimoConsolidacaoProposta));
    }

    // ── Aceitar ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task AceitarConsolidacaoAsync_Credor_LancaForbidden()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var id1 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 100);
        var id2 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 200);
        var proposta = await svc.ProporConsolidacaoAsync(DtoValido([id1, id2]), credorId);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() => svc.AceitarConsolidacaoAsync(proposta.Id, credorId));
    }

    [Fact]
    public async Task AceitarConsolidacaoAsync_Estranho_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var estranhoId = SeedUsuario(ctx, "estranho@x.com");
        var id1 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 100);
        var id2 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 200);
        var proposta = await svc.ProporConsolidacaoAsync(DtoValido([id1, id2]), credorId);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.AceitarConsolidacaoAsync(proposta.Id, estranhoId));
    }

    [Fact]
    public async Task AceitarConsolidacaoAsync_AVista_CriaNovoEQuitaOriginais()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com", "Credor");
        var devedorId = SeedUsuario(ctx, "devedor@x.com", "Devedor");
        var id1 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 100, "Empréstimo 1");
        var id2 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 200, "Empréstimo 2");
        var proposta = await svc.ProporConsolidacaoAsync(DtoValido([id1, id2]), credorId);

        var novo = await svc.AceitarConsolidacaoAsync(proposta.Id, devedorId);

        Assert.Equal(300, novo.ValorTotal);
        Assert.False(novo.Quitado);

        var original1 = await ctx.Emprestimos.FindAsync(id1);
        var original2 = await ctx.Emprestimos.FindAsync(id2);
        Assert.True(original1!.Quitado);
        Assert.True(original2!.Quitado);
        Assert.Equal(novo.Id, original1.ConsolidadoNoEmprestimoId);
        Assert.Equal(novo.Id, original2.ConsolidadoNoEmprestimoId);
        Assert.True(original1.ArquivadoPorCriador);
        Assert.True(original1.ArquivadoPorContraparte);
        Assert.True(original2.ArquivadoPorCriador);
        Assert.True(original2.ArquivadoPorContraparte);

        var propostaAtualizada = await ctx.EmprestimoConsolidacaoPropostas.FindAsync(proposta.Id);
        Assert.Equal(StatusConsolidacaoEmprestimo.Aceita, propostaAtualizada!.Status);
        Assert.Equal(novo.Id, propostaAtualizada.EmprestimoConsolidadoId);

        Assert.True(await ctx.FinancialEventLogs.AnyAsync(e => e.Tipo == FinancialEventType.EmprestimoConsolidacaoAceita));
        Assert.True(await ctx.FinancialEventLogs.AnyAsync(e => e.Tipo == FinancialEventType.EmprestimoCriado && e.EntidadeId == novo.Id));
        Assert.Equal(2, await ctx.FinancialEventLogs.CountAsync(e => e.Tipo == FinancialEventType.EmprestimoQuitado
            && (e.EntidadeId == id1 || e.EntidadeId == id2)));
        Assert.Equal(1, await ctx.Notificacoes.CountAsync(n => n.UsuarioId == credorId && n.Tipo == TipoNotificacao.EmprestimoConsolidacaoRespondida));
    }

    [Fact]
    public async Task AceitarConsolidacaoAsync_Parcelado_GeraParcelasComValorCorreto()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var id1 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 100);
        var id2 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 200);
        var dto = DtoValido([id1, id2]);
        dto.FormaPagamento = FormaPagamentoEmprestimo.Parcelado;
        dto.QuantidadeParcelas = 3;
        dto.PrimeiroVencimento = DateTime.UtcNow.AddDays(30);
        var proposta = await svc.ProporConsolidacaoAsync(dto, credorId);

        var novo = await svc.AceitarConsolidacaoAsync(proposta.Id, devedorId);

        var parcelas = await ctx.EmprestimoParcelas.Where(p => p.EmprestimoId == novo.Id).ToListAsync();
        Assert.Equal(3, parcelas.Count);
        Assert.Equal(300, parcelas.Sum(p => p.Valor));
    }

    [Fact]
    public async Task AceitarConsolidacaoAsync_NaoPendente_LancaException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var id1 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 100);
        var id2 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 200);
        var proposta = await svc.ProporConsolidacaoAsync(DtoValido([id1, id2]), credorId);
        await svc.AceitarConsolidacaoAsync(proposta.Id, devedorId);

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.AceitarConsolidacaoAsync(proposta.Id, devedorId));
    }

    [Fact]
    public async Task AceitarConsolidacaoAsync_OriginalMudouEstadoDesdeAProposta_LancaException()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var id1 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 100);
        var id2 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 200);
        var proposta = await svc.ProporConsolidacaoAsync(DtoValido([id1, id2]), credorId);
        // credor quita id1 por fora enquanto a proposta ainda tá pendente
        await svc.QuitarAsync(id1, credorId);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.AceitarConsolidacaoAsync(proposta.Id, devedorId));
        Assert.Contains("mudou de estado", ex.Message);
    }

    // ── Recusar ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task RecusarConsolidacaoAsync_ComMotivo_NaoTocaOriginais()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var id1 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 100);
        var id2 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 200);
        var proposta = await svc.ProporConsolidacaoAsync(DtoValido([id1, id2]), credorId);

        await svc.RecusarConsolidacaoAsync(proposta.Id, new RecusarConsolidacaoDto { Motivo = "Prefiro pagar separado" }, devedorId);

        var atualizada = await ctx.EmprestimoConsolidacaoPropostas.FindAsync(proposta.Id);
        Assert.Equal(StatusConsolidacaoEmprestimo.Recusada, atualizada!.Status);
        Assert.Equal("Prefiro pagar separado", atualizada.MotivoRecusa);

        var original1 = await ctx.Emprestimos.FindAsync(id1);
        Assert.False(original1!.Quitado);
        Assert.False(original1.ArquivadoPorCriador);
        Assert.True(await ctx.FinancialEventLogs.AnyAsync(e => e.Tipo == FinancialEventType.EmprestimoConsolidacaoRecusada));
    }

    [Fact]
    public async Task RecusarConsolidacaoAsync_Credor_LancaForbidden()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var id1 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 100);
        var id2 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 200);
        var proposta = await svc.ProporConsolidacaoAsync(DtoValido([id1, id2]), credorId);

        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => svc.RecusarConsolidacaoAsync(proposta.Id, new RecusarConsolidacaoDto(), credorId));
    }

    // ── Cancelar ────────────────────────────────────────────────────────────

    [Fact]
    public async Task CancelarConsolidacaoAsync_Credor_Cancela()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var id1 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 100);
        var id2 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 200);
        var proposta = await svc.ProporConsolidacaoAsync(DtoValido([id1, id2]), credorId);

        await svc.CancelarConsolidacaoAsync(proposta.Id, credorId);

        var atualizada = await ctx.EmprestimoConsolidacaoPropostas.FindAsync(proposta.Id);
        Assert.Equal(StatusConsolidacaoEmprestimo.Cancelada, atualizada!.Status);
        Assert.True(await ctx.FinancialEventLogs.AnyAsync(e => e.Tipo == FinancialEventType.EmprestimoConsolidacaoCancelada));
    }

    [Fact]
    public async Task CancelarConsolidacaoAsync_Devedor_LancaForbidden()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var id1 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 100);
        var id2 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 200);
        var proposta = await svc.ProporConsolidacaoAsync(DtoValido([id1, id2]), credorId);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() => svc.CancelarConsolidacaoAsync(proposta.Id, devedorId));
    }

    // ── Listar ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListarConsolidacoesAsync_MostraProsDoisLados_ComSouCredorCorreto()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var id1 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 100);
        var id2 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 200);
        var proposta = await svc.ProporConsolidacaoAsync(DtoValido([id1, id2]), credorId);

        var doCredor = await svc.ListarConsolidacoesAsync(credorId);
        var doDevedor = await svc.ListarConsolidacoesAsync(devedorId);

        Assert.Equal(proposta.Id, Assert.Single(doCredor).Id);
        Assert.True(Assert.Single(doCredor).SouCredor);
        Assert.Equal(proposta.Id, Assert.Single(doDevedor).Id);
        Assert.False(Assert.Single(doDevedor).SouCredor);
    }

    [Fact]
    public async Task ListarConsolidacoesAsync_Estranho_NaoAparece()
    {
        var ctx = CreateContext();
        var svc = NewSvc(ctx);
        var credorId = SeedUsuario(ctx, "credor@x.com");
        var devedorId = SeedUsuario(ctx, "devedor@x.com");
        var estranhoId = SeedUsuario(ctx, "estranho@x.com");
        var id1 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 100);
        var id2 = await CriarVinculadoEntreAsync(ctx, svc, credorId, devedorId, 200);
        await svc.ProporConsolidacaoAsync(DtoValido([id1, id2]), credorId);

        var lista = await svc.ListarConsolidacoesAsync(estranhoId);

        Assert.Empty(lista);
    }
}
