using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddParcelamentoSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Assinaturas_Contas_ContaId",
                table: "Assinaturas");

            // CORREÇÃO MANUAL: default true (toda transação existente é ativa, não soft-deleted)
            migrationBuilder.AddColumn<bool>(
                name: "Ativo",
                table: "Transacoes",
                type: "INTEGER",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CanceladoEm",
                table: "Transacoes",
                type: "TEXT",
                nullable: true);

            // CORREÇÃO MANUAL: SQLite ALTER TABLE ADD COLUMN não aceita default não-constante (datetime('now') falha).
            // Usar sentinel constante 2026-05-09 (data do upgrade). ETAPA 5 fará UPDATE Transacoes SET CriadoEm = Data.
            migrationBuilder.AddColumn<DateTime>(
                name: "CriadoEm",
                table: "Transacoes",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(2026, 5, 9, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.AddColumn<bool>(
                name: "EhPagamentoFatura",
                table: "Transacoes",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "FaturaPagaId",
                table: "Transacoes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MotivoCancelamento",
                table: "Transacoes",
                type: "TEXT",
                maxLength: 400,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ParcelaTransacaoId",
                table: "Transacoes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ParcelamentoId",
                table: "Transacoes",
                type: "TEXT",
                nullable: true);

            // CORREÇÃO MANUAL: default = 1 (Executado). Transações existentes são reais, não previsão.
            // Default da entidade C# também é Executado, mas EF Core ignora pra DDL — só usa default(int)=0.
            migrationBuilder.AddColumn<int>(
                name: "StatusTransacao",
                table: "Transacoes",
                type: "INTEGER",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<DateTime>(
                name: "DataFechamentoEfetiva",
                table: "Faturas",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DataPagamentoTotal",
                table: "Faturas",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "EstaAtrasada",
                table: "Faturas",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "EstadoCiclo",
                table: "Faturas",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "EstadoPagamento",
                table: "Faturas",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "JurosDeMora",
                table: "Faturas",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "Multa",
                table: "Faturas",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "LimiteTotal",
                table: "CartoesCredito",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "ContaId",
                table: "Assinaturas",
                type: "TEXT",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "TEXT");

            migrationBuilder.AddColumn<DateTime>(
                name: "CanceladoEm",
                table: "Assinaturas",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CartaoCreditoId",
                table: "Assinaturas",
                type: "TEXT",
                nullable: true);

            // CORREÇÃO MANUAL: SQLite ALTER TABLE ADD COLUMN não aceita default não-constante.
            // Sentinel constante 2026-05-09. ETAPA 5 fará UPDATE Assinaturas SET CriadoEm = DataInicio.
            migrationBuilder.AddColumn<DateTime>(
                name: "CriadoEm",
                table: "Assinaturas",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(2026, 5, 9, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.AddColumn<string>(
                name: "MotivoCancelamento",
                table: "Assinaturas",
                type: "TEXT",
                maxLength: 400,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "FinancialEventLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    CriadoPor = table.Column<Guid>(type: "TEXT", nullable: false),
                    Tipo = table.Column<int>(type: "INTEGER", nullable: false),
                    EntidadeAfetada = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    EntidadeId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ValorAntes = table.Column<decimal>(type: "TEXT", nullable: true),
                    ValorDepois = table.Column<decimal>(type: "TEXT", nullable: true),
                    PayloadJson = table.Column<string>(type: "TEXT", nullable: true),
                    CorrelationId = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrigemAcao = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FinancialEventLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Parcelamentos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    CriadoPor = table.Column<Guid>(type: "TEXT", nullable: false),
                    Tipo = table.Column<int>(type: "INTEGER", nullable: false),
                    Descricao = table.Column<string>(type: "TEXT", maxLength: 400, nullable: false),
                    DataCompra = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ValorTotal = table.Column<decimal>(type: "TEXT", nullable: false),
                    ValorComJuros = table.Column<decimal>(type: "TEXT", nullable: true),
                    QuantidadeParcelas = table.Column<int>(type: "INTEGER", nullable: false),
                    TaxaJuroMensal = table.Column<decimal>(type: "TEXT", nullable: true),
                    CartaoCreditoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CategoriaId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Ativo = table.Column<bool>(type: "INTEGER", nullable: false),
                    CanceladoEm = table.Column<DateTime>(type: "TEXT", nullable: true),
                    MotivoCancelamento = table.Column<string>(type: "TEXT", maxLength: 400, nullable: true),
                    CriadoEm = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Parcelamentos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Parcelamentos_CartoesCredito_CartaoCreditoId",
                        column: x => x.CartaoCreditoId,
                        principalTable: "CartoesCredito",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Parcelamentos_Categorias_CategoriaId",
                        column: x => x.CategoriaId,
                        principalTable: "Categorias",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ParcelasTransacao",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParcelamentoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Numero = table.Column<int>(type: "INTEGER", nullable: false),
                    QuantidadeTotal = table.Column<int>(type: "INTEGER", nullable: false),
                    DataVencimento = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Valor = table.Column<decimal>(type: "TEXT", nullable: false),
                    ValorComJuros = table.Column<decimal>(type: "TEXT", nullable: true),
                    TaxaJuro = table.Column<decimal>(type: "TEXT", nullable: true),
                    IOF = table.Column<decimal>(type: "TEXT", nullable: true),
                    FaturaId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    PagoEm = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CanceladoEm = table.Column<DateTime>(type: "TEXT", nullable: true),
                    MotivoCancelamento = table.Column<string>(type: "TEXT", maxLength: 400, nullable: true),
                    CriadoEm = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CriadoPor = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParcelasTransacao", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ParcelasTransacao_Faturas_FaturaId",
                        column: x => x.FaturaId,
                        principalTable: "Faturas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ParcelasTransacao_Parcelamentos_ParcelamentoId",
                        column: x => x.ParcelamentoId,
                        principalTable: "Parcelamentos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Transacoes_FaturaPagaId",
                table: "Transacoes",
                column: "FaturaPagaId");

            migrationBuilder.CreateIndex(
                name: "IX_Transacoes_ParcelamentoId",
                table: "Transacoes",
                column: "ParcelamentoId");

            migrationBuilder.CreateIndex(
                name: "IX_Transacoes_ParcelaTransacaoId",
                table: "Transacoes",
                column: "ParcelaTransacaoId");

            migrationBuilder.CreateIndex(
                name: "IX_Assinaturas_CartaoCreditoId",
                table: "Assinaturas",
                column: "CartaoCreditoId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialEventLogs_CorrelationId",
                table: "FinancialEventLogs",
                column: "CorrelationId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialEventLogs_CriadoPor_CriadoEm",
                table: "FinancialEventLogs",
                columns: new[] { "CriadoPor", "CriadoEm" });

            migrationBuilder.CreateIndex(
                name: "IX_FinancialEventLogs_EntidadeAfetada_EntidadeId",
                table: "FinancialEventLogs",
                columns: new[] { "EntidadeAfetada", "EntidadeId" });

            migrationBuilder.CreateIndex(
                name: "IX_Parcelamentos_CartaoCreditoId",
                table: "Parcelamentos",
                column: "CartaoCreditoId");

            migrationBuilder.CreateIndex(
                name: "IX_Parcelamentos_CategoriaId",
                table: "Parcelamentos",
                column: "CategoriaId");

            migrationBuilder.CreateIndex(
                name: "IX_ParcelasTransacao_FaturaId",
                table: "ParcelasTransacao",
                column: "FaturaId");

            migrationBuilder.CreateIndex(
                name: "IX_ParcelasTransacao_ParcelamentoId",
                table: "ParcelasTransacao",
                column: "ParcelamentoId");

            migrationBuilder.AddForeignKey(
                name: "FK_Assinaturas_CartoesCredito_CartaoCreditoId",
                table: "Assinaturas",
                column: "CartaoCreditoId",
                principalTable: "CartoesCredito",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Assinaturas_Contas_ContaId",
                table: "Assinaturas",
                column: "ContaId",
                principalTable: "Contas",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Transacoes_Faturas_FaturaPagaId",
                table: "Transacoes",
                column: "FaturaPagaId",
                principalTable: "Faturas",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Transacoes_Parcelamentos_ParcelamentoId",
                table: "Transacoes",
                column: "ParcelamentoId",
                principalTable: "Parcelamentos",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Transacoes_ParcelasTransacao_ParcelaTransacaoId",
                table: "Transacoes",
                column: "ParcelaTransacaoId",
                principalTable: "ParcelasTransacao",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Assinaturas_CartoesCredito_CartaoCreditoId",
                table: "Assinaturas");

            migrationBuilder.DropForeignKey(
                name: "FK_Assinaturas_Contas_ContaId",
                table: "Assinaturas");

            migrationBuilder.DropForeignKey(
                name: "FK_Transacoes_Faturas_FaturaPagaId",
                table: "Transacoes");

            migrationBuilder.DropForeignKey(
                name: "FK_Transacoes_Parcelamentos_ParcelamentoId",
                table: "Transacoes");

            migrationBuilder.DropForeignKey(
                name: "FK_Transacoes_ParcelasTransacao_ParcelaTransacaoId",
                table: "Transacoes");

            migrationBuilder.DropTable(
                name: "FinancialEventLogs");

            migrationBuilder.DropTable(
                name: "ParcelasTransacao");

            migrationBuilder.DropTable(
                name: "Parcelamentos");

            migrationBuilder.DropIndex(
                name: "IX_Transacoes_FaturaPagaId",
                table: "Transacoes");

            migrationBuilder.DropIndex(
                name: "IX_Transacoes_ParcelamentoId",
                table: "Transacoes");

            migrationBuilder.DropIndex(
                name: "IX_Transacoes_ParcelaTransacaoId",
                table: "Transacoes");

            migrationBuilder.DropIndex(
                name: "IX_Assinaturas_CartaoCreditoId",
                table: "Assinaturas");

            migrationBuilder.DropColumn(
                name: "Ativo",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "CanceladoEm",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "CriadoEm",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "EhPagamentoFatura",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "FaturaPagaId",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "MotivoCancelamento",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "ParcelaTransacaoId",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "ParcelamentoId",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "StatusTransacao",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "DataFechamentoEfetiva",
                table: "Faturas");

            migrationBuilder.DropColumn(
                name: "DataPagamentoTotal",
                table: "Faturas");

            migrationBuilder.DropColumn(
                name: "EstaAtrasada",
                table: "Faturas");

            migrationBuilder.DropColumn(
                name: "EstadoCiclo",
                table: "Faturas");

            migrationBuilder.DropColumn(
                name: "EstadoPagamento",
                table: "Faturas");

            migrationBuilder.DropColumn(
                name: "JurosDeMora",
                table: "Faturas");

            migrationBuilder.DropColumn(
                name: "Multa",
                table: "Faturas");

            migrationBuilder.DropColumn(
                name: "LimiteTotal",
                table: "CartoesCredito");

            migrationBuilder.DropColumn(
                name: "CanceladoEm",
                table: "Assinaturas");

            migrationBuilder.DropColumn(
                name: "CartaoCreditoId",
                table: "Assinaturas");

            migrationBuilder.DropColumn(
                name: "CriadoEm",
                table: "Assinaturas");

            migrationBuilder.DropColumn(
                name: "MotivoCancelamento",
                table: "Assinaturas");

            migrationBuilder.AlterColumn<Guid>(
                name: "ContaId",
                table: "Assinaturas",
                type: "TEXT",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "TEXT",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Assinaturas_Contas_ContaId",
                table: "Assinaturas",
                column: "ContaId",
                principalTable: "Contas",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
