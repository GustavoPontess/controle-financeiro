using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBancos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "BancoId",
                table: "Contas",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Bancos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Nome = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Tipo = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Bancos", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Contas_BancoId",
                table: "Contas",
                column: "BancoId");

            migrationBuilder.AddForeignKey(
                name: "FK_Contas_Bancos_BancoId",
                table: "Contas",
                column: "BancoId",
                principalTable: "Bancos",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Contas_Bancos_BancoId",
                table: "Contas");

            migrationBuilder.DropTable(
                name: "Bancos");

            migrationBuilder.DropIndex(
                name: "IX_Contas_BancoId",
                table: "Contas");

            migrationBuilder.DropColumn(
                name: "BancoId",
                table: "Contas");
        }
    }
}
