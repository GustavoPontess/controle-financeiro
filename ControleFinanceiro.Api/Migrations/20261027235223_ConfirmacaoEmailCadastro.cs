using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class ConfirmacaoEmailCadastro : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "EmailConfirmadoEm",
                table: "Usuarios",
                type: "timestamp without time zone",
                nullable: true);

            // Quem já existia antes da confirmação de e-mail fica como confirmado (nunca recebeu o link; o Admin
            // decide esses pedidos como sempre decidiu). Só cadastro novo precisa confirmar.
            migrationBuilder.Sql("UPDATE \"Usuarios\" SET \"EmailConfirmadoEm\" = \"CriadoEm\" WHERE \"EmailConfirmadoEm\" IS NULL;");

            migrationBuilder.CreateTable(
                name: "TokensCadastro",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ExpiraEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Usado = table.Column<bool>(type: "boolean", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TokensCadastro", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TokensCadastro_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TokensCadastro_TokenHash",
                table: "TokensCadastro",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TokensCadastro_UsuarioId",
                table: "TokensCadastro",
                column: "UsuarioId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TokensCadastro");

            migrationBuilder.DropColumn(
                name: "EmailConfirmadoEm",
                table: "Usuarios");
        }
    }
}
