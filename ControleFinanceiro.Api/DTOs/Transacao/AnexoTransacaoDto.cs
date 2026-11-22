using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Transacao;

/// <summary>Um anexo do lançamento (sem os bytes: o arquivo sai por <c>GET /transacoes/{id}/anexos/{anexoId}</c>).
/// <c>TipoConteudo</c>: "image/webp" (foto, redesenhada) ou "application/pdf".</summary>
public record AnexoTransacaoDto(Guid Id, string Nome, string TipoConteudo, int Tamanho, DateTime CriadoEm);

/// <summary>O ponto que o aparelho deu ("Usar onde estou"). O servidor arredonda a 4 casas (~11 m).</summary>
public record LocalizacaoDto(
    [Range(-90.0, 90.0)] double Latitude,
    [Range(-180.0, 180.0)] double Longitude);
