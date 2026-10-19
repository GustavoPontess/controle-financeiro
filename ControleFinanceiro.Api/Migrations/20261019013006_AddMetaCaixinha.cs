using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMetaCaixinha : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ValorAtual",
                table: "Metas");

            migrationBuilder.AddColumn<Guid>(
                name: "ContaId",
                table: "Metas",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Icone",
                table: "Metas",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Metas_ContaId",
                table: "Metas",
                column: "ContaId",
                unique: true,
                filter: "\"ContaId\" IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_Metas_Contas_ContaId",
                table: "Metas",
                column: "ContaId",
                principalTable: "Contas",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Metas_Contas_ContaId",
                table: "Metas");

            migrationBuilder.DropIndex(
                name: "IX_Metas_ContaId",
                table: "Metas");

            migrationBuilder.DropColumn(
                name: "ContaId",
                table: "Metas");

            migrationBuilder.DropColumn(
                name: "Icone",
                table: "Metas");

            migrationBuilder.AddColumn<decimal>(
                name: "ValorAtual",
                table: "Metas",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);
        }
    }
}
