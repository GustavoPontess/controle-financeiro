using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class RemoveLegacyColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NumeroParcela",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "Parcelas",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "TransacaoOrigemId",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Faturas");

            migrationBuilder.DropColumn(
                name: "Limite",
                table: "CartoesCredito");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "NumeroParcela",
                table: "Transacoes",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Parcelas",
                table: "Transacoes",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TransacaoOrigemId",
                table: "Transacoes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "Faturas",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "Limite",
                table: "CartoesCredito",
                type: "TEXT",
                nullable: true);
        }
    }
}
