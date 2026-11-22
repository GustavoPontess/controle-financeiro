using System.Text;
using System.Text.RegularExpressions;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.DTOs.Transacao;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using SkiaSharp;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Anexos e localização do lançamento (2026-11-07, pedido do Gustavo: "anexar o print da nota"). Quem pode: o DONO do
/// lançamento, o mesmo que edita (conta dele ou cartão dele, como <see cref="TransacaoService.BuscarPorIdAsync"/>);
/// de outra pessoa ou inexistente → 404, igual.
///
/// Segurança do upload (OWASP File Upload Cheat Sheet, o mesmo cuidado da foto de perfil):
/// - tipo decidido pelo CONTEÚDO, nunca pela extensão nem pelo Content-Type do cliente: JPG/PNG/WebP (o decodificador)
///   ou PDF (assinatura <c>%PDF-</c> + <c>%%EOF</c> no fim);
/// - foto é REDESENHADA (gira pela orientação EXIF, lado maior até <see cref="LadoMaximo"/>, WebP novo): GPS, câmera e
///   qualquer coisa escondida no arquivo somem; o arquivo enviado nunca é guardado;
/// - PDF com ação ativa (JavaScript, abrir programa, arquivo embutido, formulário XFA) é recusado; o que passa só sai
///   como DOWNLOAD (nunca aberto dentro do app) e a API responde com CSP <c>default-src 'none'</c> e nosniff;
/// - teto de bytes (lido com teto, o tamanho declarado pode mentir), de pixels, de anexos por lançamento e de espaço
///   por pessoa; nome do arquivo limpo (sem caminho nem caractere de controle).
/// </summary>
public class AnexoTransacaoService
{
    public const int TamanhoMaximoBytes = 10 * 1024 * 1024;
    public const int MaximoPorLancamento = 5;
    public const long CotaPorPessoaBytes = 100L * 1024 * 1024;
    public const int LadoMaximo = 2400;
    public const int TamanhoMaximoNome = 120;
    private const long PixelsMaximosJpeg = 60_000_000;
    private const long PixelsMaximosOutros = 40_000_000;
    private const int QualidadeWebp = 82;
    private const string FormatoInvalido = "Anexe uma foto (JPG, PNG ou WebP) ou um PDF.";
    public const string TipoWebp = "image/webp";
    public const string TipoPdf = "application/pdf";

    private readonly AppDbContext _context;

    public AnexoTransacaoService(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>O lançamento, se for de quem pede (a mesma conferência de editar). Senão 404.</summary>
    private async Task<Transacao> LancamentoDoDonoAsync(Guid transacaoId, Guid usuarioId) =>
        await _context.Transacoes
            .Where(t => t.Id == transacaoId && (
                (t.ContaId.HasValue && t.Conta!.UsuarioIdProprietario == usuarioId) ||
                (t.CartaoCreditoId.HasValue && t.CartaoCredito!.CriadoPor == usuarioId)))
            .FirstOrDefaultAsync()
        ?? throw new KeyNotFoundException("Lançamento não encontrado.");

    public async Task<List<AnexoTransacaoDto>> ListarAsync(Guid transacaoId, Guid usuarioId)
    {
        await LancamentoDoDonoAsync(transacaoId, usuarioId);
        return await _context.AnexosTransacao.AsNoTracking()
            .Where(a => a.TransacaoId == transacaoId)
            .OrderBy(a => a.CriadoEm)
            .Select(a => new AnexoTransacaoDto(a.Id, a.Nome, a.TipoConteudo, a.Tamanho, a.CriadoEm))
            .ToListAsync();
    }

    public async Task<AnexoTransacaoDto> AdicionarAsync(Guid transacaoId, Guid usuarioId, Stream conteudo, long tamanho, string? nomeArquivo)
    {
        if (tamanho <= 0)
            throw new ArgumentException("Escolha um arquivo.");
        if (tamanho > TamanhoMaximoBytes)
            throw new ArgumentException("O arquivo pode ter até 10 MB.");

        await LancamentoDoDonoAsync(transacaoId, usuarioId);
        if (await _context.AnexosTransacao.CountAsync(a => a.TransacaoId == transacaoId) >= MaximoPorLancamento)
            throw new InvalidOperationException($"Cada lançamento pode ter até {MaximoPorLancamento} anexos.");

        var arquivo = await LerComTetoAsync(conteudo);
        var (dados, tipo) = Preparar(arquivo);

        var usado = await _context.AnexosTransacao.Where(a => a.UsuarioId == usuarioId).SumAsync(a => (long?)a.Tamanho) ?? 0;
        if (usado + dados.Length > CotaPorPessoaBytes)
            throw new InvalidOperationException("Seu espaço de anexos acabou (100 MB). Apague algum antes de anexar outro.");

        var anexo = new AnexoTransacao
        {
            Id = Guid.NewGuid(),
            TransacaoId = transacaoId,
            UsuarioId = usuarioId,
            Nome = NomeLimpo(nomeArquivo, tipo),
            TipoConteudo = tipo,
            Tamanho = dados.Length,
            Dados = dados,
            CriadoEm = DateTime.UtcNow,
        };
        _context.AnexosTransacao.Add(anexo);
        await _context.SaveChangesAsync();
        return new AnexoTransacaoDto(anexo.Id, anexo.Nome, anexo.TipoConteudo, anexo.Tamanho, anexo.CriadoEm);
    }

    /// <summary>O anexo com os bytes, ou null (de outra pessoa ou inexistente: a mesma resposta).</summary>
    public async Task<AnexoTransacao?> ObterAsync(Guid transacaoId, Guid anexoId, Guid usuarioId)
    {
        try { await LancamentoDoDonoAsync(transacaoId, usuarioId); }
        catch (KeyNotFoundException) { return null; }
        return await _context.AnexosTransacao.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == anexoId && a.TransacaoId == transacaoId);
    }

    public async Task RemoverAsync(Guid transacaoId, Guid anexoId, Guid usuarioId)
    {
        await LancamentoDoDonoAsync(transacaoId, usuarioId);
        var anexo = await _context.AnexosTransacao.FirstOrDefaultAsync(a => a.Id == anexoId && a.TransacaoId == transacaoId)
            ?? throw new KeyNotFoundException("Anexo não encontrado.");
        _context.AnexosTransacao.Remove(anexo);
        await _context.SaveChangesAsync();
    }

    /// <summary>Grava (ou tira, com null) o ponto de onde o lançamento aconteceu.</summary>
    public async Task DefinirLocalizacaoAsync(Guid transacaoId, Guid usuarioId, LocalizacaoDto? local)
    {
        var transacao = await LancamentoDoDonoAsync(transacaoId, usuarioId);
        var ponto = Ponto(local?.Latitude, local?.Longitude);
        transacao.Latitude = ponto?.Latitude;
        transacao.Longitude = ponto?.Longitude;
        await _context.SaveChangesAsync();
    }

    /// <summary>Confere e arredonda o ponto (4 casas, ~11 m: não guardar mais precisão que o necessário). Os dois
    /// juntos ou nenhum; fora da faixa → 400. Regra única (a importação usa também).</summary>
    public static (double Latitude, double Longitude)? Ponto(double? latitude, double? longitude)
    {
        if (latitude is null && longitude is null) return null;
        if (latitude is not { } lat || longitude is not { } lng)
            throw new ArgumentException("Localização incompleta.");
        if (!double.IsFinite(lat) || !double.IsFinite(lng) || lat is < -90 or > 90 || lng is < -180 or > 180)
            throw new ArgumentException("Localização inválida.");
        return (Math.Round(lat, 4), Math.Round(lng, 4));
    }

    private static async Task<byte[]> LerComTetoAsync(Stream conteudo)
    {
        using var copia = new MemoryStream();
        var buffer = new byte[81920];
        int lidos;
        while ((lidos = await conteudo.ReadAsync(buffer)) > 0)
        {
            if (copia.Length + lidos > TamanhoMaximoBytes)
                throw new ArgumentException("O arquivo pode ter até 10 MB.");
            copia.Write(buffer, 0, lidos);
        }
        return copia.ToArray();
    }

    /// <summary>Decide o tipo pelo conteúdo e devolve o que se guarda: foto redesenhada (WebP) ou PDF conferido.</summary>
    public static (byte[] Dados, string Tipo) Preparar(byte[] arquivo)
    {
        if (arquivo.Length == 0) throw new ArgumentException(FormatoInvalido);
        if (ComecaCom(arquivo, "%PDF-"))
            return (ConferirPdf(arquivo), TipoPdf);
        return (RedesenharFoto(arquivo), TipoWebp);
    }

    private static bool ComecaCom(byte[] dados, string assinatura) =>
        dados.Length >= assinatura.Length && Encoding.ASCII.GetString(dados, 0, assinatura.Length) == assinatura;

    // Nomes de PDF que disparam ação (OWASP; PDF malicioso). Nome com "#xx" é decodificado antes (/J#61vaScript).
    private static readonly Regex AcaoAtivaPdf = new(@"/(JavaScript|JS|Launch|EmbeddedFile|EmbeddedFiles|RichMedia|XFA|SubmitForm|ImportData|GoToE)(?![A-Za-z])",
        RegexOptions.CultureInvariant, TimeSpan.FromSeconds(2));
    private static readonly Regex HexEmNome = new(@"#([0-9A-Fa-f]{2})", RegexOptions.CultureInvariant, TimeSpan.FromSeconds(2));

    /// <summary>PDF de verdade (começa com <c>%PDF-</c> e termina com <c>%%EOF</c>) e sem ação ativa à vista. O que
    /// está comprimido não dá pra ler aqui: por isso o PDF só sai como download, com CSP fechada.</summary>
    public static byte[] ConferirPdf(byte[] arquivo)
    {
        var fim = Encoding.Latin1.GetString(arquivo, Math.Max(0, arquivo.Length - 2048), Math.Min(2048, arquivo.Length));
        if (!fim.Contains("%%EOF"))
            throw new ArgumentException(FormatoInvalido);
        var texto = HexEmNome.Replace(Encoding.Latin1.GetString(arquivo), m => ((char)Convert.ToInt32(m.Groups[1].Value, 16)).ToString());
        if (AcaoAtivaPdf.IsMatch(texto))
            throw new ArgumentException("Esse PDF tem conteúdo ativo (script, arquivo embutido ou formulário) e não pode ser anexado. Anexe um print dele.");
        return arquivo;
    }

    /// <summary>Decodifica (só JPG/PNG/WebP, com teto de pixels), aplica a orientação EXIF, reduz pro lado maior
    /// caber em <see cref="LadoMaximo"/> e devolve um WebP novo (sem metadados).</summary>
    public static byte[] RedesenharFoto(byte[] arquivo)
    {
        using var dados = SKData.CreateCopy(arquivo);
        using var codec = SKCodec.Create(dados) ?? throw new ArgumentException(FormatoInvalido);
        var formato = codec.EncodedFormat;
        if (formato is not (SKEncodedImageFormat.Jpeg or SKEncodedImageFormat.Png or SKEncodedImageFormat.Webp))
            throw new ArgumentException(FormatoInvalido);

        var info = codec.Info;
        if (info.Width <= 0 || info.Height <= 0)
            throw new ArgumentException(FormatoInvalido);
        if ((long)info.Width * info.Height > (formato == SKEncodedImageFormat.Jpeg ? PixelsMaximosJpeg : PixelsMaximosOutros))
            throw new ArgumentException("Foto grande demais. Use uma de até 40 megapixels.");

        // JPG decodifica já reduzido (o decodificador corta 1/2, 1/4, 1/8) quando é bem maior que o necessário.
        var escalaLida = Math.Min(1f, LadoMaximo / (float)Math.Max(info.Width, info.Height));
        var dims = codec.GetScaledDimensions(escalaLida);
        // O decodificador arredonda pra 1/8: se a redução ficou abaixo do lado final, lê inteira e reduz no desenho.
        if (Math.Max(dims.Width, dims.Height) < Math.Min(LadoMaximo, Math.Max(info.Width, info.Height)))
            dims = new SKSizeI(info.Width, info.Height);
        var alvo = new SKImageInfo(dims.Width, dims.Height, SKColorType.Rgba8888, SKAlphaType.Premul);
        using var lida = new SKBitmap(alvo);
        var resultado = codec.GetPixels(alvo, lida.GetPixels());
        if (resultado is not (SKCodecResult.Success or SKCodecResult.IncompleteInput))
            throw new ArgumentException(FormatoInvalido);

        using var orientada = FotoPerfilService.Orientar(lida, codec.EncodedOrigin);
        var escala = Math.Min(1f, LadoMaximo / (float)Math.Max(orientada.Width, orientada.Height));
        var largura = Math.Max(1, (int)Math.Round(orientada.Width * escala));
        var altura = Math.Max(1, (int)Math.Round(orientada.Height * escala));

        using var superficie = SKSurface.Create(new SKImageInfo(largura, altura, SKColorType.Rgba8888, SKAlphaType.Premul))
            ?? throw new InvalidOperationException("Não deu pra preparar a foto.");
        superficie.Canvas.Clear(SKColors.White);
        using (var imagem = SKImage.FromBitmap(orientada))
            superficie.Canvas.DrawImage(imagem, SKRect.Create(0, 0, largura, altura), new SKSamplingOptions(SKCubicResampler.Mitchell));
        using var final = superficie.Snapshot();
        using var webp = final.Encode(SKEncodedImageFormat.Webp, QualidadeWebp)
            ?? throw new InvalidOperationException("Não deu pra preparar a foto.");
        return webp.ToArray();
    }

    /// <summary>Nome pra mostrar e pro download: sem caminho, sem caractere de controle nem de sistema de arquivos, até
    /// <see cref="TamanhoMaximoNome"/>; a extensão é a do que foi guardado (foto vira .webp).</summary>
    public static string NomeLimpo(string? nome, string tipo)
    {
        var baseNome = Path.GetFileNameWithoutExtension((nome ?? "").Replace('\\', '/').Split('/').Last());
        var limpo = new string(baseNome.Where(c => !char.IsControl(c) && "<>:\"|?*".IndexOf(c) < 0).ToArray()).Trim().Trim('.');
        if (limpo.Length == 0) limpo = "anexo";
        var extensao = tipo == TipoPdf ? ".pdf" : ".webp";
        if (limpo.Length > TamanhoMaximoNome - extensao.Length) limpo = limpo[..(TamanhoMaximoNome - extensao.Length)].TrimEnd();
        return limpo + extensao;
    }
}
