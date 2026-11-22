using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AnexosELocalizacaoDaTransacao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "Latitude",
                table: "Transacoes",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Longitude",
                table: "Transacoes",
                type: "double precision",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AnexosTransacao",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TransacaoId = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    TipoConteudo = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Tamanho = table.Column<int>(type: "integer", nullable: false),
                    Dados = table.Column<byte[]>(type: "bytea", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AnexosTransacao", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AnexosTransacao_Transacoes_TransacaoId",
                        column: x => x.TransacaoId,
                        principalTable: "Transacoes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AnexosTransacao_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AnexosTransacao_TransacaoId_CriadoEm",
                table: "AnexosTransacao",
                columns: new[] { "TransacaoId", "CriadoEm" });

            migrationBuilder.CreateIndex(
                name: "IX_AnexosTransacao_UsuarioId",
                table: "AnexosTransacao",
                column: "UsuarioId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AnexosTransacao");

            migrationBuilder.DropColumn(
                name: "Latitude",
                table: "Transacoes");

            migrationBuilder.DropColumn(
                name: "Longitude",
                table: "Transacoes");
        }
    }
}
