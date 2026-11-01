using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class JurosPagosDoEmprestimo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "JurosPagos",
                table: "Emprestimos",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            // Pagamentos de empréstimo de antes de 2026-11-01 não tinham os juros separados. Recalcula com a mesma regra
            // do EmprestimoService (imputação do Código Civil, art. 354): na ordem em que foram feitos, cada pagamento
            // aprovado cobre primeiro os encargos que faltam (devido − valor, na parcela ou no à vista).
            migrationBuilder.Sql(@"
WITH base AS (
    SELECT s.""Id"", s.""Valor"", s.""CriadoEm"", s.""ParcelaId"" AS grupo,
           COALESCE(p.""ValorComMulta"", p.""ValorComJuros"", p.""Valor"") - p.""Valor"" AS encargos
    FROM ""EmprestimoPagamentoSolicitacoes"" s
    JOIN ""EmprestimoParcelas"" p ON p.""Id"" = s.""ParcelaId""
    WHERE s.""StatusAprovacao"" = 2
    UNION ALL
    SELECT s.""Id"", s.""Valor"", s.""CriadoEm"", s.""EmprestimoId"" AS grupo,
           COALESCE(e.""ValorComMulta"", e.""ValorComJuros"", e.""ValorTotal"") - e.""ValorTotal"" AS encargos
    FROM ""EmprestimoPagamentoSolicitacoes"" s
    JOIN ""Emprestimos"" e ON e.""Id"" = s.""EmprestimoId""
    WHERE s.""StatusAprovacao"" = 2 AND s.""ParcelaId"" IS NULL
), ordenado AS (
    SELECT ""Id"", ""Valor"", encargos,
           COALESCE(SUM(""Valor"") OVER (PARTITION BY grupo ORDER BY ""CriadoEm"", ""Id""
                    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS pago_antes
    FROM base
)
UPDATE ""EmprestimoPagamentoSolicitacoes"" s
SET ""ValorJuros"" = NULLIF(GREATEST(0, LEAST(o.""Valor"", o.encargos - LEAST(o.pago_antes, o.encargos))), 0)
FROM ordenado o
WHERE s.""Id"" = o.""Id"" AND s.""ValorJuros"" IS NULL;");

            // O lançamento de cada pagamento leva os juros dele: o de quem recebeu e o comprovante de quem pagou.
            migrationBuilder.Sql(@"
UPDATE ""Transacoes"" t SET ""ValorJuros"" = j.juros
FROM (SELECT ""TransacaoRecebimentoId"" AS id, SUM(""ValorJuros"") AS juros FROM ""EmprestimoPagamentoSolicitacoes""
      WHERE ""StatusAprovacao"" = 2 AND ""TransacaoRecebimentoId"" IS NOT NULL GROUP BY 1) j
WHERE t.""Id"" = j.id AND t.""ValorJuros"" IS NULL AND j.juros > 0;
UPDATE ""Transacoes"" t SET ""ValorJuros"" = j.juros
FROM (SELECT ""TransacaoComprovanteId"" AS id, SUM(""ValorJuros"") AS juros FROM ""EmprestimoPagamentoSolicitacoes""
      WHERE ""StatusAprovacao"" = 2 AND ""TransacaoComprovanteId"" IS NOT NULL GROUP BY 1) j
WHERE t.""Id"" = j.id AND t.""ValorJuros"" IS NULL AND j.juros > 0;");

            // O empréstimo separa o capital devolvido (ValorPago) dos juros pagos (JurosPagos). Antes os juros somavam no
            // ValorPago. Quitado fica como está (quitar na mão põe o ValorPago no total).
            migrationBuilder.Sql(@"
UPDATE ""Emprestimos"" e
SET ""JurosPagos"" = a.juros,
    ""ValorPago"" = CASE WHEN e.""Quitado"" THEN e.""ValorPago"" ELSE LEAST(e.""ValorTotal"", a.capital) END
FROM (SELECT ""EmprestimoId"" AS id, COALESCE(SUM(""ValorJuros""), 0) AS juros, SUM(""Valor"" - COALESCE(""ValorJuros"", 0)) AS capital
      FROM ""EmprestimoPagamentoSolicitacoes"" WHERE ""StatusAprovacao"" = 2 GROUP BY 1) a
WHERE e.""Id"" = a.id;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "JurosPagos",
                table: "Emprestimos");
        }
    }
}
