namespace ControleFinanceiro.Api.DTOs.Fatura;

public class FaturaDto
{
    public Guid Id { get; set; }
    public Guid CartaoCreditoId { get; set; }
    public string CartaoCreditoNome { get; set; } = string.Empty;
    public DateTime DataInicio { get; set; }
    public DateTime DataFechamento { get; set; }
    public DateTime DataVencimento { get; set; }

    // ── 3 flags ortogonais (ARQUITETURA_PARCELAMENTO.md § "Fatura (Mudanças)") ──
    /// <summary>0=Aberta, 1=Fechada</summary>
    public int EstadoCiclo { get; set; }
    /// <summary>0=NaoPago, 1=Parcial, 2=Pago</summary>
    public int EstadoPagamento { get; set; }
    public bool EstaAtrasada { get; set; }
    public DateTime? DataPagamentoTotal { get; set; }

    public decimal ValorTotal { get; set; }
    public decimal ValorPago { get; set; }
    public decimal ValorRestante { get; set; }
    /// <summary>Pago acima das compras que estão no app: o que falta detalhar (importar a fatura). Nunca negativo.</summary>
    public decimal ValorADetalhar { get; set; }
    /// <summary>Passou do vencimento e ainda resta pagar (ValorRestante &gt; 0). Fatura coberta ou zerada nunca é vencida.</summary>
    public bool Vencida { get; set; }
}

public class FaturaDetalheDto : FaturaDto
{
    public List<FaturaTransacaoDto> Transacoes { get; set; } = new();

    /// <summary>
    /// Parcelas de parcelamento que caíram nesta fatura (as que entram no total — a Cancelada fica
    /// fora). Transacoes + Parcelas = ValorTotal: sem elas a fatura cobrava R$ 450 e a lista dizia
    /// "nenhuma transação".
    /// </summary>
    public List<FaturaParcelaDto> Parcelas { get; set; } = new();

    /// <summary>Pagamentos registrados nesta fatura (transações com FaturaPagaId).</summary>
    public List<FaturaPagamentoDto> Pagamentos { get; set; } = new();
}

/// <summary>Uma parcela (ParcelaTransacao) na lista de lançamentos da fatura.</summary>
public class FaturaParcelaDto
{
    public Guid Id { get; set; }
    public Guid ParcelamentoId { get; set; }
    /// <summary>Descrição do Parcelamento (a parcela não tem descrição própria).</summary>
    public string Descricao { get; set; } = string.Empty;
    /// <summary>Número desta parcela (o "2" de 2/3).</summary>
    public int Numero { get; set; }
    /// <summary>Total de parcelas (o "3" de 2/3).</summary>
    public int QuantidadeTotal { get; set; }
    /// <summary>O mesmo valor que entra no total da fatura (com juros quando houver).</summary>
    public decimal Valor { get; set; }
    /// <summary>Data da COMPRA do parcelamento — como no extrato do banco ("15/07 Loja 02/03").</summary>
    public DateTime Data { get; set; }
    /// <summary>Quando o parcelamento foi registrado — ordena a linha do tempo, igual às compras.</summary>
    public DateTime CriadoEm { get; set; }
    public Guid? CategoriaId { get; set; }
    public string? CategoriaDescricao { get; set; }
    /// <summary>
    /// 0=Pendente, 1=Paga (Cancelada não vem). Só informativo: pagar a fatura abate o total dela e não
    /// muda o status da parcela, então a tela não marca linha nenhuma como "paga".
    /// </summary>
    public int Status { get; set; }
}

public class FaturaPagamentoDto
{
    public Guid Id { get; set; }
    public decimal Valor { get; set; }
    public DateTime Data { get; set; }
    public DateTime CriadoEm { get; set; }
    public int MeioPagamento { get; set; }
    public string MeioPagamentoDescricao { get; set; } = string.Empty;
}

public class FaturaTransacaoDto
{
    public Guid Id { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public DateTime Data { get; set; }
    public DateTime CriadoEm { get; set; }
    public Guid? CategoriaId { get; set; }
    public string? CategoriaDescricao { get; set; }
}

/// <summary>
/// Um lançamento da fatura na lista paginada: compra à vista, parcela de parcelamento ou pagamento.
/// Mesmos itens (e mesmas regras de total) do <see cref="FaturaDetalheDto"/>, numa lista só.
/// </summary>
public class LancamentoFaturaDto
{
    public Guid Id { get; set; }
    /// <summary>"compra" | "parcela" | "pagamento".</summary>
    public string Tipo { get; set; } = string.Empty;
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public DateTime Data { get; set; }
    public DateTime CriadoEm { get; set; }
    public Guid? CategoriaId { get; set; }
    public string? CategoriaDescricao { get; set; }
    /// <summary>Parcela: o "2" e o "3" de 2/3.</summary>
    public int? Numero { get; set; }
    public int? QuantidadeTotal { get; set; }
    public Guid? ParcelamentoId { get; set; }
    /// <summary>Pagamento: o meio (Pix, débito…).</summary>
    public string? MeioPagamentoDescricao { get; set; }
}

public class PagarFaturaDto
{
    public Guid ContaId { get; set; }
    public decimal Valor { get; set; }
    public DateTime DataPagamento { get; set; }
    public int MeioPagamento { get; set; } = 4; // Pix por padrão
}

/// <summary>Estorno de um pagamento de fatura (o pagamento foi feito por engano ou o banco devolveu).</summary>
public class EstornarPagamentoDto
{
    /// <summary>Por quê (opcional) — fica no lançamento cancelado e na trilha de auditoria.</summary>
    [System.ComponentModel.DataAnnotations.MaxLength(300)]
    public string? Motivo { get; set; }
}

/// <summary>Como a fatura ficou depois do estorno.</summary>
public class EstornoPagamentoResultadoDto
{
    public Guid PagamentoId { get; set; }
    public Guid FaturaId { get; set; }
    public decimal ValorEstornado { get; set; }
    /// <summary>Quanto a fatura tem de pago depois do estorno.</summary>
    public decimal ValorPagoFatura { get; set; }
    /// <summary>Quanto a fatura volta a dever.</summary>
    public decimal RestanteFatura { get; set; }
}
