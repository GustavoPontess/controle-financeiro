namespace ControleFinanceiro.Api.DTOs.Recorrente;

public class RecorrenteDto
{
    public Guid Id { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public int Tipo { get; set; }
    public string TipoDescricao { get; set; } = string.Empty;
    public Guid? CategoriaId { get; set; }
    public string? CategoriaNome { get; set; }
    public Guid? ContaId { get; set; }
    public string? ContaNome { get; set; }
    public Guid? CartaoCreditoId { get; set; }
    public string? CartaoCreditoNome { get; set; }
    public int Frequencia { get; set; }
    public string FrequenciaDescricao { get; set; } = string.Empty;
    public int Dia { get; set; }
    public DateTime DataInicio { get; set; }
    public DateTime? DataFim { get; set; }
    public bool Ativo { get; set; }
    public DateTime? DataProximaGeracao { get; set; }
    public DateTime? CanceladoEm { get; set; }
    public string? MotivoCancelamento { get; set; }

    /// <summary>
    /// Situação calculada no servidor (<see cref="SituacaoRecorrente"/>): "ativa", "pausada",
    /// "cancelada" ou "encerrada". A tela só exibe — não recalcula a regra.
    /// </summary>
    public string Situacao { get; set; } = string.Empty;
}

/// <summary>
/// Situação de uma conta fixa — regra ÚNICA usada pelo filtro da listagem (?status=) e pelo rótulo
/// do DTO. Pausada e Cancelada NÃO são a mesma coisa: pausada é temporária (Ativo=false, sem
/// cancelamento) e continua entre as ativas; cancelada (CanceladoEm preenchido) é definitiva, e
/// encerrada é a que chegou ao fim (DataFim já passou). As duas últimas vão pra aba "Encerradas".
/// </summary>
public static class SituacaoRecorrente
{
    public const string Ativa = "ativa";
    public const string Pausada = "pausada";
    public const string Cancelada = "cancelada";
    public const string Encerrada = "encerrada";

    /// <summary>Filtro da listagem: só as que seguem valendo (ativas + pausadas).</summary>
    public const string FiltroAtivas = "ativas";

    /// <summary>Filtro da listagem: só as que acabaram (canceladas + encerradas pela data fim).</summary>
    public const string FiltroEncerradas = "encerradas";
}
