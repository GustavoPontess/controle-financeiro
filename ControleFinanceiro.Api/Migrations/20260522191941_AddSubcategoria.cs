using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSubcategoria : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SubcategoriaId",
                table: "Transacoes",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Subcategorias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Icone = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    Cor = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CategoriaId = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Subcategorias", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Subcategorias_Categorias_CategoriaId",
                        column: x => x.CategoriaId,
                        principalTable: "Categorias",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Transacoes_SubcategoriaId",
                table: "Transacoes",
                column: "SubcategoriaId");

            migrationBuilder.CreateIndex(
                name: "IX_Subcategorias_CategoriaId",
                table: "Subcategorias",
                column: "CategoriaId");

            migrationBuilder.CreateIndex(
                name: "IX_Subcategorias_UsuarioId_CategoriaId",
                table: "Subcategorias",
                columns: new[] { "UsuarioId", "CategoriaId" });

            migrationBuilder.AddForeignKey(
                name: "FK_Transacoes_Subcategorias_SubcategoriaId",
                table: "Transacoes",
                column: "SubcategoriaId",
                principalTable: "Subcategorias",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Transacoes_Subcategorias_SubcategoriaId",
                table: "Transacoes");

            migrationBuilder.DropTable(
                name: "Subcategorias");

            migrationBuilder.DropIndex(
                name: "IX_Transacoes_SubcategoriaId",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "SubcategoriaId",
                table: "Transacoes");
        }
    }
}
