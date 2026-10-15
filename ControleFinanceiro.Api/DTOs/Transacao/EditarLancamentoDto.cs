using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Transacao
{
    /// <summary>
    /// Edição COMPLETA de um lançamento (PUT /transacoes/{id}) — o mesmo formulário de criar vale pra editar.
    /// O que o lançamento continua sendo (despesa/receita em conta ou cartão) é alterado no lugar, inclusive
    /// conta, cartão e status. O que vira outro tipo de registro (transferência, conta fixa, parcelado) é
    /// trocado numa transação só do banco: o lançamento antigo é cancelado e o novo criado, ou nada acontece.
    /// Campos omitidos (null) de <see cref="ContaId"/>+<see cref="CartaoCreditoId"/> e de <see cref="Efetivado"/>
    /// mantêm o que está — o app atual manda só os campos de sempre e continua funcionando.
    /// </summary>
    public class EditarLancamentoDto
    {
        [MaxLength(255)]
        public string Descricao { get; set; } = string.Empty;
        public decimal Valor { get; set; }
        public int Tipo { get; set; }
        public Guid? CategoriaId { get; set; }
        public Guid? SubcategoriaId { get; set; }
        /// <summary>Conta de destino do lançamento (XOR com <see cref="CartaoCreditoId"/>). Os dois nulos = não troca.</summary>
        public Guid? ContaId { get; set; }
        public Guid? CartaoCreditoId { get; set; }
        public int? MeioPagamento { get; set; }
        /// <summary>Mais de 1: vira parcelamento no cartão (o lançamento antigo é cancelado).</summary>
        [Range(1, 360)]
        public int? Parcelas { get; set; }
        /// <summary>true = já pago/recebido (Executado); false = previsão. Null = mantém.</summary>
        public bool? Efetivado { get; set; }
        /// <summary>Dia do lançamento ("yyyy-MM-dd") — date puro, sem fuso.</summary>
        public DateOnly Data { get; set; }
        /// <summary>Hora ("HH:mm:ss") — time puro, sem fuso. Null = sem hora.</summary>
        public TimeOnly? Hora { get; set; }

        /// <summary>Presente: vira transferência entre contas (as duas pernas nascem; o lançamento antigo é cancelado).</summary>
        public TransferenciaDoLancamentoDto? Transferencia { get; set; }
        /// <summary>Presente: vira conta fixa a partir de <see cref="Data"/> (o lançamento antigo é cancelado).</summary>
        public ContaFixaDoLancamentoDto? ContaFixa { get; set; }
    }

    public class TransferenciaDoLancamentoDto
    {
        public Guid ContaOrigemId { get; set; }
        public Guid ContaDestinoId { get; set; }
    }

    public class ContaFixaDoLancamentoDto
    {
        /// <summary>FrequenciaRecorrencia: 1 semanal, 2 mensal, 3 anual.</summary>
        public int Frequencia { get; set; }
        public DateOnly? DataFim { get; set; }
    }

    /// <summary>O que a edição produziu: o próprio lançamento, ou o registro que o substituiu.</summary>
    public class EdicaoLancamentoResultadoDto
    {
        public const string TipoTransacao = "transacao";
        public const string TipoTransferencia = "transferencia";
        public const string TipoContaFixa = "contaFixa";
        public const string TipoParcelamento = "parcelamento";

        /// <summary>"transacao" | "transferencia" | "contaFixa" | "parcelamento"</summary>
        public string Tipo { get; set; } = TipoTransacao;
        /// <summary>Id do registro resultante (transação, transferência, conta fixa ou parcelamento).</summary>
        public Guid Id { get; set; }
    }
}
