using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class RefatorarModalidadeCartao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Tipo",
                table: "CartoesCredito",
                newName: "TemDebito");

            migrationBuilder.AddColumn<bool>(
                name: "UsadoComoCredito",
                table: "Transacoes",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "EhPrePago",
                table: "CartoesCredito",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "TemCredito",
                table: "CartoesCredito",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UsadoComoCredito",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "EhPrePago",
                table: "CartoesCredito");

            migrationBuilder.DropColumn(
                name: "TemCredito",
                table: "CartoesCredito");

            migrationBuilder.RenameColumn(
                name: "TemDebito",
                table: "CartoesCredito",
                newName: "Tipo");
        }
    }
}
