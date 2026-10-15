using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSubcategoriaRecorrente : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SubcategoriaId",
                table: "Assinaturas",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Assinaturas_SubcategoriaId",
                table: "Assinaturas",
                column: "SubcategoriaId");

            migrationBuilder.AddForeignKey(
                name: "FK_Assinaturas_Subcategorias_SubcategoriaId",
                table: "Assinaturas",
                column: "SubcategoriaId",
                principalTable: "Subcategorias",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Assinaturas_Subcategorias_SubcategoriaId",
                table: "Assinaturas");

            migrationBuilder.DropIndex(
                name: "IX_Assinaturas_SubcategoriaId",
                table: "Assinaturas");

            migrationBuilder.DropColumn(
                name: "SubcategoriaId",
                table: "Assinaturas");
        }
    }
}
