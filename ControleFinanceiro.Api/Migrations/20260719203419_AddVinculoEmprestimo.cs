using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddVinculoEmprestimo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Ativo",
                table: "Emprestimos",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ContraparteUsuarioId",
                table: "Emprestimos",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ConviteExpiraEm",
                table: "Emprestimos",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ConviteTokenHash",
                table: "Emprestimos",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmailContraparte",
                table: "Emprestimos",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "StatusVinculo",
                table: "Emprestimos",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "VinculoRespondidoEm",
                table: "Emprestimos",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Emprestimos_ContraparteUsuarioId",
                table: "Emprestimos",
                column: "ContraparteUsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_Emprestimos_ConviteTokenHash",
                table: "Emprestimos",
                column: "ConviteTokenHash");

            migrationBuilder.AddForeignKey(
                name: "FK_Emprestimos_Usuarios_ContraparteUsuarioId",
                table: "Emprestimos",
                column: "ContraparteUsuarioId",
                principalTable: "Usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Emprestimos_Usuarios_ContraparteUsuarioId",
                table: "Emprestimos");

            migrationBuilder.DropIndex(
                name: "IX_Emprestimos_ContraparteUsuarioId",
                table: "Emprestimos");

            migrationBuilder.DropIndex(
                name: "IX_Emprestimos_ConviteTokenHash",
                table: "Emprestimos");

            migrationBuilder.DropColumn(
                name: "Ativo",
                table: "Emprestimos");

            migrationBuilder.DropColumn(
                name: "ContraparteUsuarioId",
                table: "Emprestimos");

            migrationBuilder.DropColumn(
                name: "ConviteExpiraEm",
                table: "Emprestimos");

            migrationBuilder.DropColumn(
                name: "ConviteTokenHash",
                table: "Emprestimos");

            migrationBuilder.DropColumn(
                name: "EmailContraparte",
                table: "Emprestimos");

            migrationBuilder.DropColumn(
                name: "StatusVinculo",
                table: "Emprestimos");

            migrationBuilder.DropColumn(
                name: "VinculoRespondidoEm",
                table: "Emprestimos");
        }
    }
}
