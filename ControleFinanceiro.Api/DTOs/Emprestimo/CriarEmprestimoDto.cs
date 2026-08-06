using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Emprestimo;

public class CriarEmprestimoDto
{
    public string Descricao { get; set; } = string.Empty;
    public string Pessoa { get; set; } = string.Empty;
    public decimal ValorTotal { get; set; }
    public TipoEmprestimo Tipo { get; set; }
    public DateTime DataInicio { get; set; }
    public DateTime? DataVencimento { get; set; }
    public string? Observacao { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty;

    /// <summary>Se informado (junto com <see cref="CategoriaId"/>), cria também o lançamento
    /// real da saída/entrada (ex.: o Pix que já foi feito mas ainda não tinha sido lançado).</summary>
    public Guid? ContaId { get; set; }
    public Guid? CategoriaId { get; set; }

    /// <summary>Se informado, vincula um lançamento já existente em vez de criar outro (evita
    /// duplicar quando a pessoa já registrou essa saída/entrada por fora). Ignora
    /// ContaId/CategoriaId quando presente.</summary>
    public Guid? TransacaoExistenteId { get; set; }

    // Forma de pagamento (docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md).
    // Default AVista quando não informado — comportamento igual ao de antes desta feature.
    public FormaPagamentoEmprestimo FormaPagamento { get; set; } = FormaPagamentoEmprestimo.AVista;

    /// <summary>Obrigatório se FormaPagamento == Parcelado. Range 2-36 (mesmo do Parcelamento de cartão).</summary>
    public int? QuantidadeParcelas { get; set; }

    /// <summary>Obrigatório se FormaPagamento == Parcelado. Vencimento da parcela 1; as demais
    /// seguem mensal fixo a partir daqui.</summary>
    public DateTime? PrimeiroVencimento { get; set; }

    /// <summary>Opcional, só usado se Parcelado. % mensal sobre o valor de cada parcela.</summary>
    public decimal? TaxaJuroMensal { get; set; }

    /// <summary>Opcional, só usado se Parcelado. % livre (sem teto/mínimo) sobre a parcela quando atrasa.</summary>
    public decimal? PercentualMultaAtraso { get; set; }
}
