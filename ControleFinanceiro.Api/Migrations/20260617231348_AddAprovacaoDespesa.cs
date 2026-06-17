using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAprovacaoDespesa : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AprovadoEm",
                table: "Transacoes",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "AprovadoPorUsuarioId",
                table: "Transacoes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "StatusAprovacao",
                table: "Transacoes",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "LimiteAprovacao",
                table: "Familias",
                type: "numeric",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AprovadoEm",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "AprovadoPorUsuarioId",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "StatusAprovacao",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "LimiteAprovacao",
                table: "Familias");
        }
    }
}
