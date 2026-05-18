using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddImportacaoFitId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImportacaoFitId",
                table: "Transacoes",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Transacoes_ImportacaoFitId",
                table: "Transacoes",
                column: "ImportacaoFitId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Transacoes_ImportacaoFitId",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "ImportacaoFitId",
                table: "Transacoes");
        }
    }
}
