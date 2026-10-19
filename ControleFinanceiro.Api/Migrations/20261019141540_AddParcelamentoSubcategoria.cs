using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddParcelamentoSubcategoria : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SubcategoriaId",
                table: "Parcelamentos",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Parcelamentos_SubcategoriaId",
                table: "Parcelamentos",
                column: "SubcategoriaId");

            migrationBuilder.AddForeignKey(
                name: "FK_Parcelamentos_Subcategorias_SubcategoriaId",
                table: "Parcelamentos",
                column: "SubcategoriaId",
                principalTable: "Subcategorias",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Parcelamentos_Subcategorias_SubcategoriaId",
                table: "Parcelamentos");

            migrationBuilder.DropIndex(
                name: "IX_Parcelamentos_SubcategoriaId",
                table: "Parcelamentos");

            migrationBuilder.DropColumn(
                name: "SubcategoriaId",
                table: "Parcelamentos");
        }
    }
}
