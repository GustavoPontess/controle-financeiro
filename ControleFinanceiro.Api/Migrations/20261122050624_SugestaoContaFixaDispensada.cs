using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class SugestaoContaFixaDispensada : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SugestoesContaFixaDispensadas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    CartaoCreditoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Chave = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SugestoesContaFixaDispensadas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SugestoesContaFixaDispensadas_CartoesCredito_CartaoCreditoId",
                        column: x => x.CartaoCreditoId,
                        principalTable: "CartoesCredito",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SugestoesContaFixaDispensadas_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SugestoesContaFixaDispensadas_CartaoCreditoId",
                table: "SugestoesContaFixaDispensadas",
                column: "CartaoCreditoId");

            migrationBuilder.CreateIndex(
                name: "IX_SugestoesContaFixaDispensadas_UsuarioId_CartaoCreditoId_Cha~",
                table: "SugestoesContaFixaDispensadas",
                columns: new[] { "UsuarioId", "CartaoCreditoId", "Chave" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SugestoesContaFixaDispensadas");
        }
    }
}
