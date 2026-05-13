using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <summary>
    /// ATENÇÃO — migration legada sem .Designer.cs; NÃO é reconhecida pelo EF Core.
    ///
    /// O schema de Faturas é criado por <see cref="AddParcelamentoSchema"/> (20260509025858)
    /// via SQL idempotente (CREATE TABLE IF NOT EXISTS). Bancos existentes possuem a entrada
    /// '20260505120000_AddFaturaSystem' em __EFMigrationsHistory porque o startup antigo a
    /// inseria manualmente — esse raw SQL foi removido em Issue #9. Esta classe é mantida
    /// apenas para não quebrar a cronologia do diretório; não execute nem delete para
    /// evitar confusão em revisões futuras.
    /// </summary>
    [Migration("20260505120000_AddFaturaSystem")]
    public partial class AddFaturaSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Tabela de faturas
            migrationBuilder.CreateTable(
                name: "Faturas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    CartaoCreditoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    DataInicio = table.Column<DateTime>(type: "TEXT", nullable: false),
                    DataFechamento = table.Column<DateTime>(type: "TEXT", nullable: false),
                    DataVencimento = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    ValorPago = table.Column<decimal>(type: "TEXT", nullable: false),
                    CriadoPor = table.Column<Guid>(type: "TEXT", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Faturas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Faturas_CartoesCredito_CartaoCreditoId",
                        column: x => x.CartaoCreditoId,
                        principalTable: "CartoesCredito",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Faturas_CartaoCreditoId",
                table: "Faturas",
                column: "CartaoCreditoId");

            // Novos campos na tabela Transacoes
            migrationBuilder.AddColumn<Guid>(
                name: "FaturaId",
                table: "Transacoes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Parcelas",
                table: "Transacoes",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "NumeroParcela",
                table: "Transacoes",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TransacaoOrigemId",
                table: "Transacoes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Transacoes_FaturaId",
                table: "Transacoes",
                column: "FaturaId");

            migrationBuilder.AddForeignKey(
                name: "FK_Transacoes_Faturas_FaturaId",
                table: "Transacoes",
                column: "FaturaId",
                principalTable: "Faturas",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Transacoes_Faturas_FaturaId",
                table: "Transacoes");

            migrationBuilder.DropIndex(
                name: "IX_Transacoes_FaturaId",
                table: "Transacoes");

            migrationBuilder.DropColumn(name: "FaturaId", table: "Transacoes");
            migrationBuilder.DropColumn(name: "Parcelas", table: "Transacoes");
            migrationBuilder.DropColumn(name: "NumeroParcela", table: "Transacoes");
            migrationBuilder.DropColumn(name: "TransacaoOrigemId", table: "Transacoes");

            migrationBuilder.DropTable(name: "Faturas");
        }
    }
}
