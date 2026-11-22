using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class RegraCategoria : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RegrasCategoria",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Chave = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Nome = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Tipo = table.Column<int>(type: "integer", nullable: false),
                    CategoriaId = table.Column<Guid>(type: "uuid", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    AtualizadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RegrasCategoria", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RegrasCategoria_Categorias_CategoriaId",
                        column: x => x.CategoriaId,
                        principalTable: "Categorias",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RegrasCategoria_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RegrasCategoria_CategoriaId",
                table: "RegrasCategoria",
                column: "CategoriaId");

            migrationBuilder.CreateIndex(
                name: "IX_RegrasCategoria_UsuarioId_Chave",
                table: "RegrasCategoria",
                columns: new[] { "UsuarioId", "Chave" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RegrasCategoria");
        }
    }
}
