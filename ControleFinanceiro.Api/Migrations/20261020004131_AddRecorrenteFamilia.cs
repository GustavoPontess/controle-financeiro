using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRecorrenteFamilia : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "FamiliaId",
                table: "Assinaturas",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Assinaturas_FamiliaId",
                table: "Assinaturas",
                column: "FamiliaId");

            migrationBuilder.AddForeignKey(
                name: "FK_Assinaturas_Familias_FamiliaId",
                table: "Assinaturas",
                column: "FamiliaId",
                principalTable: "Familias",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Assinaturas_Familias_FamiliaId",
                table: "Assinaturas");

            migrationBuilder.DropIndex(
                name: "IX_Assinaturas_FamiliaId",
                table: "Assinaturas");

            migrationBuilder.DropColumn(
                name: "FamiliaId",
                table: "Assinaturas");
        }
    }
}
