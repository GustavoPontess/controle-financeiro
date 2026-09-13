using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMfaTotp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "MfaAtivadoEm",
                table: "Usuarios",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "MfaAtivo",
                table: "Usuarios",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "MfaSecretoCriptografado",
                table: "Usuarios",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MfaSecretoPendenteCriptografado",
                table: "Usuarios",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "MfaBackupCodes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    CodigoHash = table.Column<string>(type: "text", nullable: false),
                    Usado = table.Column<bool>(type: "boolean", nullable: false),
                    UsadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CriadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MfaBackupCodes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MfaBackupCodes_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MfaLoginChallenges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenHash = table.Column<string>(type: "text", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MfaLoginChallenges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MfaLoginChallenges_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MfaBackupCodes_UsuarioId",
                table: "MfaBackupCodes",
                column: "UsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_MfaLoginChallenges_TokenHash",
                table: "MfaLoginChallenges",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MfaLoginChallenges_UsuarioId",
                table: "MfaLoginChallenges",
                column: "UsuarioId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MfaBackupCodes");

            migrationBuilder.DropTable(
                name: "MfaLoginChallenges");

            migrationBuilder.DropColumn(
                name: "MfaAtivadoEm",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "MfaAtivo",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "MfaSecretoCriptografado",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "MfaSecretoPendenteCriptografado",
                table: "Usuarios");
        }
    }
}
