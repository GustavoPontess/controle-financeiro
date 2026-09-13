using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRegistroAcesso : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RegistrosAcesso",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Ip = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: false),
                    Tipo = table.Column<int>(type: "integer", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RegistrosAcesso", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RegistrosAcesso_CriadoEm",
                table: "RegistrosAcesso",
                column: "CriadoEm");

            migrationBuilder.CreateIndex(
                name: "IX_RegistrosAcesso_UsuarioId",
                table: "RegistrosAcesso",
                column: "UsuarioId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RegistrosAcesso");
        }
    }
}
