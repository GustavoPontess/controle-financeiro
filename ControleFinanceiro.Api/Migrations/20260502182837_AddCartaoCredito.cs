using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCartaoCredito : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "ContaId",
                table: "Transacoes",
                type: "TEXT",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "TEXT");

            migrationBuilder.AddColumn<Guid>(
                name: "CartaoCreditoId",
                table: "Transacoes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CartoesCredito",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Nome = table.Column<string>(type: "TEXT", nullable: false),
                    UltimosDigitos = table.Column<string>(type: "TEXT", nullable: true),
                    Bandeira = table.Column<int>(type: "INTEGER", nullable: false),
                    Tipo = table.Column<int>(type: "INTEGER", nullable: false),
                    Limite = table.Column<decimal>(type: "TEXT", nullable: true),
                    DiaFechamento = table.Column<int>(type: "INTEGER", nullable: true),
                    DiaVencimento = table.Column<int>(type: "INTEGER", nullable: true),
                    ContaId = table.Column<Guid>(type: "TEXT", nullable: true),
                    BancoId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Ativo = table.Column<bool>(type: "INTEGER", nullable: false),
                    CriadoPor = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CartoesCredito", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CartoesCredito_Bancos_BancoId",
                        column: x => x.BancoId,
                        principalTable: "Bancos",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CartoesCredito_Contas_ContaId",
                        column: x => x.ContaId,
                        principalTable: "Contas",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Transacoes_CartaoCreditoId",
                table: "Transacoes",
                column: "CartaoCreditoId");

            migrationBuilder.CreateIndex(
                name: "IX_CartoesCredito_BancoId",
                table: "CartoesCredito",
                column: "BancoId");

            migrationBuilder.CreateIndex(
                name: "IX_CartoesCredito_ContaId",
                table: "CartoesCredito",
                column: "ContaId");

            migrationBuilder.AddForeignKey(
                name: "FK_Transacoes_CartoesCredito_CartaoCreditoId",
                table: "Transacoes",
                column: "CartaoCreditoId",
                principalTable: "CartoesCredito",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Transacoes_CartoesCredito_CartaoCreditoId",
                table: "Transacoes");

            migrationBuilder.DropTable(
                name: "CartoesCredito");

            migrationBuilder.DropIndex(
                name: "IX_Transacoes_CartaoCreditoId",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "CartaoCreditoId",
                table: "Transacoes");

            migrationBuilder.AlterColumn<Guid>(
                name: "ContaId",
                table: "Transacoes",
                type: "TEXT",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "TEXT",
                oldNullable: true);
        }
    }
}
