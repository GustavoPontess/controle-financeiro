using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRecorrente : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "RecorrenteOrigemId",
                table: "Transacoes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Recorrentes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Descricao = table.Column<string>(type: "TEXT", maxLength: 400, nullable: false),
                    Valor = table.Column<decimal>(type: "TEXT", nullable: false),
                    Tipo = table.Column<int>(type: "INTEGER", nullable: false),
                    CategoriaId = table.Column<Guid>(type: "TEXT", nullable: true),
                    ContaId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Frequencia = table.Column<int>(type: "INTEGER", nullable: false),
                    Dia = table.Column<int>(type: "INTEGER", nullable: false),
                    DataInicio = table.Column<DateTime>(type: "TEXT", nullable: false),
                    DataFim = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Ativo = table.Column<bool>(type: "INTEGER", nullable: false),
                    CriadoPor = table.Column<Guid>(type: "TEXT", nullable: false),
                    DataProximaGeracao = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Recorrentes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Recorrentes_Categorias_CategoriaId",
                        column: x => x.CategoriaId,
                        principalTable: "Categorias",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Recorrentes_Contas_ContaId",
                        column: x => x.ContaId,
                        principalTable: "Contas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Recorrentes_CategoriaId",
                table: "Recorrentes",
                column: "CategoriaId");

            migrationBuilder.CreateIndex(
                name: "IX_Recorrentes_ContaId",
                table: "Recorrentes",
                column: "ContaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Recorrentes");

            migrationBuilder.DropColumn(
                name: "RecorrenteOrigemId",
                table: "Transacoes");
        }
    }
}
