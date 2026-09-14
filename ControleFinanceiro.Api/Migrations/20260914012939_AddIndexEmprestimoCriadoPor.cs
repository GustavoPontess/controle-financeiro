using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddIndexEmprestimoCriadoPor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Emprestimos_CriadoPor_Quitado_DataVencimento_DataInicio",
                table: "Emprestimos",
                columns: new[] { "CriadoPor", "Quitado", "DataVencimento", "DataInicio" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Emprestimos_CriadoPor_Quitado_DataVencimento_DataInicio",
                table: "Emprestimos");
        }
    }
}
