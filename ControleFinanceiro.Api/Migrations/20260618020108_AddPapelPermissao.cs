using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPapelPermissao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Feature 2.3 — papel de permissão. Default Membro (=2 no enum PapelFamilia),
            // então as linhas existentes (membros/convites) ficam Membro.
            migrationBuilder.AddColumn<int>(
                name: "PapelPermissao",
                table: "MembrosFamilia",
                type: "integer",
                nullable: false,
                defaultValue: 2);

            migrationBuilder.AddColumn<int>(
                name: "PapelPermissao",
                table: "ConvitesFamilia",
                type: "integer",
                nullable: false,
                defaultValue: 2);

            // Backfill: o criador de cada família vira Admin (=1).
            migrationBuilder.Sql(@"
                UPDATE ""MembrosFamilia"" AS m
                SET ""PapelPermissao"" = 1
                FROM ""Familias"" AS f
                WHERE m.""FamiliaId"" = f.""Id""
                  AND m.""UsuarioId"" = f.""CriadoPorUsuarioId"";");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PapelPermissao",
                table: "MembrosFamilia");

            migrationBuilder.DropColumn(
                name: "PapelPermissao",
                table: "ConvitesFamilia");
        }
    }
}
