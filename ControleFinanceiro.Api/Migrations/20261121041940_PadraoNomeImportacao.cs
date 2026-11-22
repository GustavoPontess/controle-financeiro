using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class PadraoNomeImportacao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PadroesNomeImportacao",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Antes = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Depois = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    AtualizadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PadroesNomeImportacao", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PadroesNomeImportacao_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PadroesNomeImportacao_UsuarioId_Antes",
                table: "PadroesNomeImportacao",
                columns: new[] { "UsuarioId", "Antes" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PadroesNomeImportacao");
        }
    }
}
