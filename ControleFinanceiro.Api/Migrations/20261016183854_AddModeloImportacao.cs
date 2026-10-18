using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddModeloImportacao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ModelosImportacao",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    ContaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Assinatura = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    ColunaData = table.Column<int>(type: "integer", nullable: false),
                    ColunaDescricao = table.Column<int>(type: "integer", nullable: false),
                    ColunaValor = table.Column<int>(type: "integer", nullable: true),
                    ColunaEntrada = table.Column<int>(type: "integer", nullable: true),
                    ColunaSaida = table.Column<int>(type: "integer", nullable: true),
                    ColunaId = table.Column<int>(type: "integer", nullable: true),
                    InverterSinal = table.Column<bool>(type: "boolean", nullable: false),
                    AtualizadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModelosImportacao", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ModelosImportacao_Contas_ContaId",
                        column: x => x.ContaId,
                        principalTable: "Contas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ModelosImportacao_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ModelosImportacao_ContaId",
                table: "ModelosImportacao",
                column: "ContaId");

            migrationBuilder.CreateIndex(
                name: "IX_ModelosImportacao_UsuarioId_ContaId_Assinatura",
                table: "ModelosImportacao",
                columns: new[] { "UsuarioId", "ContaId", "Assinatura" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ModelosImportacao");
        }
    }
}
