using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <summary>
    /// Migração de DADOS legacy para o novo modelo de Parcelamento.
    /// NÃO faz schema change — apenas UPDATE pra popular campos novos com base em dados antigos.
    /// Spec: ARQUITETURA_PARCELAMENTO.md § "Migração de dados".
    ///
    /// Mapeamento StatusFatura legacy → 3 flags novas:
    ///   Aberta(1)  → (EstadoCiclo=Aberta=0,  EstadoPagamento=NaoPago=0, EstaAtrasada=0)
    ///   Fechada(2) → (EstadoCiclo=Fechada=1, EstadoPagamento=NaoPago=0, EstaAtrasada=0)
    ///   Paga(3)    → (EstadoCiclo=Fechada=1, EstadoPagamento=Pago=2,    EstaAtrasada=0)
    ///
    /// Outros UPDATES preservam a data original em CriadoEm (substituem o sentinel
    /// 2026-05-09 que veio da migration AddParcelamentoSchema) e copiam Limite → LimiteTotal.
    ///
    /// Down() reverte os UPDATEs no que dá — mas dados que já foram alterados pelo
    /// usuário entre as duas migrations NÃO podem ser perfeitamente restaurados.
    /// </summary>
    public partial class MigrateLegacyData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1) Faturas: Status legacy → 3 flags novas
            //    StatusFatura.Aberta = 1
            migrationBuilder.Sql(@"
                UPDATE Faturas
                SET EstadoCiclo = 0,        -- Aberta
                    EstadoPagamento = 0,    -- NaoPago
                    EstaAtrasada = 0
                WHERE Status = 1;
            ");

            //    StatusFatura.Fechada = 2
            migrationBuilder.Sql(@"
                UPDATE Faturas
                SET EstadoCiclo = 1,        -- Fechada
                    EstadoPagamento = 0,    -- NaoPago
                    EstaAtrasada = 0
                WHERE Status = 2;
            ");

            //    StatusFatura.Paga = 3
            migrationBuilder.Sql(@"
                UPDATE Faturas
                SET EstadoCiclo = 1,        -- Fechada
                    EstadoPagamento = 2,    -- Pago
                    EstaAtrasada = 0,
                    DataPagamentoTotal = COALESCE(DataPagamentoTotal, datetime('now'))
                WHERE Status = 3;
            ");

            // 2) Transacoes.CriadoEm = Data (preserva data original em vez do sentinel 2026-05-09)
            migrationBuilder.Sql(@"
                UPDATE Transacoes
                SET CriadoEm = Data
                WHERE Data IS NOT NULL;
            ");

            // 3) Assinaturas.CriadoEm = DataInicio (preserva data original)
            migrationBuilder.Sql(@"
                UPDATE Assinaturas
                SET CriadoEm = DataInicio
                WHERE DataInicio IS NOT NULL;
            ");

            // 4) CartoesCredito: copia Limite legacy → LimiteTotal novo
            migrationBuilder.Sql(@"
                UPDATE CartoesCredito
                SET LimiteTotal = Limite
                WHERE Limite IS NOT NULL
                  AND LimiteTotal IS NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Revertemos LimiteTotal → null pra liberar a coluna; outros UPDATEs
            // não podem ser perfeitamente revertidos sem snapshot anterior.
            migrationBuilder.Sql(@"
                UPDATE CartoesCredito
                SET LimiteTotal = NULL
                WHERE LimiteTotal IS NOT NULL;
            ");

            // Faturas: zera flags novas (Status legacy continua intocado, então
            // ETAPA 5b conseguirá re-derivar quando refizer a migration)
            migrationBuilder.Sql(@"
                UPDATE Faturas
                SET EstadoCiclo = 0,
                    EstadoPagamento = 0,
                    EstaAtrasada = 0,
                    DataPagamentoTotal = NULL,
                    DataFechamentoEfetiva = NULL,
                    JurosDeMora = 0,
                    Multa = 0;
            ");

            // CriadoEm em Transacoes/Assinaturas: NÃO revertemos (sentinel 2026-05-09
            // já era arbitrário; reverter pra ele de novo não agrega nada).
        }
    }
}
