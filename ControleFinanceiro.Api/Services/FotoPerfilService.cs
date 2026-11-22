using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using SkiaSharp;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Foto de perfil. Segurança (OWASP File Upload Cheat Sheet):
/// - aceita só JPG, PNG e WebP, decidido pelo CONTEÚDO (o decodificador), nunca pela extensão ou pelo
///   Content-Type que o cliente manda; SVG/GIF/qualquer outra coisa → 400;
/// - limite de tamanho do arquivo e de pixels (contra "bomba de descompressão"); JPG grande é decodificado
///   já reduzido (o decodificador corta 1/2, 1/4, 1/8), o resto tem teto menor;
/// - a imagem é REDESENHADA (gira pela orientação EXIF, corta o quadrado do meio, 256x256) e gravada como
///   WebP novo (512x512, a janela de ver a foto mostra grande): o arquivo enviado nunca é guardado nem devolvido, então metadados (GPS, câmera) e qualquer
///   conteúdo escondido somem;
/// - quem vê: a própria pessoa e quem divide uma família ativa com ela; conta que não está ativa não mostra.
/// </summary>
public class FotoPerfilService
{
    public const long TamanhoMaximoBytes = 8 * 1024 * 1024;
    public const int Lado = 512;
    private const long PixelsMaximosJpeg = 60_000_000;
    private const long PixelsMaximosOutros = 16_000_000;
    private const int QualidadeWebp = 85;

    private readonly AppDbContext _context;

    public FotoPerfilService(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>Reprocessa e grava a foto da pessoa. Devolve a nova "versão" (pra o front trocar a URL).</summary>
    public async Task<DateTime> SalvarAsync(Guid usuarioId, Stream conteudo, long tamanho)
    {
        if (tamanho <= 0)
            throw new ArgumentException("Escolha uma foto.");
        if (tamanho > TamanhoMaximoBytes)
            throw new ArgumentException("A foto pode ter até 8 MB.");

        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");

        // Lê com teto (o tamanho declarado pode mentir).
        using var copia = new MemoryStream();
        var buffer = new byte[81920];
        int lidos;
        while ((lidos = await conteudo.ReadAsync(buffer)) > 0)
        {
            if (copia.Length + lidos > TamanhoMaximoBytes)
                throw new ArgumentException("A foto pode ter até 8 MB.");
            copia.Write(buffer, 0, lidos);
        }

        var webp = Reprocessar(copia.ToArray());
        var agora = DateTime.UtcNow;

        var foto = await _context.FotosPerfil.FirstOrDefaultAsync(f => f.UsuarioId == usuarioId);
        if (foto is null)
            _context.FotosPerfil.Add(new FotoPerfil { UsuarioId = usuarioId, Dados = webp, TipoConteudo = "image/webp", AtualizadaEm = agora });
        else
        {
            foto.Dados = webp;
            foto.TipoConteudo = "image/webp";
            foto.AtualizadaEm = agora;
        }
        usuario.FotoPerfilEm = agora;
        usuario.AtualizadoEm = agora;
        await _context.SaveChangesAsync();
        return agora;
    }

    public async Task RemoverAsync(Guid usuarioId)
    {
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");
        var foto = await _context.FotosPerfil.FirstOrDefaultAsync(f => f.UsuarioId == usuarioId);
        if (foto is not null)
            _context.FotosPerfil.Remove(foto);
        usuario.FotoPerfilEm = null;
        usuario.AtualizadoEm = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }

    /// <summary>A foto de <paramref name="donoId"/> pra quem pede, ou null (sem foto, sem permissão ou conta
    /// não ativa: a resposta é a mesma, pra não revelar quem existe).</summary>
    public async Task<FotoPerfil?> ObterAsync(Guid quemPede, Guid donoId)
    {
        if (quemPede != donoId)
        {
            if (!await FamiliaPermissoes.DividemFamiliaAsync(_context, quemPede, donoId))
                return null;
        }
        return await _context.FotosPerfil.AsNoTracking()
            .FirstOrDefaultAsync(f => f.UsuarioId == donoId && f.Usuario!.Status == StatusUsuario.Ativo);
    }

    /// <summary>Decodifica (só JPG/PNG/WebP, com teto de pixels), aplica a orientação EXIF, corta o quadrado
    /// do meio e devolve um WebP <see cref="Lado"/>x<see cref="Lado"/> novo.</summary>
    public static byte[] Reprocessar(byte[] arquivo)
    {
        const string formatoInvalido = "Use uma foto em JPG, PNG ou WebP.";
        using var dados = SKData.CreateCopy(arquivo);
        using var codec = SKCodec.Create(dados) ?? throw new ArgumentException(formatoInvalido);
        var formato = codec.EncodedFormat;
        if (formato is not (SKEncodedImageFormat.Jpeg or SKEncodedImageFormat.Png or SKEncodedImageFormat.Webp))
            throw new ArgumentException(formatoInvalido);

        var info = codec.Info;
        long pixels = (long)info.Width * info.Height;
        if (info.Width <= 0 || info.Height <= 0)
            throw new ArgumentException(formatoInvalido);
        if (pixels > (formato == SKEncodedImageFormat.Jpeg ? PixelsMaximosJpeg : PixelsMaximosOutros))
            throw new ArgumentException("Foto grande demais. Use uma de até 16 megapixels.");

        // Decodifica já reduzida quando o formato deixa (JPG): basta o dobro do lado final.
        var escala = Math.Min(1f, Lado * 2f / Math.Min(info.Width, info.Height));
        var dims = codec.GetScaledDimensions(escala);
        var alvo = new SKImageInfo(dims.Width, dims.Height, SKColorType.Rgba8888, SKAlphaType.Premul);
        using var lida = new SKBitmap(alvo);
        var resultado = codec.GetPixels(alvo, lida.GetPixels());
        if (resultado is not (SKCodecResult.Success or SKCodecResult.IncompleteInput))
            throw new ArgumentException(formatoInvalido);

        using var orientada = Orientar(lida, codec.EncodedOrigin);
        var lado = Math.Min(orientada.Width, orientada.Height);
        var origem = SKRect.Create((orientada.Width - lado) / 2f, (orientada.Height - lado) / 2f, lado, lado);

        using var superficie = SKSurface.Create(new SKImageInfo(Lado, Lado, SKColorType.Rgba8888, SKAlphaType.Premul))
            ?? throw new InvalidOperationException("Não deu pra preparar a foto.");
        superficie.Canvas.Clear(SKColors.Transparent);
        using (var imagem = SKImage.FromBitmap(orientada))
            superficie.Canvas.DrawImage(imagem, origem, SKRect.Create(0, 0, Lado, Lado), new SKSamplingOptions(SKCubicResampler.Mitchell));
        using var final = superficie.Snapshot();
        using var webp = final.Encode(SKEncodedImageFormat.Webp, QualidadeWebp)
            ?? throw new InvalidOperationException("Não deu pra preparar a foto.");
        return webp.ToArray();
    }

    /// <summary>Gira/espelha conforme a orientação EXIF (foto de celular deitada vira de pé).</summary>
    internal static SKBitmap Orientar(SKBitmap origem, SKEncodedOrigin orientacao)
    {
        int w = origem.Width, h = origem.Height;
        var troca = orientacao is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;
        var destino = new SKBitmap(new SKImageInfo(troca ? h : w, troca ? w : h, SKColorType.Rgba8888, SKAlphaType.Premul));
        using var canvas = new SKCanvas(destino);
        switch (orientacao)
        {
            case SKEncodedOrigin.TopRight: canvas.Translate(w, 0); canvas.Scale(-1, 1); break;
            case SKEncodedOrigin.BottomRight: canvas.Translate(w, h); canvas.RotateDegrees(180); break;
            case SKEncodedOrigin.BottomLeft: canvas.Translate(0, h); canvas.Scale(1, -1); break;
            case SKEncodedOrigin.LeftTop: canvas.Translate(h, 0); canvas.Scale(-1, 1); canvas.Translate(h, 0); canvas.RotateDegrees(90); break;
            case SKEncodedOrigin.RightTop: canvas.Translate(h, 0); canvas.RotateDegrees(90); break;
            case SKEncodedOrigin.RightBottom: canvas.Translate(0, w); canvas.Scale(1, -1); canvas.Translate(h, 0); canvas.RotateDegrees(90); break;
            case SKEncodedOrigin.LeftBottom: canvas.Translate(0, w); canvas.RotateDegrees(-90); break;
        }
        canvas.DrawBitmap(origem, 0, 0);
        canvas.Flush();
        return destino;
    }
}
