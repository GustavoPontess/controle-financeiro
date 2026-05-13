namespace ControleFinanceiro.Api.DTOs.Common;

/// <summary>
/// Envelope de resposta paginada.
/// </summary>
/// <typeparam name="T">Tipo dos itens retornados.</typeparam>
public class PagedResult<T>
{
    /// <summary>Itens da página atual.</summary>
    public IEnumerable<T> Items { get; init; } = [];

    /// <summary>Total de registros (sem considerar paginação).</summary>
    public int Total { get; init; }

    /// <summary>Página atual (base 1).</summary>
    public int Page { get; init; }

    /// <summary>Tamanho da página.</summary>
    public int PageSize { get; init; }

    /// <summary>Total de páginas.</summary>
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling((double)Total / PageSize) : 0;
}
