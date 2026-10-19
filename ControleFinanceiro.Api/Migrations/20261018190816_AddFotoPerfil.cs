using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFotoPerfil : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "FotoPerfilEm",
                table: "Usuarios",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "FotosPerfil",
                columns: table => new
                {
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Dados = table.Column<byte[]>(type: "bytea", nullable: false),
                    TipoConteudo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    AtualizadaEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FotosPerfil", x => x.UsuarioId);
                    table.ForeignKey(
                        name: "FK_FotosPerfil_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FotosPerfil");

            migrationBuilder.DropColumn(
                name: "FotoPerfilEm",
                table: "Usuarios");
        }
    }
}
