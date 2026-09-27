using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRegistroIdempotenciaEConcorrenciaFatura : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Fatura.Versao (token de concorrência) mapeia pra coluna de SISTEMA xmin do Postgres, que
            // já existe em toda tabela. O scaffold gerava um AddColumn("xmin") aqui (e DropColumn no
            // Down); o Npgsql pula essas operações no SQL (conferido com `dotnet ef migrations script`),
            // mas foram removidas pra migration deixar explícito que NÃO mexe em Faturas — só cria a
            // tabela de idempotência. O snapshot continua com a propriedade mapeada (sem model changes).
            migrationBuilder.CreateTable(
                name: "RegistrosIdempotencia",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Operacao = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Chave = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ReferenciaId = table.Column<Guid>(type: "uuid", nullable: true),
                    CriadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RegistrosIdempotencia", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RegistrosIdempotencia_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RegistrosIdempotencia_UsuarioId_Operacao_Chave",
                table: "RegistrosIdempotencia",
                columns: new[] { "UsuarioId", "Operacao", "Chave" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RegistrosIdempotencia");
        }
    }
}
