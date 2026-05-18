using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDependentes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "DependenteId",
                table: "Transacoes",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Dependentes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FamiliaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Apelido = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    DataNascimento = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    Tipo = table.Column<int>(type: "integer", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Ativo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Dependentes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Dependentes_Familias_FamiliaId",
                        column: x => x.FamiliaId,
                        principalTable: "Familias",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Transacoes_DependenteId",
                table: "Transacoes",
                column: "DependenteId");

            migrationBuilder.CreateIndex(
                name: "IX_Dependentes_FamiliaId",
                table: "Dependentes",
                column: "FamiliaId");

            migrationBuilder.AddForeignKey(
                name: "FK_Transacoes_Dependentes_DependenteId",
                table: "Transacoes",
                column: "DependenteId",
                principalTable: "Dependentes",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Transacoes_Dependentes_DependenteId",
                table: "Transacoes");

            migrationBuilder.DropTable(
                name: "Dependentes");

            migrationBuilder.DropIndex(
                name: "IX_Transacoes_DependenteId",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "DependenteId",
                table: "Transacoes");
        }
    }
}
