using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class RegraCategoriaCompartilhavel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Compartilhavel",
                table: "RegrasCategoria",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_RegrasCategoria_Chave",
                table: "RegrasCategoria",
                column: "Chave",
                filter: "\"Compartilhavel\"");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RegrasCategoria_Chave",
                table: "RegrasCategoria");

            migrationBuilder.DropColumn(
                name: "Compartilhavel",
                table: "RegrasCategoria");
        }
    }
}
