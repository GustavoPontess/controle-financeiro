using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <summary>
    /// O planejado das Receitas passa a ser por FONTE (2026-10-22): a subcategoria (Salário, Freela… dentro de Renda).
    /// Coluna nova anulável (as linhas que existem seguem valendo pra categoria inteira), FK em cascata (o planejado de
    /// uma subcategoria some com ela) e o índice único ganha a subcategoria.
    /// </summary>
    public partial class AddSubcategoriaNoPlanejado : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Orcamentos_UsuarioId_CategoriaId_Mes_Ano",
                table: "Orcamentos");

            migrationBuilder.AddColumn<Guid>(
                name: "SubcategoriaId",
                table: "Orcamentos",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Orcamentos_SubcategoriaId",
                table: "Orcamentos",
                column: "SubcategoriaId");

            migrationBuilder.CreateIndex(
                name: "IX_Orcamentos_UsuarioId_CategoriaId_SubcategoriaId_Mes_Ano",
                table: "Orcamentos",
                columns: new[] { "UsuarioId", "CategoriaId", "SubcategoriaId", "Mes", "Ano" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Orcamentos_Subcategorias_SubcategoriaId",
                table: "Orcamentos",
                column: "SubcategoriaId",
                principalTable: "Subcategorias",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Orcamentos_Subcategorias_SubcategoriaId",
                table: "Orcamentos");

            migrationBuilder.DropIndex(
                name: "IX_Orcamentos_SubcategoriaId",
                table: "Orcamentos");

            migrationBuilder.DropIndex(
                name: "IX_Orcamentos_UsuarioId_CategoriaId_SubcategoriaId_Mes_Ano",
                table: "Orcamentos");

            migrationBuilder.DropColumn(
                name: "SubcategoriaId",
                table: "Orcamentos");

            migrationBuilder.CreateIndex(
                name: "IX_Orcamentos_UsuarioId_CategoriaId_Mes_Ano",
                table: "Orcamentos",
                columns: new[] { "UsuarioId", "CategoriaId", "Mes", "Ano" },
                unique: true);
        }
    }
}
