using ControleFinanceiro.Api.Infrastructure.Security;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using ControleFinanceiro.Api.DTOs.Importacao;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControleFinanceiro.Api.Controllers;

public class PreviewUploadForm
{
    /// <summary>Um arquivo (o CSV que precisa escolher colunas passa só por aqui).</summary>
    public IFormFile? Arquivo { get; set; }
    /// <summary>Vários arquivos da mesma conta de uma vez (2026-11-03): os meses da Nubank, OFX e CSV juntos.</summary>
    public List<IFormFile>? Arquivos { get; set; }
    /// <summary>A conta do extrato. Opcional na prévia (a pessoa escolhe na tela da prévia); sem ela, nada vem marcado como "já no app".</summary>
    public Guid? ContaId { get; set; }
    /// <summary>CSV: as colunas que a pessoa escolheu, em JSON (<see cref="MapeamentoCsvDto"/>). Opcional.</summary>
    public string? Mapeamento { get; set; }
}

public class FaturaUploadForm
{
    /// <summary>O cartão da fatura.</summary>
    public Guid CartaoId { get; set; }
    /// <summary>Os arquivos da fatura (um por mês, OFX ou CSV).</summary>
    public List<IFormFile>? Arquivos { get; set; }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ImportacaoController : ControllerBase
{
    private const long TamanhoMaximoBytes = 2 * 1024 * 1024; // 2 MB por arquivo
    private const long TamanhoMaximoDoEnvio = 20 * 1024 * 1024; // vários arquivos juntos
    private static readonly string[] ExtensoesAceitas = { ".ofx", ".csv" };

    private readonly ImportacaoService _importacaoService;
    private readonly ImportacaoCartaoService _cartaoService;

    public ImportacaoController(ImportacaoService importacaoService, ImportacaoCartaoService cartaoService)
    {
        _importacaoService = importacaoService;
        _cartaoService = cartaoService;
    }

    private List<(string, string)> ArquivosDaFatura(FaturaUploadForm form)
    {
        var arquivos = form.Arquivos ?? new();
        if (arquivos.Count == 0) throw new ArgumentException("Envie o arquivo da fatura.");
        if (arquivos.Count > ImportacaoService.MaxArquivos)
            throw new ArgumentException($"Envie no máximo {ImportacaoService.MaxArquivos} arquivos por vez.");
        return arquivos.Select(a => (a.FileName, a.Length == 0 ? "" : LerArquivo(a))).ToList();
    }

    /// <summary>
    /// Lê a fatura do cartão (OFX/CSV, um ou vários meses) e diz o que vai entrar, sem salvar: compras, parcelamentos,
    /// o que já está no app e como cada fatura fica (paga pela conta, paga antes ou a pagar).
    /// </summary>
    [HttpPost("cartao/preview")]
    [EnableRateLimiting(LimitesDeUso.PoliticaPesada)]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(PreviewFaturaDto), StatusCodes.Status200OK)]
    [RequestSizeLimit(TamanhoMaximoDoEnvio)]
    [RequestFormLimits(MultipartBodyLengthLimit = TamanhoMaximoDoEnvio)]
    public async Task<IActionResult> PreviewFatura([FromForm] FaturaUploadForm form) =>
        Ok(await _cartaoService.PreviewAsync(form.CartaoId, GetUserId(), ArquivosDaFatura(form)));

    /// <summary>
    /// Importa a fatura do cartão numa transação só (os arquivos são lidos de novo aqui). Exige Idempotency-Key.
    /// </summary>
    [HttpPost("cartao/confirmar")]
    [EnableRateLimiting(LimitesDeUso.PoliticaPesada)]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(ResultadoFaturaDto), StatusCodes.Status200OK)]
    [RequestSizeLimit(TamanhoMaximoDoEnvio)]
    [RequestFormLimits(MultipartBodyLengthLimit = TamanhoMaximoDoEnvio)]
    public async Task<IActionResult> ConfirmarFatura([FromForm] FaturaUploadForm form,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey) =>
        Ok(await _cartaoService.ImportarAsync(form.CartaoId, GetUserId(), ArquivosDaFatura(form), idempotencyKey));

    private Guid GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !Guid.TryParse(claim.Value, out var id))
            throw new UnauthorizedAccessException("Usuário não identificado.");
        return id;
    }

    /// <summary>
    /// Lê um extrato OFX/CSV e devolve a preview (sem salvar nada). CSV que não deu pra reconhecer volta com
    /// <c>precisaMapear</c>, as colunas e uma amostra; a tela manda de novo com <c>mapeamento</c>.
    /// </summary>
    [HttpPost("preview")]
    [EnableRateLimiting(LimitesDeUso.PoliticaPesada)]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(PreviewImportacaoDto), StatusCodes.Status200OK)]
    [RequestSizeLimit(TamanhoMaximoDoEnvio)]
    [RequestFormLimits(MultipartBodyLengthLimit = TamanhoMaximoDoEnvio)]
    public async Task<IActionResult> Preview([FromForm] PreviewUploadForm form)
    {
        var varios = (form.Arquivos ?? new()).Concat(form.Arquivo is null ? [] : [form.Arquivo]).ToList();
        if (varios.Count > 1)
        {
            if (varios.Count > ImportacaoService.MaxArquivos)
                throw new ArgumentException($"Envie no máximo {ImportacaoService.MaxArquivos} arquivos por vez.");
            // Vazio no meio de vários não derruba o envio: segue sem conteúdo e o serviço lista com o motivo. Tamanho e
            // formato continuam barrando aqui.
            var arquivos = varios.Select(a => (a.FileName, a.Length == 0 ? "" : LerArquivo(a))).ToList();
            return Ok(await _importacaoService.PreviewVariosAsync(form.ContaId, GetUserId(), arquivos, LerMapeamento(form.Mapeamento)));
        }
        if (varios.Count == 0) throw new ArgumentException("Envie um arquivo de extrato.");
        form.Arquivo = varios[0];
        var conteudo = LerArquivo(form.Arquivo);
        var mapeamento = LerMapeamento(form.Mapeamento);
        var preview = await _importacaoService.PreviewAsync(
            form.ContaId, GetUserId(), form.Arquivo.FileName, conteudo, mapeamento);
        return Ok(preview);
    }

    /// <summary>
    /// Cria as transações aprovadas pelo usuário na conta indicada, numa transação só. Exige o header
    /// Idempotency-Key (uma por prévia): repetir não importa de novo.
    /// </summary>
    [HttpPost("confirmar")]
    [EnableRateLimiting(LimitesDeUso.PoliticaPesada)]
    [ProducesResponseType(typeof(ResultadoImportacaoDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Confirmar([FromBody] ConfirmarImportacaoDto dto,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey)
    {
        if (string.IsNullOrWhiteSpace(idempotencyKey))
            throw new ArgumentException("O header Idempotency-Key é obrigatório para importar o extrato.");
        var resultado = await _importacaoService.ConfirmarAsync(dto, GetUserId(), idempotencyKey);
        return Ok(resultado);
    }

    /// <summary>
    /// As importações que a pessoa já fez (as mais novas primeiro): conta, de que dia a que dia e quantos lançamentos.
    /// </summary>
    /// <summary>
    /// Ensinar o nome (2026-11-21): a pessoa marca na descrição as palavras que são o nome e o app guarda a forma da
    /// descrição pras próximas (nada do lançamento é guardado). Devolve o nome que sai agora.
    /// </summary>
    [HttpPost("padroes-nome")]
    [ProducesResponseType(typeof(EnsinarNomeResultadoDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> EnsinarNome([FromBody] EnsinarNomeDto dto) =>
        Ok(await _importacaoService.EnsinarNomeAsync(GetUserId(), dto));

    [HttpGet("anteriores")]
    [ProducesResponseType(typeof(List<ImportacaoAnteriorDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Anteriores() => Ok(await _importacaoService.ListarAnterioresAsync(GetUserId()));

    /// <summary>
    /// Fila de pendentes: os lançamentos da pessoa que estão na conta sem categoria (os mais recentes) e o total.
    /// Cada um vem com o lugar lido da descrição e a categoria que o app sugere.
    /// </summary>
    [HttpGet("pendentes")]
    [ProducesResponseType(typeof(PendentesDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Pendentes() => Ok(await _importacaoService.ListarPendentesAsync(GetUserId()));

    /// <summary>Quantos lançamentos pendentes a pessoa tem (o número do menu).</summary>
    [HttpGet("pendentes/quantidade")]
    [ProducesResponseType(typeof(int), StatusCodes.Status200OK)]
    public async Task<IActionResult> QuantidadePendentes() => Ok(await _importacaoService.QuantidadePendentesAsync(GetUserId()));

    /// <summary>
    /// Dá uma categoria a um ou mais lançamentos pendentes (os de um lugar). Só mexe na categoria: lançamento de outra
    /// pessoa, inexistente ou que já tem categoria devolve 404.
    /// </summary>
    [HttpPost("pendentes/categorizar")]
    [ProducesResponseType(typeof(CategorizarPendentesResultadoDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> CategorizarPendentes([FromBody] CategorizarPendentesDto dto) =>
        Ok(await _importacaoService.CategorizarPendentesAsync(GetUserId(), dto));

    /// <summary>
    /// "Foi pagamento de cartão": saídas da conta pendentes que pagaram uma fatura viram registro de pagamento de fatura
    /// (sem categoria; contam como "Cartão (a detalhar)" até a fatura entrar). Saldo não muda.
    /// </summary>
    [HttpPost("pendentes/pagamento-de-cartao")]
    [ProducesResponseType(typeof(CategorizarPendentesResultadoDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> PagamentoDeCartao([FromBody] PagamentoDeCartaoDto dto) =>
        Ok(await _importacaoService.MarcarPagamentoDeCartaoAsync(GetUserId(), dto));

    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

    private static MapeamentoCsvDto? LerMapeamento(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        if (json.Length > 500) throw new ArgumentException("Mapeamento inválido.");
        try
        {
            var m = JsonSerializer.Deserialize<MapeamentoCsvDto>(json, Json) ?? throw new ArgumentException("Mapeamento inválido.");
            int?[] colunas = { m.Data, m.Descricao, m.Valor, m.Entrada, m.Saida, m.Id };
            if (colunas.Any(c => c is < 0 or > 200)) throw new ArgumentException("Mapeamento inválido.");
            return m;
        }
        catch (JsonException)
        {
            throw new ArgumentException("Mapeamento inválido.");
        }
    }

    /// <summary>Valida e lê o arquivo enviado. OFX brasileiro costuma vir em
    /// Latin1 — tenta UTF-8 estrito e cai para Latin1 se não for válido.</summary>
    private static string LerArquivo(IFormFile arquivo)
    {
        if (arquivo is null || arquivo.Length == 0)
            throw new ArgumentException("Envie um arquivo de extrato.");

        if (arquivo.Length > TamanhoMaximoBytes)
            throw new ArgumentException("O arquivo excede o limite de 2 MB.");

        var ext = Path.GetExtension(arquivo.FileName).ToLowerInvariant();
        if (!ExtensoesAceitas.Contains(ext))
            throw new ArgumentException("Formato não suportado. Envie um arquivo .ofx ou .csv.");

        using var ms = new MemoryStream();
        arquivo.CopyTo(ms);
        var bytes = ms.ToArray();

        try
        {
            return new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true)
                .GetString(bytes);
        }
        catch (DecoderFallbackException)
        {
            return Encoding.Latin1.GetString(bytes);
        }
    }
}
