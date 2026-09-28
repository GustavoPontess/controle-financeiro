using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <summary>
    /// Só dados, sem schema. Até a correção, <c>RecorrenteService.CriarAsync</c> gravava as primeiras
    /// ocorrências (3 meses) de uma recorrente no cartão COM fatura mas SEM <c>UsadoComoCredito</c> — o
    /// <c>ExpandirRecorrentesJob</c>, que gera as seguintes, sempre marcou. Sem a flag a ocorrência ficava
    /// fora do total da fatura (não dava pra pagar) e, efetivada, fora do limite usado. Aqui ela ganha a
    /// flag, igual às geradas pelo job.
    /// </summary>
    /// <remarks>
    /// DECISÃO — fatura já <c>Pago</c> (EstadoPagamento = 2) fica de fora: foi dada por quitada sem essa
    /// ocorrência, e cobrá-la agora deixaria restante numa fatura que não aceita mais pagamento
    /// (<c>PagarFaturaAsync</c> recusa Pago) e o limite preso sem saída. Ela segue como sempre esteve, fora
    /// do total. Mesmo tratamento do <c>ExpandirRecorrentesJob</c> ao pôr na fatura as ocorrências antigas
    /// que nem fatura tinham (essas precisam da regra de período em C#, por isso não estão aqui).
    /// </remarks>
    public partial class BackfillCreditoRecorrenteCartao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Mesma forma que CriarAsync gravava: ocorrência de recorrente (RecorrenteOrigemId), no cartão,
            // sem conta, com fatura do mesmo cartão, não é pagamento de fatura. Inclui previsão e cancelada:
            // a flag só diz "compra no crédito"; o que entra no total/limite continua decidido por Ativo e
            // StatusTransacao (RegrasFinanceiras).
            migrationBuilder.Sql(@"
                UPDATE ""Transacoes"" AS t
                SET ""UsadoComoCredito"" = true
                FROM ""Faturas"" AS f
                WHERE f.""Id"" = t.""FaturaId""
                  AND f.""CartaoCreditoId"" = t.""CartaoCreditoId""
                  AND f.""EstadoPagamento"" <> 2
                  AND t.""RecorrenteOrigemId"" IS NOT NULL
                  AND t.""CartaoCreditoId"" IS NOT NULL
                  AND t.""ContaId"" IS NULL
                  AND t.""EhPagamentoFatura"" = false
                  AND t.""UsadoComoCredito"" = false;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Sem volta: depois do Up não dá pra separar a linha corrigida da que já nasceu com a flag
            // (ExpandirRecorrentesJob) — desmarcar tudo tiraria compra legítima da fatura e do limite.
        }
    }
}
