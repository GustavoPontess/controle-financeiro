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
    public Guid ContaId { get; set; }
    public string ContaNome { get; set; } = string.Empty;
    public int Frequencia { get; set; }
    public string FrequenciaDescricao { get; set; } = string.Empty;
    public int Dia { get; set; }
    public DateTime DataInicio { get; set; }
    public DateTime? DataFim { get; set; }
    public bool Ativo { get; set; }
    public DateTime? DataProximaGeracao { get; set; }
}
