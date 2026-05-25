using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMeta : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Metas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "text", nullable: false),
                    Descricao = table.Column<string>(type: "text", nullable: true),
                    ValorAlvo = table.Column<decimal>(type: "numeric", nullable: false),
                    ValorAtual = table.Column<decimal>(type: "numeric", nullable: false),
                    DataLimite = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    FamiliaId = table.Column<Guid>(type: "uuid", nullable: true),
                    CategoriaId = table.Column<Guid>(type: "uuid", nullable: true),
                    Ativo = table.Column<bool>(type: "boolean", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    AtualizadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Metas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Metas_Categorias_CategoriaId",
                        column: x => x.CategoriaId,
                        principalTable: "Categorias",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Metas_Familias_FamiliaId",
                        column: x => x.FamiliaId,
                        principalTable: "Familias",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Metas_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Metas_CategoriaId",
                table: "Metas",
                column: "CategoriaId");

            migrationBuilder.CreateIndex(
                name: "IX_Metas_FamiliaId",
                table: "Metas",
                column: "FamiliaId");

            migrationBuilder.CreateIndex(
                name: "IX_Metas_UsuarioId",
                table: "Metas",
                column: "UsuarioId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Metas");
        }
    }
}
