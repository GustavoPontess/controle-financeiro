using System.Text;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using SkiaSharp;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Foto de perfil: só JPG/PNG/WebP decididos pelo conteúdo, imagem redesenhada (WebP 256x256, sem o arquivo
/// original), orientação EXIF aplicada, e quem vê é a própria pessoa ou quem divide família ativa com ela.
/// </summary>
public class FotoPerfilServiceTests
{
    private static AppDbContext Contexto() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static Usuario Pessoa(AppDbContext ctx, string nome, StatusUsuario status = StatusUsuario.Ativo)
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = $"{nome}@t.com", Nome = nome, PasswordHash = "x", Status = status };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u;
    }

    /// <summary>Imagem de teste: metade esquerda vermelha, direita azul (dá pra ver se girou).</summary>
    private static byte[] Imagem(int w, int h, SKEncodedImageFormat formato)
    {
        using var bmp = new SKBitmap(w, h);
        using (var c = new SKCanvas(bmp))
        {
            c.Clear(SKColors.Blue);
            using var tinta = new SKPaint { Color = SKColors.Red };
            c.DrawRect(0, 0, w / 2f, h, tinta);
        }
        using var img = SKImage.FromBitmap(bmp);
        return img.Encode(formato, 90).ToArray();
    }

    private static Task<DateTime> Salvar(FotoPerfilService svc, Guid id, byte[] bytes) =>
        svc.SalvarAsync(id, new MemoryStream(bytes), bytes.Length);

    [Theory]
    [InlineData(SKEncodedImageFormat.Jpeg)]
    [InlineData(SKEncodedImageFormat.Png)]
    [InlineData(SKEncodedImageFormat.Webp)]
    public async Task Salvar_RedesenhaEmWebp256Quadrado(SKEncodedImageFormat formato)
    {
        using var ctx = Contexto();
        var ana = Pessoa(ctx, "ana");
        var svc = new FotoPerfilService(ctx);
        var original = Imagem(900, 600, formato);

        var versao = await Salvar(svc, ana.Id, original);

        var foto = await ctx.FotosPerfil.SingleAsync(f => f.UsuarioId == ana.Id);
        Assert.Equal("image/webp", foto.TipoConteudo);
        Assert.NotEqual(original, foto.Dados);
        using var codec = SKCodec.Create(SKData.CreateCopy(foto.Dados));
        Assert.Equal(SKEncodedImageFormat.Webp, codec.EncodedFormat);
        Assert.Equal(FotoPerfilService.Lado, codec.Info.Width);
        Assert.Equal(FotoPerfilService.Lado, codec.Info.Height);
        Assert.Equal(versao, (await ctx.Usuarios.FindAsync(ana.Id))!.FotoPerfilEm);
    }

    [Fact]
    public async Task Salvar_RecusaQueNaoEhFoto_SvgETamanhoDemais()
    {
        using var ctx = Contexto();
        var ana = Pessoa(ctx, "ana");
        var svc = new FotoPerfilService(ctx);

        var svg = Encoding.UTF8.GetBytes("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>");
        await Assert.ThrowsAsync<ArgumentException>(() => Salvar(svc, ana.Id, svg));
        await Assert.ThrowsAsync<ArgumentException>(() => Salvar(svc, ana.Id, Encoding.UTF8.GetBytes("isto não é imagem")));
        // JPG cortado no meio do cabeçalho
        await Assert.ThrowsAsync<ArgumentException>(() => Salvar(svc, ana.Id, Imagem(200, 200, SKEncodedImageFormat.Jpeg)[..20]));
        // tamanho declarado acima do limite nem chega a ler
        await Assert.ThrowsAsync<ArgumentException>(() => svc.SalvarAsync(ana.Id, new MemoryStream([1]), FotoPerfilService.TamanhoMaximoBytes + 1));
        Assert.Empty(ctx.FotosPerfil);
        Assert.Null((await ctx.Usuarios.FindAsync(ana.Id))!.FotoPerfilEm);
    }

    [Fact]
    public async Task Salvar_TrocaAFotoNoMesmoRegistro_ERemoverZeraAVersao()
    {
        using var ctx = Contexto();
        var ana = Pessoa(ctx, "ana");
        var svc = new FotoPerfilService(ctx);
        await Salvar(svc, ana.Id, Imagem(300, 300, SKEncodedImageFormat.Png));
        await Salvar(svc, ana.Id, Imagem(400, 300, SKEncodedImageFormat.Jpeg));
        Assert.Single(ctx.FotosPerfil);

        await svc.RemoverAsync(ana.Id);
        Assert.Empty(ctx.FotosPerfil);
        Assert.Null((await ctx.Usuarios.FindAsync(ana.Id))!.FotoPerfilEm);
    }

    [Fact]
    public void Reprocessar_GiraPelaOrientacaoExif()
    {
        // Paisagem 1/2 vermelho | 1/2 azul; girar 90° no sentido horário põe o vermelho em cima.
        var bmp = new SKBitmap(40, 20);
        using (var c = new SKCanvas(bmp))
        {
            c.Clear(SKColors.Blue);
            using var tinta = new SKPaint { Color = SKColors.Red };
            c.DrawRect(0, 0, 20, 20, tinta);
        }
        var metodo = typeof(FotoPerfilService).GetMethod("Orientar", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)!;
        using var girada = (SKBitmap)metodo.Invoke(null, [bmp, SKEncodedOrigin.RightTop])!;
        Assert.Equal(20, girada.Width);
        Assert.Equal(40, girada.Height);
        Assert.Equal(SKColors.Red, girada.GetPixel(10, 5));
        Assert.Equal(SKColors.Blue, girada.GetPixel(10, 35));
    }

    [Fact]
    public async Task Obter_DonoEQuemDivideFamiliaVeem_EstranhoEContaInativaNao()
    {
        using var ctx = Contexto();
        var ana = Pessoa(ctx, "ana");
        var bia = Pessoa(ctx, "bia");
        var estranho = Pessoa(ctx, "estranho");
        var ex = Pessoa(ctx, "ex");
        var familia = new Familia { Id = Guid.NewGuid(), Nome = "Casa", CriadoPorUsuarioId = ana.Id, Ativa = true };
        ctx.Familias.Add(familia);
        ctx.MembrosFamilia.AddRange(
            new MembroFamilia { Id = Guid.NewGuid(), FamiliaId = familia.Id, UsuarioId = ana.Id, Papel = "Cônjuge", Ativo = true },
            new MembroFamilia { Id = Guid.NewGuid(), FamiliaId = familia.Id, UsuarioId = bia.Id, Papel = "Cônjuge", Ativo = true },
            new MembroFamilia { Id = Guid.NewGuid(), FamiliaId = familia.Id, UsuarioId = ex.Id, Papel = "Ex", Ativo = false });
        ctx.SaveChanges();
        var svc = new FotoPerfilService(ctx);
        await Salvar(svc, ana.Id, Imagem(300, 300, SKEncodedImageFormat.Png));

        Assert.NotNull(await svc.ObterAsync(ana.Id, ana.Id));
        Assert.NotNull(await svc.ObterAsync(bia.Id, ana.Id));
        Assert.Null(await svc.ObterAsync(estranho.Id, ana.Id));
        Assert.Null(await svc.ObterAsync(ex.Id, ana.Id)); // saiu da família, não vê mais

        // Conta marcada pra exclusão: ninguém vê (nem ela mesma, pela API).
        ana.Status = StatusUsuario.MarcadoParaExclusao;
        ctx.SaveChanges();
        Assert.Null(await svc.ObterAsync(bia.Id, ana.Id));
    }
}
