using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTransacaoVinculoEmprestimo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TransacaoId",
                table: "Emprestimos",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Emprestimos_TransacaoId",
                table: "Emprestimos",
                column: "TransacaoId");

            migrationBuilder.AddForeignKey(
                name: "FK_Emprestimos_Transacoes_TransacaoId",
                table: "Emprestimos",
                column: "TransacaoId",
                principalTable: "Transacoes",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Emprestimos_Transacoes_TransacaoId",
                table: "Emprestimos");

            migrationBuilder.DropIndex(
                name: "IX_Emprestimos_TransacaoId",
                table: "Emprestimos");

            migrationBuilder.DropColumn(
                name: "TransacaoId",
                table: "Emprestimos");
        }
    }
}
