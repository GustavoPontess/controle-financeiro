using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class RenameRecorrentesToAssinaturas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Recorrentes_Categorias_CategoriaId",
                table: "Recorrentes");

            migrationBuilder.DropForeignKey(
                name: "FK_Recorrentes_Contas_ContaId",
                table: "Recorrentes");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Recorrentes",
                table: "Recorrentes");

            migrationBuilder.RenameTable(
                name: "Recorrentes",
                newName: "Assinaturas");

            migrationBuilder.RenameIndex(
                name: "IX_Recorrentes_ContaId",
                table: "Assinaturas",
                newName: "IX_Assinaturas_ContaId");

            migrationBuilder.RenameIndex(
                name: "IX_Recorrentes_CategoriaId",
                table: "Assinaturas",
                newName: "IX_Assinaturas_CategoriaId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Assinaturas",
                table: "Assinaturas",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Assinaturas_Categorias_CategoriaId",
                table: "Assinaturas",
                column: "CategoriaId",
                principalTable: "Categorias",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Assinaturas_Contas_ContaId",
                table: "Assinaturas",
                column: "ContaId",
                principalTable: "Contas",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Assinaturas_Categorias_CategoriaId",
                table: "Assinaturas");

            migrationBuilder.DropForeignKey(
                name: "FK_Assinaturas_Contas_ContaId",
                table: "Assinaturas");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Assinaturas",
                table: "Assinaturas");

            migrationBuilder.RenameTable(
                name: "Assinaturas",
                newName: "Recorrentes");

            migrationBuilder.RenameIndex(
                name: "IX_Assinaturas_ContaId",
                table: "Recorrentes",
                newName: "IX_Recorrentes_ContaId");

            migrationBuilder.RenameIndex(
                name: "IX_Assinaturas_CategoriaId",
                table: "Recorrentes",
                newName: "IX_Recorrentes_CategoriaId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Recorrentes",
                table: "Recorrentes",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Recorrentes_Categorias_CategoriaId",
                table: "Recorrentes",
                column: "CategoriaId",
                principalTable: "Categorias",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Recorrentes_Contas_ContaId",
                table: "Recorrentes",
                column: "ContaId",
                principalTable: "Contas",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
