using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Solicitacao;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using SkiaSharp;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class SolicitacaoServiceTests
{
    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static (AppDbContext Ctx, SolicitacaoService Servico, Guid U) Seed()
    {
        var ctx = CreateContext();
        var u = new Usuario { Id = Guid.NewGuid(), Email = "ana@t.com", Nome = "Ana", PasswordHash = "x" };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return (ctx, new SolicitacaoService(ctx, new AdminAuditService(ctx),
            new NotificacaoService(ctx, Microsoft.Extensions.Logging.Abstractions.NullLogger<NotificacaoService>.Instance)), u.Id);
    }

    private static CriarSolicitacaoDto Dto(string titulo = "O gráfico some quando toco no mês", int tipo = 1, string tela = "/relatorios?mes=2026-10",
        string? descricao = null, List<AnexoNovoDto>? anexos = null) =>
        new(tipo, titulo, descricao, tela, "390x844", anexos);

    private static AnexoNovoDto Anexo(int tipo = 2, string? textoDoBloco = null, bool mostrar = false, string? imagem = null, string tela = "/dashboard") =>
        new(tipo, tela, tipo == 2 ? "Distribuição da renda" : null, textoDoBloco, mostrar, imagem ?? PngBase64(100, 100));

    [Fact]
    public async Task Criar_GuardaTelaSemQuery_EJanela_SemAnexo_EApareceNasMinhas()
    {
        var (ctx, servico, u) = Seed();

        var criada = await servico.CriarAsync(u, Dto());

        Assert.Equal(("/relatorios", 0, (int)StatusSolicitacao.Recebida), (criada.Tela, criada.Anexos, criada.Status));
        var minhas = await servico.ListarMinhasAsync(u);
        Assert.Single(minhas);
        Assert.Equal("390x844", ctx.Solicitacoes.Single().Janela);
    }

    [Fact]
    public async Task TextoDoBloco_SaiComOsValoresMascarados()
    {
        var (ctx, servico, u) = Seed();

        await servico.CriarAsync(u, Dto(anexos: [Anexo(textoDoBloco: "Sobrou -R$ 1.632,03 · conta 54675255-1 · 12 meses")]));

        var guardado = ctx.SolicitacoesAnexo.Single().TextoDoBloco!;
        Assert.DoesNotContain("1.632,03", guardado);
        Assert.DoesNotContain("54675255", guardado);
        Assert.Contains("R$ ••••", guardado);
        Assert.Contains("12 meses", guardado); // número curto (contagem) fica
    }

    [Theory]
    [InlineData(0)]
    [InlineData(3)]
    public async Task TipoForaDaLista_Recusa(int tipo)
    {
        var (_, servico, u) = Seed();
        await Assert.ThrowsAsync<ArgumentException>(() => servico.CriarAsync(u, Dto(tipo: tipo)));
    }

    [Theory]
    [InlineData("   ")]
    [InlineData("")]
    public async Task TituloVazio_Recusa(string titulo)
    {
        var (_, servico, u) = Seed();
        await Assert.ThrowsAsync<ArgumentException>(() => servico.CriarAsync(u, Dto(titulo: titulo)));
    }

    [Fact]
    public async Task TituloLongo_OuDescricaoLonga_Recusa_EDescricaoLongaDentroDoLimiteFicaInteira()
    {
        var (ctx, servico, u) = Seed();
        await Assert.ThrowsAsync<ArgumentException>(() => servico.CriarAsync(u, Dto(titulo: new string('a', 101))));
        await Assert.ThrowsAsync<ArgumentException>(() => servico.CriarAsync(u, Dto(descricao: new string('a', 2001))));

        var longa = new string('x', 2000);
        await servico.CriarAsync(u, Dto(descricao: longa));
        Assert.Equal(2000, ctx.Solicitacoes.Single().Descricao!.Length);
    }

    [Theory]
    [InlineData("https://outro.site/x")]
    [InlineData("/relatorios<script>")]
    [InlineData("")]
    public async Task TelaQueNaoECaminhoDoApp_Recusa(string tela)
    {
        var (_, servico, u) = Seed();
        await Assert.ThrowsAsync<ArgumentException>(() => servico.CriarAsync(u, Dto(tela: tela)));
    }

    [Fact]
    public async Task PassouDoTetoDoDia_Recusa()
    {
        var (_, servico, u) = Seed();
        for (var i = 0; i < SolicitacaoService.MaximoPorDia; i++)
            await servico.CriarAsync(u, Dto());

        var erro = await Assert.ThrowsAsync<InvalidOperationException>(() => servico.CriarAsync(u, Dto()));
        Assert.Contains("24 horas", erro.Message);
    }

    [Fact]
    public async Task MinhasNaoMostraDeOutraPessoa()
    {
        var (ctx, servico, u) = Seed();
        var outra = new Usuario { Id = Guid.NewGuid(), Email = "bia@t.com", Nome = "Bia", PasswordHash = "x" };
        ctx.Usuarios.Add(outra);
        ctx.SaveChanges();
        await servico.CriarAsync(outra.Id, Dto());

        Assert.Empty(await servico.ListarMinhasAsync(u));
    }

    [Fact]
    public async Task Admin_AtualizaStatusEPrioridade_ComAuditoria_EListaFiltraPorStatus()
    {
        var (ctx, servico, u) = Seed();
        var a = await servico.CriarAsync(u, Dto());
        await servico.CriarAsync(u, Dto(tipo: 2, titulo: "Queria ver a fatura no topo"));
        var admin = Guid.NewGuid();

        var atualizada = await servico.AtualizarAsync(a.Id, new AtualizarSolicitacaoDto((int)StatusSolicitacao.NoBacklog, 1, "vira item do ROADMAP"), admin, "admin@t.com");

        Assert.Equal(((int)StatusSolicitacao.NoBacklog, (int?)1, "Ana"), (atualizada.Status, atualizada.Prioridade, atualizada.NomeUsuario));
        Assert.Contains(ctx.AdminAuditLogs, l => l.Acao == AcaoAdmin.AtualizarSolicitacao && l.AlvoId == a.Id);
        var noBacklog = await servico.ListarAsync(StatusSolicitacao.NoBacklog);
        Assert.Equal(1, noBacklog.Total);
        Assert.Equal(2, (await servico.ListarAsync(null)).Total);
        // A nota do admin não volta pra quem mandou.
        Assert.DoesNotContain(typeof(MinhaSolicitacaoDto).GetProperties(), p => p.Name == "NotaAdmin");
    }

    [Fact]
    public async Task Admin_MudarStatus_AvisaQuemMandou_UmaVezPorStatus_SemANota()
    {
        var (ctx, servico, u) = Seed();
        var a = await servico.CriarAsync(u, Dto(titulo: "Fatura no topo"));
        var admin = Guid.NewGuid();

        // Só prioridade/nota (status igual) não avisa.
        await servico.AtualizarAsync(a.Id, new AtualizarSolicitacaoDto((int)StatusSolicitacao.Recebida, 2, "olhar depois"), admin, "admin@t.com");
        Assert.Empty(ctx.Notificacoes);

        await servico.AtualizarAsync(a.Id, new AtualizarSolicitacaoDto((int)StatusSolicitacao.NoBacklog, 2, "nota interna"), admin, "admin@t.com");
        await servico.AtualizarAsync(a.Id, new AtualizarSolicitacaoDto((int)StatusSolicitacao.Recebida, 2, null), admin, "admin@t.com");
        await servico.AtualizarAsync(a.Id, new AtualizarSolicitacaoDto((int)StatusSolicitacao.NoBacklog, 2, null), admin, "admin@t.com");
        await servico.AtualizarAsync(a.Id, new AtualizarSolicitacaoDto((int)StatusSolicitacao.Feita, 2, null), admin, "admin@t.com");

        var avisos = ctx.Notificacoes.OrderBy(n => n.CriadoEm).ToList();
        Assert.Equal(2, avisos.Count); // vai e volta pra fila não repete o aviso; voltar pra Recebida não avisa
        Assert.All(avisos, n => Assert.Equal((u, TipoNotificacao.SolicitacaoAtualizada), (n.UsuarioId, n.Tipo)));
        Assert.Contains(avisos, n => n.Titulo == "Sua solicitação entrou na fila" && n.Mensagem.Contains("Fatura no topo"));
        Assert.Contains(avisos, n => n.Titulo == "Sua solicitação foi feita");
        Assert.DoesNotContain(avisos, n => n.Mensagem.Contains("nota interna"));
    }

    [Theory]
    [InlineData(9, null)]
    [InlineData(0, 4)]
    public async Task Admin_StatusOuPrioridadeForaDaLista_Recusa(int status, int? prioridade)
    {
        var (_, servico, u) = Seed();
        var a = await servico.CriarAsync(u, Dto());
        await Assert.ThrowsAsync<ArgumentException>(() =>
            servico.AtualizarAsync(a.Id, new AtualizarSolicitacaoDto(status, prioridade, null), Guid.NewGuid(), "admin@t.com"));
    }

    [Fact]
    public async Task Admin_SolicitacaoQueNaoExiste_404()
    {
        var (_, servico, _) = Seed();
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            servico.AtualizarAsync(Guid.NewGuid(), new AtualizarSolicitacaoDto(0, null, null), Guid.NewGuid(), "admin@t.com"));
    }

    private static string PngBase64(int largura, int altura)
    {
        using var bmp = new SKBitmap(largura, altura);
        using (var canvas = new SKCanvas(bmp)) canvas.Clear(SKColors.Orange);
        using var img = SKImage.FromBitmap(bmp);
        using var png = img.Encode(SKEncodedImageFormat.Png, 100);
        return "data:image/png;base64," + Convert.ToBase64String(png.ToArray());
    }

    [Fact]
    public async Task MostrarValores_PorAnexo_GuardaOTextoSemMascara_EASolicitacaoMarcaQueTemValores()
    {
        var (ctx, servico, u) = Seed();

        await servico.CriarAsync(u, Dto(anexos: [Anexo(textoDoBloco: "Sobrou -R$ 1.632,03", mostrar: true), Anexo(textoDoBloco: "Saiu R$ 2.776,03")]));

        var anexos = ctx.SolicitacoesAnexo.OrderBy(a => a.Ordem).ToList();
        Assert.Contains("1.632,03", anexos[0].TextoDoBloco);
        Assert.DoesNotContain("2.776,03", anexos[1].TextoDoBloco);
        Assert.True(ctx.Solicitacoes.Single().MostrarValores);
    }

    [Fact]
    public async Task Anexos_SaoRedesenhadosEmWebp_NaOrdem_DeTelasDiferentes_EOAdminVe()
    {
        var (ctx, servico, u) = Seed();

        var criada = await servico.CriarAsync(u, Dto(anexos: [Anexo(tipo: 1, imagem: PngBase64(2400, 1200), tela: "/relatorios"), Anexo(tela: "/dashboard")]));

        var lista = (await servico.ListarAsync(null)).Items.Single();
        Assert.Equal(new[] { ("/relatorios", 1), ("/dashboard", 2) }, lista.Anexos.Select(a => (a.Tela, a.Tipo)));
        var print = await servico.ObterAnexoAsync(criada.Id, lista.Anexos[0].Id);
        Assert.Equal((PrintDaTela.LarguraMaxima, 800), (print!.Largura, print.Altura));
        using var codec = SKCodec.Create(new MemoryStream(print.Dados));
        Assert.Equal(SKEncodedImageFormat.Webp, codec.EncodedFormat); // nunca o arquivo enviado
        Assert.Null(await servico.ObterAnexoAsync(Guid.NewGuid(), lista.Anexos[0].Id)); // anexo só pela solicitação dele
    }

    [Fact]
    public async Task MaisDe5Anexos_Recusa()
    {
        var (_, servico, u) = Seed();
        var seis = Enumerable.Range(0, 6).Select(_ => Anexo()).ToList();
        await Assert.ThrowsAsync<ArgumentException>(() => servico.CriarAsync(u, Dto(anexos: seis)));
    }

    [Theory]
    [InlineData("PGh0bWw+PC9odG1sPg==")] // "<html></html>" disfarçado de imagem
    [InlineData("nao-e-base64!!")]
    public async Task AnexoQueNaoEImagem_Recusa_ENadaEGravado(string base64)
    {
        var (ctx, servico, u) = Seed();
        await Assert.ThrowsAsync<ArgumentException>(() => servico.CriarAsync(u, Dto(anexos: [Anexo(imagem: base64)])));
        Assert.Empty(ctx.Solicitacoes);
    }

    [Fact]
    public async Task AnexosDeSolicitacaoFechadaHaMaisDe30Dias_SomemNaPurga_EOTextoFica()
    {
        var (ctx, servico, u) = Seed();
        var velha = await servico.CriarAsync(u, Dto(anexos: [Anexo(), Anexo(tipo: 1)]));
        var aberta = await servico.CriarAsync(u, Dto(anexos: [Anexo()]));
        var fechadaAgora = await servico.CriarAsync(u, Dto(anexos: [Anexo()]));
        foreach (var (id, status, dias) in new[] { (velha.Id, StatusSolicitacao.Feita, 31), (aberta.Id, StatusSolicitacao.NoBacklog, 60), (fechadaAgora.Id, StatusSolicitacao.NaoVamosFazer, 1) })
        {
            var s = ctx.Solicitacoes.Single(x => x.Id == id);
            s.Status = status;
            s.AtualizadoEm = DateTime.UtcNow.AddDays(-dias);
        }
        ctx.SaveChanges();

        Assert.Equal(2, await servico.PurgarPrintsVencidosAsync());

        Assert.DoesNotContain(ctx.SolicitacoesAnexo, a => a.SolicitacaoId == velha.Id);
        Assert.Contains(ctx.SolicitacoesAnexo, a => a.SolicitacaoId == aberta.Id);
        Assert.Contains(ctx.SolicitacoesAnexo, a => a.SolicitacaoId == fechadaAgora.Id);
        Assert.Equal(3, ctx.Solicitacoes.Count());
    }
}
