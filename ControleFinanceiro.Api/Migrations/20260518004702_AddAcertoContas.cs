using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAcertoContas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AcertosContas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FamiliaId = table.Column<Guid>(type: "uuid", nullable: false),
                    DeUsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParaUsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Valor = table.Column<decimal>(type: "numeric", nullable: false),
                    Mes = table.Column<int>(type: "integer", nullable: false),
                    Ano = table.Column<int>(type: "integer", nullable: false),
                    Observacao = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    CriadoPor = table.Column<Guid>(type: "uuid", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Ativo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AcertosContas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AcertosContas_Familias_FamiliaId",
                        column: x => x.FamiliaId,
                        principalTable: "Familias",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AcertosContas_Usuarios_DeUsuarioId",
                        column: x => x.DeUsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AcertosContas_Usuarios_ParaUsuarioId",
                        column: x => x.ParaUsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AcertosContas_DeUsuarioId",
                table: "AcertosContas",
                column: "DeUsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_AcertosContas_FamiliaId_Ano_Mes",
                table: "AcertosContas",
                columns: new[] { "FamiliaId", "Ano", "Mes" });

            migrationBuilder.CreateIndex(
                name: "IX_AcertosContas_ParaUsuarioId",
                table: "AcertosContas",
                column: "ParaUsuarioId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AcertosContas");
        }
    }
}
