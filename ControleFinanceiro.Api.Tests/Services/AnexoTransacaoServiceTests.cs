using System.Text;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Importacao;
using ControleFinanceiro.Api.DTOs.Transacao;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using SkiaSharp;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Anexos e localização do lançamento (2026-11-07): só o dono mexe (de outra pessoa = 404), foto redesenhada em WebP
/// (o arquivo enviado nunca é guardado), PDF conferido pelo conteúdo e recusado com ação ativa, tetos por lançamento,
/// nome limpo, ponto arredondado a ~11 m; a importação grava o ponto e devolve o lançamento de cada linha.
/// </summary>
public class AnexoTransacaoServiceTests
{
    private record Cenario(AppDbContext Ctx, Guid Dono, Guid Outro, Guid Conta, Guid Transacao, AnexoTransacaoService Svc);

    private static Cenario Montar()
    {
        var ctx = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning)).Options);
        var dono = new Usuario { Id = Guid.NewGuid(), Email = "dono@x.com", Nome = "Dono", PasswordHash = "x" };
        var outro = new Usuario { Id = Guid.NewGuid(), Email = "outro@x.com", Nome = "Outro", PasswordHash = "x" };
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Nubank", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = dono.Id };
        var t = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Padaria", Valor = 12m, Tipo = TipoTransacao.Despesa, ContaId = conta.Id,
            CriadoPor = dono.Id, Data = new DateOnly(2026, 10, 20), StatusTransacao = StatusTransacao.Executado,
        };
        ctx.AddRange(dono, outro, conta, t);
        ctx.SaveChanges();
        return new Cenario(ctx, dono.Id, outro.Id, conta.Id, t.Id, new AnexoTransacaoService(ctx));
    }

    private static byte[] Imagem(int w, int h, SKEncodedImageFormat formato)
    {
        using var bmp = new SKBitmap(w, h);
        using (var c = new SKCanvas(bmp)) c.Clear(SKColors.Teal);
        using var img = SKImage.FromBitmap(bmp);
        return img.Encode(formato, 90).ToArray();
    }

    private static byte[] Pdf(string corpo = "1 0 obj << /Type /Catalog >> endobj") =>
        Encoding.Latin1.GetBytes($"%PDF-1.7\n{corpo}\ntrailer << /Root 1 0 R >>\n%%EOF\n");

    private static Task<AnexoTransacaoDto> Anexar(Cenario c, byte[] bytes, string nome = "nota.jpg", Guid? quem = null) =>
        c.Svc.AdicionarAsync(c.Transacao, quem ?? c.Dono, new MemoryStream(bytes), bytes.Length, nome);

    [Theory]
    [InlineData(SKEncodedImageFormat.Jpeg)]
    [InlineData(SKEncodedImageFormat.Png)]
    [InlineData(SKEncodedImageFormat.Webp)]
    public async Task Foto_ViraWebpNovo_ComLadoMaiorNoTeto(SKEncodedImageFormat formato)
    {
        var c = Montar();
        var original = Imagem(3000, 1500, formato);

        var dto = await Anexar(c, original, "IMG_0001.jpeg");

        var anexo = await c.Ctx.AnexosTransacao.SingleAsync();
        Assert.Equal(AnexoTransacaoService.TipoWebp, anexo.TipoConteudo);
        Assert.Equal("IMG_0001.webp", dto.Nome);
        Assert.NotEqual(original, anexo.Dados);
        using var codec = SKCodec.Create(SKData.CreateCopy(anexo.Dados));
        Assert.Equal(SKEncodedImageFormat.Webp, codec.EncodedFormat);
        Assert.Equal(AnexoTransacaoService.LadoMaximo, codec.Info.Width);
        Assert.Equal(1200, codec.Info.Height);
        Assert.Equal(c.Dono, anexo.UsuarioId);
    }

    [Fact]
    public async Task Pdf_GuardaComoVeio_ESvgOuLixoSaoRecusados()
    {
        var c = Montar();
        var pdf = Pdf();

        var dto = await Anexar(c, pdf, "comprovante.PDF");

        Assert.Equal(AnexoTransacaoService.TipoPdf, dto.TipoConteudo);
        Assert.Equal("comprovante.pdf", dto.Nome);
        Assert.Equal(pdf, (await c.Ctx.AnexosTransacao.SingleAsync()).Dados);

        var svg = Encoding.UTF8.GetBytes("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>");
        await Assert.ThrowsAsync<ArgumentException>(() => Anexar(c, svg, "foto.png"));
        await Assert.ThrowsAsync<ArgumentException>(() => Anexar(c, Encoding.UTF8.GetBytes("isto não é nada"), "a.pdf"));
        // Começa como PDF mas não termina como um (cortado ou disfarçado).
        await Assert.ThrowsAsync<ArgumentException>(() => Anexar(c, Encoding.Latin1.GetBytes("%PDF-1.4\n<html><script>"), "a.pdf"));
    }

    [Theory]
    [InlineData("<< /S /JavaScript /JS (app.alert(1)) >>")]
    [InlineData("<< /OpenAction << /S /Launch /F (calc.exe) >> >>")]
    [InlineData("<< /EmbeddedFiles 3 0 R >>")]
    [InlineData("<< /S /J#61vaScript >>")]
    [InlineData("<< /AcroForm << /XFA 5 0 R >> >>")]
    public async Task Pdf_ComAcaoAtiva_ERecusado(string corpo)
    {
        var c = Montar();
        await Assert.ThrowsAsync<ArgumentException>(() => Anexar(c, Pdf(corpo), "a.pdf"));
        Assert.Empty(c.Ctx.AnexosTransacao);
    }

    [Fact]
    public async Task SoODono_DeOutraPessoaOuInexistenteE404()
    {
        var c = Montar();
        var anexo = await Anexar(c, Pdf(), "a.pdf");

        await Assert.ThrowsAsync<KeyNotFoundException>(() => Anexar(c, Pdf(), "b.pdf", c.Outro));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => c.Svc.ListarAsync(c.Transacao, c.Outro));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => c.Svc.RemoverAsync(c.Transacao, anexo.Id, c.Outro));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => c.Svc.DefinirLocalizacaoAsync(c.Transacao, c.Outro, new LocalizacaoDto(-19.9, -43.9)));
        Assert.Null(await c.Svc.ObterAsync(c.Transacao, anexo.Id, c.Outro));
        Assert.Null(await c.Svc.ObterAsync(Guid.NewGuid(), anexo.Id, c.Dono));

        Assert.NotNull(await c.Svc.ObterAsync(c.Transacao, anexo.Id, c.Dono));
        await c.Svc.RemoverAsync(c.Transacao, anexo.Id, c.Dono);
        Assert.Empty(await c.Svc.ListarAsync(c.Transacao, c.Dono));
    }

    [Fact]
    public async Task NoMaximoCincoPorLancamento()
    {
        var c = Montar();
        for (var i = 0; i < AnexoTransacaoService.MaximoPorLancamento; i++)
            await Anexar(c, Pdf(), $"{i}.pdf");

        await Assert.ThrowsAsync<InvalidOperationException>(() => Anexar(c, Pdf(), "6.pdf"));
    }

    [Theory]
    [InlineData("../../etc/passwd", "passwd.pdf")]
    [InlineData("C:\\Users\\x\\nota fiscal.pdf", "nota fiscal.pdf")]
    [InlineData("a\u0000b<c>.pdf", "abc.pdf")]
    [InlineData("", "anexo.pdf")]
    [InlineData(null, "anexo.pdf")]
    public void NomeLimpo_SemCaminhoNemCaractereEstranho(string? nome, string esperado) =>
        Assert.Equal(esperado, AnexoTransacaoService.NomeLimpo(nome, AnexoTransacaoService.TipoPdf));

    [Fact]
    public async Task Localizacao_ArredondaA4Casas_ETiraComNull()
    {
        var c = Montar();

        await c.Svc.DefinirLocalizacaoAsync(c.Transacao, c.Dono, new LocalizacaoDto(-19.923456789, -43.945678912));
        var t = await c.Ctx.Transacoes.SingleAsync();
        Assert.Equal(-19.9235, t.Latitude);
        Assert.Equal(-43.9457, t.Longitude);

        await c.Svc.DefinirLocalizacaoAsync(c.Transacao, c.Dono, null);
        Assert.Null(t.Latitude);
        Assert.Null(t.Longitude);
    }

    [Theory]
    [InlineData(91.0, 0.0)]
    [InlineData(0.0, -181.0)]
    [InlineData(double.NaN, 0.0)]
    [InlineData(-19.9, null)]
    public void Ponto_ForaDaFaixaOuIncompleto_E400(double? lat, double? lng) =>
        Assert.Throws<ArgumentException>(() => AnexoTransacaoService.Ponto(lat, lng));

    [Fact]
    public async Task Importacao_GravaOPonto_EDevolveOLancamentoDeCadaLinha()
    {
        var c = Montar();
        var importacao = new ImportacaoService(c.Ctx, new ExtratoImportService(),
            new TransacaoService(c.Ctx, new FaturaService(c.Ctx), new FinancialEventLogService(c.Ctx)));
        var linhas = new List<LinhaImportarDto>
        {
            new(new DateTime(2026, 10, 6), "Compra no débito - Mercado", 30m, TipoTransacao.Despesa, "F1", null,
                Latitude: -19.92345678, Longitude: -43.94567891),
            new(new DateTime(2026, 10, 7), "Compra no débito - Feira", 15m, TipoTransacao.Despesa, "F2", null),
        };

        var resultado = await importacao.ConfirmarAsync(new ConfirmarImportacaoDto(c.Conta, linhas), c.Dono, "chave-1");

        Assert.NotNull(resultado.Ids);
        Assert.Equal(2, resultado.Ids!.Count);
        var mercado = await c.Ctx.Transacoes.SingleAsync(t => t.Id == resultado.Ids[0]);
        Assert.Equal("Compra no débito - Mercado", mercado.Descricao);
        Assert.Equal(-19.9235, mercado.Latitude);
        Assert.Equal(-43.9457, mercado.Longitude);
        var feira = await c.Ctx.Transacoes.SingleAsync(t => t.Id == resultado.Ids[1]);
        Assert.Null(feira.Latitude);

        // Ponto pela metade não entra.
        var ruim = new List<LinhaImportarDto> { new(new DateTime(2026, 10, 8), "Compra - X", 1m, TipoTransacao.Despesa, "F3", null, Latitude: 1) };
        await Assert.ThrowsAsync<ArgumentException>(() => importacao.ConfirmarAsync(new ConfirmarImportacaoDto(c.Conta, ruim), c.Dono, "chave-2"));
    }
}
