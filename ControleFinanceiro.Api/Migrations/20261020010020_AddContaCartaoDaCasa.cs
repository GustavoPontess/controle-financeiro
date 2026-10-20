using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddContaCartaoDaCasa : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "FamiliaId",
                table: "Contas",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FamiliaId",
                table: "CartoesCredito",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Contas_FamiliaId",
                table: "Contas",
                column: "FamiliaId");

            migrationBuilder.CreateIndex(
                name: "IX_CartoesCredito_FamiliaId",
                table: "CartoesCredito",
                column: "FamiliaId");

            migrationBuilder.AddForeignKey(
                name: "FK_CartoesCredito_Familias_FamiliaId",
                table: "CartoesCredito",
                column: "FamiliaId",
                principalTable: "Familias",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Contas_Familias_FamiliaId",
                table: "Contas",
                column: "FamiliaId",
                principalTable: "Familias",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CartoesCredito_Familias_FamiliaId",
                table: "CartoesCredito");

            migrationBuilder.DropForeignKey(
                name: "FK_Contas_Familias_FamiliaId",
                table: "Contas");

            migrationBuilder.DropIndex(
                name: "IX_Contas_FamiliaId",
                table: "Contas");

            migrationBuilder.DropIndex(
                name: "IX_CartoesCredito_FamiliaId",
                table: "CartoesCredito");

            migrationBuilder.DropColumn(
                name: "FamiliaId",
                table: "Contas");

            migrationBuilder.DropColumn(
                name: "FamiliaId",
                table: "CartoesCredito");
        }
    }
}
