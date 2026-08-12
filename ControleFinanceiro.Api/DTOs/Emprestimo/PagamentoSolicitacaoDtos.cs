namespace ControleFinanceiro.Api.DTOs.Emprestimo;

/// <summary>Registra pagamento — devedor OU credor podem chamar (unificado, mesmo formulário pros
/// dois papéis). Duas formas de comprovar: (1) informar Conta+Categoria+Valor+Data pra criar a
/// Transacao na hora, ou (2) informar TransacaoExistenteId pra vincular uma já lançada por fora
/// (evita duplicar). Devedor: cria Despesa, solicitação nasce Pendente. Credor: cria Receita,
/// solicitação nasce já Aprovada (confirmando o próprio recebimento).</summary>
public class SolicitarPagamentoEmprestimoDto
{
    public decimal Valor { get; set; }
    public Guid? ContaId { get; set; }
    public Guid? CategoriaId { get; set; }
    public DateTime Data { get; set; }
    /// <summary>Se informado, vincula esta despesa já existente como comprovante em vez de criar
    /// uma nova — Valor/ContaId/CategoriaId/Data são ignorados (o valor real vem da transação).</summary>
    public Guid? TransacaoExistenteId { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty;

    /// <summary>Se o empréstimo é Parcelado, informe qual EmprestimoParcela esse pagamento quita.
    /// Ignorado (empréstimo à vista continua abatendo do total "cego").</summary>
    public Guid? ParcelaId { get; set; }
}

/// <summary>Credor aprova — sempre registra a entrada de verdade, dois caminhos possíveis (mesma
/// simetria do lado do devedor): (1) TransacaoExistenteId pra vincular uma receita já lançada por
/// fora (evita duplicar), ou (2) ContaId+CategoriaId pra criar a Transacao agora. Um dos dois é
/// obrigatório — não existe "aprovar sem registrar nada".</summary>
public class AprovarPagamentoEmprestimoDto
{
    public Guid? ContaId { get; set; }
    public Guid? CategoriaId { get; set; }
    public Guid? TransacaoExistenteId { get; set; }
}

/// <summary>Credor rejeita — Motivo é opcional, texto livre, sem tamanho mínimo.</summary>
public class RejeitarPagamentoEmprestimoDto
{
    public string? Motivo { get; set; }
}

public class EmprestimoPagamentoSolicitacaoDto
{
    public Guid Id { get; set; }
    public Guid EmprestimoId { get; set; }

    /// <summary>Se o empréstimo é Parcelado, qual EmprestimoParcela essa solicitação mira. Permite
    /// o front filtrar o histórico por parcela específica (achado do Gustavo, 2026-08-12).</summary>
    public Guid? ParcelaId { get; set; }
    public decimal Valor { get; set; }
    public int StatusAprovacao { get; set; }
    public string StatusAprovacaoDescricao { get; set; } = string.Empty;
    public Guid SolicitadoPor { get; set; }
    public string SolicitadoPorNome { get; set; } = string.Empty;
    public DateTime CriadoEm { get; set; }
    public DateTime? AprovadoEm { get; set; }
    public Guid? TransacaoRecebimentoId { get; set; }
    public string? MotivoRejeicao { get; set; }

    /// <summary>True quando foi o credor quem registrou (nasceu já aprovada). Front usa isso pra
    /// não mostrar "Saída:" no histórico (não existe comprovante de saída nesse caso).</summary>
    public bool RegistradoPeloCredor { get; set; }

    /// <summary>Data real do lançamento de saída (comprovante) — pro histórico ler como extrato.</summary>
    public DateTime ComprovanteData { get; set; }
    public string? ComprovanteContaNome { get; set; }

    /// <summary>Só preenchido quando o credor informou conta ao aprovar (criou a entrada de verdade).</summary>
    public DateTime? RecebimentoData { get; set; }
    public string? RecebimentoContaNome { get; set; }
}
