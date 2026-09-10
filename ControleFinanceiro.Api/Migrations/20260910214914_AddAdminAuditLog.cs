using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminAuditLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AdminAuditLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AdminUsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    AdminEmail = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Acao = table.Column<int>(type: "integer", nullable: false),
                    AlvoTipo = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    AlvoId = table.Column<Guid>(type: "uuid", nullable: true),
                    AlvoDescricao = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    Detalhe = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CriadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminAuditLogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdminAuditLogs_CriadoEm",
                table: "AdminAuditLogs",
                column: "CriadoEm");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdminAuditLogs");
        }
    }
}
