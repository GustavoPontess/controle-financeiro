using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Transacao
{
    public class CriarTransacaoDto
    {
        [MaxLength(255)]
        public string Descricao { get; set; } = string.Empty;
        public decimal Valor { get; set; }
        public int Tipo { get; set; }
        public Guid CategoriaId { get; set; }
        public Guid? SubcategoriaId { get; set; }
        public Guid? ContaId { get; set; }
        public Guid? CartaoCreditoId { get; set; }
        public bool UsadoComoCredito { get; set; }
        public int? MeioPagamento { get; set; }
        // Parcelamento: 1 = à vista (ou null). > 1 = gera N transações em N faturas
        [Range(1, 360)]
        public int? Parcelas { get; set; }
        // true (default) = já recebido/pago → Executado (entra no saldo real, com hora).
        // false = previsão (ex.: salário do próximo mês ainda não caiu) → Previsao.
        public bool Efetivado { get; set; } = true;
        /// <summary>Dia do lançamento ("yyyy-MM-dd") — date puro, sem fuso.</summary>
        public DateOnly Data { get; set; }
        /// <summary>Hora do lançamento ("HH:mm:ss") — time puro, sem fuso. Null = sem hora.</summary>
        public TimeOnly? Hora { get; set; }
        /// <summary>Despesa que já nasce dividida com esta família ("Dividir com a família" na nova despesa). Só despesa à
        /// vista; a parte de cada um é gravada na hora pela regra da família.</summary>
        public Guid? FamiliaId { get; set; }
    }
}
