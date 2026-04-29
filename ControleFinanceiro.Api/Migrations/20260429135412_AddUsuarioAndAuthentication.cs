using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUsuarioAndAuthentication : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "UsuarioIdProprietario",
                table: "Contas",
                type: "TEXT",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "CompartilhamentosContas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ContaId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "TEXT", nullable: false),
                    PermissaoLeitura = table.Column<bool>(type: "INTEGER", nullable: false),
                    PermissaoEscrita = table.Column<bool>(type: "INTEGER", nullable: false),
                    DataCompartilhamento = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CriadoPor = table.Column<Guid>(type: "TEXT", nullable: false),
                    RelacionamentoId = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CompartilhamentosContas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CompartilhamentosContas_Contas_ContaId",
                        column: x => x.ContaId,
                        principalTable: "Contas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Relacionamentos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    UsuarioId1 = table.Column<Guid>(type: "TEXT", nullable: false),
                    UsuarioId2 = table.Column<Guid>(type: "TEXT", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    DataCriacao = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CriadoPor = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Relacionamentos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Usuarios",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Email = table.Column<string>(type: "TEXT", maxLength: 255, nullable: false),
                    PasswordHash = table.Column<string>(type: "TEXT", nullable: false),
                    Nome = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    DataNascimento = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Ativo = table.Column<bool>(type: "INTEGER", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "TEXT", nullable: false),
                    AtualizadoEm = table.Column<DateTime>(type: "TEXT", nullable: false),
                    RelacionamentoId = table.Column<Guid>(type: "TEXT", nullable: true),
                    RelacionamentoId1 = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Usuarios", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Usuarios_Relacionamentos_RelacionamentoId1",
                        column: x => x.RelacionamentoId1,
                        principalTable: "Relacionamentos",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Contas_UsuarioIdProprietario",
                table: "Contas",
                column: "UsuarioIdProprietario");

            migrationBuilder.CreateIndex(
                name: "IX_CompartilhamentosContas_ContaId_UsuarioId",
                table: "CompartilhamentosContas",
                columns: new[] { "ContaId", "UsuarioId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CompartilhamentosContas_RelacionamentoId",
                table: "CompartilhamentosContas",
                column: "RelacionamentoId");

            migrationBuilder.CreateIndex(
                name: "IX_CompartilhamentosContas_UsuarioId",
                table: "CompartilhamentosContas",
                column: "UsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_Relacionamentos_UsuarioId1",
                table: "Relacionamentos",
                column: "UsuarioId1",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Usuarios_Email",
                table: "Usuarios",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Usuarios_RelacionamentoId1",
                table: "Usuarios",
                column: "RelacionamentoId1",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Contas_Usuarios_UsuarioIdProprietario",
                table: "Contas",
                column: "UsuarioIdProprietario",
                principalTable: "Usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CompartilhamentosContas_Relacionamentos_RelacionamentoId",
                table: "CompartilhamentosContas",
                column: "RelacionamentoId",
                principalTable: "Relacionamentos",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_CompartilhamentosContas_Usuarios_UsuarioId",
                table: "CompartilhamentosContas",
                column: "UsuarioId",
                principalTable: "Usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Relacionamentos_Usuarios_UsuarioId1",
                table: "Relacionamentos",
                column: "UsuarioId1",
                principalTable: "Usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Contas_Usuarios_UsuarioIdProprietario",
                table: "Contas");

            migrationBuilder.DropForeignKey(
                name: "FK_Usuarios_Relacionamentos_RelacionamentoId1",
                table: "Usuarios");

            migrationBuilder.DropTable(
                name: "CompartilhamentosContas");

            migrationBuilder.DropTable(
                name: "Relacionamentos");

            migrationBuilder.DropTable(
                name: "Usuarios");

            migrationBuilder.DropIndex(
                name: "IX_Contas_UsuarioIdProprietario",
                table: "Contas");

            migrationBuilder.DropColumn(
                name: "UsuarioIdProprietario",
                table: "Contas");
        }
    }
}
