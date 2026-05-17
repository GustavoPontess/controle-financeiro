using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFamiliaIdToTransacao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "FamiliaId",
                table: "Transacoes",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Transacoes_FamiliaId",
                table: "Transacoes",
                column: "FamiliaId");

            migrationBuilder.AddForeignKey(
                name: "FK_Transacoes_Familias_FamiliaId",
                table: "Transacoes",
                column: "FamiliaId",
                principalTable: "Familias",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Transacoes_Familias_FamiliaId",
                table: "Transacoes");

            migrationBuilder.DropIndex(
                name: "IX_Transacoes_FamiliaId",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "FamiliaId",
                table: "Transacoes");
        }
    }
}
