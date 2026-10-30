using SkiaSharp;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Print da tela das solicitações do beta: o mesmo cuidado da foto de perfil (<see cref="FotoPerfilService.Reprocessar"/>).
/// Só JPG/PNG/WebP decidido pelo CONTEÚDO, com teto de bytes e de pixels; a imagem é REDESENHADA em WebP
/// (largura até <see cref="LarguraMaxima"/>, altura até <see cref="AlturaMaxima"/>) e só isso é guardado.
/// </summary>
public static class PrintDaTela
{
    public const int TamanhoMaximoBytes = 1536 * 1024;
    public const int LarguraMaxima = 1600;
    public const int AlturaMaxima = 6000;
    private const long PixelsMaximos = 40_000_000;
    private const int QualidadeWebp = 80;
    private const string FormatoInvalido = "O print precisa ser uma imagem PNG, JPG ou WebP.";

    /// <summary>Lê o print em base64 (aceita o prefixo "data:image/...;base64,") e devolve o WebP redesenhado.</summary>
    public static (byte[] Dados, int Largura, int Altura) DoBase64(string base64)
    {
        var corpo = base64.Trim();
        var virgula = corpo.IndexOf(',');
        if (corpo.StartsWith("data:", StringComparison.OrdinalIgnoreCase) && virgula > 0)
            corpo = corpo[(virgula + 1)..];
        if (corpo.Length > (TamanhoMaximoBytes / 3 + 1) * 4)
            throw new ArgumentException("Print grande demais.");
        byte[] arquivo;
        try { arquivo = Convert.FromBase64String(corpo); }
        catch (FormatException) { throw new ArgumentException(FormatoInvalido); }
        return Reprocessar(arquivo);
    }

    public static (byte[] Dados, int Largura, int Altura) Reprocessar(byte[] arquivo)
    {
        if (arquivo.Length == 0) throw new ArgumentException(FormatoInvalido);
        if (arquivo.Length > TamanhoMaximoBytes) throw new ArgumentException("Print grande demais.");
        using var dados = SKData.CreateCopy(arquivo);
        using var codec = SKCodec.Create(dados) ?? throw new ArgumentException(FormatoInvalido);
        if (codec.EncodedFormat is not (SKEncodedImageFormat.Jpeg or SKEncodedImageFormat.Png or SKEncodedImageFormat.Webp))
            throw new ArgumentException(FormatoInvalido);
        var info = codec.Info;
        if (info.Width <= 0 || info.Height <= 0) throw new ArgumentException(FormatoInvalido);
        if ((long)info.Width * info.Height > PixelsMaximos) throw new ArgumentException("Print grande demais.");

        var alvo = new SKImageInfo(info.Width, info.Height, SKColorType.Rgba8888, SKAlphaType.Premul);
        using var lida = new SKBitmap(alvo);
        var resultado = codec.GetPixels(alvo, lida.GetPixels());
        if (resultado is not (SKCodecResult.Success or SKCodecResult.IncompleteInput))
            throw new ArgumentException(FormatoInvalido);

        // Reduz pra caber na largura; o que passar da altura máxima fica de fora (a parte de cima é a que importa).
        var escala = Math.Min(1f, (float)LarguraMaxima / info.Width);
        var largura = Math.Max(1, (int)Math.Round(info.Width * escala));
        var altura = Math.Max(1, Math.Min(AlturaMaxima, (int)Math.Round(info.Height * escala)));

        using var superficie = SKSurface.Create(new SKImageInfo(largura, altura, SKColorType.Rgba8888, SKAlphaType.Premul))
            ?? throw new InvalidOperationException("Não deu pra preparar o print.");
        superficie.Canvas.Clear(SKColors.White);
        using (var imagem = SKImage.FromBitmap(lida))
            superficie.Canvas.DrawImage(imagem, SKRect.Create(0, 0, info.Width * escala, info.Height * escala), new SKSamplingOptions(SKCubicResampler.Mitchell));
        using var final = superficie.Snapshot();
        using var webp = final.Encode(SKEncodedImageFormat.Webp, QualidadeWebp)
            ?? throw new InvalidOperationException("Não deu pra preparar o print.");
        return (webp.ToArray(), largura, altura);
    }
}
