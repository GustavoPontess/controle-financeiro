using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddModosRateio : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ModoRateio",
                table: "Transacoes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RendaMensal",
                table: "MembrosFamilia",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ModoRateioPadrao",
                table: "Familias",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.CreateTable(
                name: "RateiosTransacao",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TransacaoId = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Percentual = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RateiosTransacao", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RateiosTransacao_Transacoes_TransacaoId",
                        column: x => x.TransacaoId,
                        principalTable: "Transacoes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RateiosTransacao_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RateiosTransacao_TransacaoId",
                table: "RateiosTransacao",
                column: "TransacaoId");

            migrationBuilder.CreateIndex(
                name: "IX_RateiosTransacao_UsuarioId",
                table: "RateiosTransacao",
                column: "UsuarioId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RateiosTransacao");

            migrationBuilder.DropColumn(
                name: "ModoRateio",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "RendaMensal",
                table: "MembrosFamilia");

            migrationBuilder.DropColumn(
                name: "ModoRateioPadrao",
                table: "Familias");
        }
    }
}
