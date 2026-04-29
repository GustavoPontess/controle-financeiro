using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddNumeroConta : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "NumeroConta",
                table: "Contas",
                type: "TEXT",
                maxLength: 50,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NumeroConta",
                table: "Contas");
        }
    }
}
