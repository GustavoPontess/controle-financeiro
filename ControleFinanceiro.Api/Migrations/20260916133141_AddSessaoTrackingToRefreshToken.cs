using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSessaoTrackingToRefreshToken : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RefreshTokens_UsuarioId",
                table: "RefreshTokens");

            migrationBuilder.AddColumn<string>(
                name: "DispositivoInfo",
                table: "RefreshTokens",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FamiliaId",
                table: "RefreshTokens",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "IpCriacao",
                table: "RefreshTokens",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SubstituidoPorId",
                table: "RefreshTokens",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UltimoUsoEm",
                table: "RefreshTokens",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_FamiliaId",
                table: "RefreshTokens",
                column: "FamiliaId");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_UsuarioId_Revogado",
                table: "RefreshTokens",
                columns: new[] { "UsuarioId", "Revogado" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RefreshTokens_FamiliaId",
                table: "RefreshTokens");

            migrationBuilder.DropIndex(
                name: "IX_RefreshTokens_UsuarioId_Revogado",
                table: "RefreshTokens");

            migrationBuilder.DropColumn(
                name: "DispositivoInfo",
                table: "RefreshTokens");

            migrationBuilder.DropColumn(
                name: "FamiliaId",
                table: "RefreshTokens");

            migrationBuilder.DropColumn(
                name: "IpCriacao",
                table: "RefreshTokens");

            migrationBuilder.DropColumn(
                name: "SubstituidoPorId",
                table: "RefreshTokens");

            migrationBuilder.DropColumn(
                name: "UltimoUsoEm",
                table: "RefreshTokens");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_UsuarioId",
                table: "RefreshTokens",
                column: "UsuarioId");
        }
    }
}
