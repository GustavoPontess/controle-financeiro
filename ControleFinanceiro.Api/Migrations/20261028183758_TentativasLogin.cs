using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class TentativasLogin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AvisoTentativasEm",
                table: "Usuarios",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TentativasLogin",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ChaveEmail = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Falhas = table.Column<int>(type: "integer", nullable: false),
                    UltimaFalhaEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TentativasLogin", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TentativasLogin_ChaveEmail",
                table: "TentativasLogin",
                column: "ChaveEmail",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TentativasLogin");

            migrationBuilder.DropColumn(
                name: "AvisoTentativasEm",
                table: "Usuarios");
        }
    }
}
