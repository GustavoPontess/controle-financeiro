using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStatusUsuario : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Novas colunas primeiro (Status entra com default 0 = AguardandoAprovacao).
            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "Usuarios",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "AprovadoEm",
                table: "Usuarios",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "AprovadoPor",
                table: "Usuarios",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UltimoAcessoEm",
                table: "Usuarios",
                type: "timestamp without time zone",
                nullable: true);

            // PRESERVAÇÃO DE DADOS: converte o antigo bool Ativo pro novo enum Status ANTES de dropar
            // a coluna. Quem já usava o app (Ativo=true) continua podendo logar (Status=Ativo=1);
            // conta desativada (Ativo=false) vira Bloqueado (3). Ninguém vira "AguardandoAprovacao"
            // por engano — só cadastro NOVO nasce pendente.
            migrationBuilder.Sql(
                "UPDATE \"Usuarios\" SET \"Status\" = CASE WHEN \"Ativo\" THEN 1 ELSE 3 END;");

            migrationBuilder.DropColumn(
                name: "Ativo",
                table: "Usuarios");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Recria o bool Ativo e reidrata a partir do Status: só Ativo(1) volta como true; qualquer
            // outro estado (pendente/recusado/bloqueado/exclusão) vira false (não loga) — inverso seguro.
            migrationBuilder.AddColumn<bool>(
                name: "Ativo",
                table: "Usuarios",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql(
                "UPDATE \"Usuarios\" SET \"Ativo\" = (\"Status\" = 1);");

            migrationBuilder.DropColumn(
                name: "AprovadoEm",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "AprovadoPor",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "UltimoAcessoEm",
                table: "Usuarios");
        }
    }
}
