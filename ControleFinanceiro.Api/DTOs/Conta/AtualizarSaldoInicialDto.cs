namespace ControleFinanceiro.Api.DTOs.Conta
{
    /// <summary>
    /// Edita o saldo inicial (ponto de partida) de uma conta — valor e a data de abertura.
    /// Atualiza a transação <c>EhSaldoInicial</c> da conta (ou cria, se não existir).
    /// </summary>
    public class AtualizarSaldoInicialDto
    {
        public decimal Valor { get; set; }

        /// <summary>Data de abertura do saldo inicial. Null = mantém a atual (ou hoje, se for novo).</summary>
        public DateTime? Data { get; set; }
    }
}
