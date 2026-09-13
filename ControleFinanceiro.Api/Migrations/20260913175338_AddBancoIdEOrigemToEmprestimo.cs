using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBancoIdEOrigemToEmprestimo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "BancoId",
                table: "Emprestimos",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Origem",
                table: "Emprestimos",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.CreateIndex(
                name: "IX_Emprestimos_BancoId",
                table: "Emprestimos",
                column: "BancoId");

            migrationBuilder.AddForeignKey(
                name: "FK_Emprestimos_Bancos_BancoId",
                table: "Emprestimos",
                column: "BancoId",
                principalTable: "Bancos",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Emprestimos_Bancos_BancoId",
                table: "Emprestimos");

            migrationBuilder.DropIndex(
                name: "IX_Emprestimos_BancoId",
                table: "Emprestimos");

            migrationBuilder.DropColumn(
                name: "BancoId",
                table: "Emprestimos");

            migrationBuilder.DropColumn(
                name: "Origem",
                table: "Emprestimos");
        }
    }
}
