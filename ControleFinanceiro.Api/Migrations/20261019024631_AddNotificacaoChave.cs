using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificacaoChave : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Chave",
                table: "Notificacoes",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Notificacoes_UsuarioId_Chave",
                table: "Notificacoes",
                columns: new[] { "UsuarioId", "Chave" },
                unique: true,
                filter: "\"Chave\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Notificacoes_UsuarioId_Chave",
                table: "Notificacoes");

            migrationBuilder.DropColumn(
                name: "Chave",
                table: "Notificacoes");
        }
    }
}
