using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <summary>
    /// Renda de cada um e o que a família vê (docs/features/familia/renda-e-visibilidade.md):
    /// - <c>RendasPrevistas</c>: a variável esperada por mês (a renda deixa de ser número digitado no membro);
    /// - <c>MembrosFamilia</c> troca <c>RendaMensal</c> por <c>VisibilidadeRenda</c> (padrão "só o peso") +
    ///   <c>RendaVisivelPara</c>; a renda manual que existia vira a variável esperada do mês corrente;
    /// - categoria padrão "Dinheiro que volta" recebe Cashback e Reembolso (que estavam em "Renda" e inflavam a
    ///   renda), com os lançamentos e contas fixas deles; "Renda" ganha as subcategorias de trabalho variável e
    ///   de benefício do governo.
    /// O SQL de dados roda ANTES de apagar a coluna. Tudo idempotente (WHERE NOT EXISTS).
    /// </summary>
    public partial class AddRendaPrevistaEVisibilidade : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RendasPrevistas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Ano = table.Column<int>(type: "integer", nullable: false),
                    Mes = table.Column<int>(type: "integer", nullable: false),
                    VariavelEsperada = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    AtualizadoEm = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RendasPrevistas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RendasPrevistas_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RendasPrevistas_UsuarioId_Ano_Mes",
                table: "RendasPrevistas",
                columns: new[] { "UsuarioId", "Ano", "Mes" },
                unique: true);

            // Quem já está na família fica no padrão "só o peso" (1) e sem lista.
            migrationBuilder.AddColumn<int>(
                name: "VisibilidadeRenda",
                table: "MembrosFamilia",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<List<Guid>>(
                name: "RendaVisivelPara",
                table: "MembrosFamilia",
                type: "uuid[]",
                nullable: false,
                defaultValueSql: "'{}'::uuid[]");

            // 1. A renda manual que a pessoa tinha digitado vira a variável esperada do mês corrente (uma por pessoa: a maior).
            migrationBuilder.Sql("""
                INSERT INTO "RendasPrevistas" ("Id", "UsuarioId", "Ano", "Mes", "VariavelEsperada", "AtualizadoEm")
                SELECT gen_random_uuid(), m."UsuarioId", EXTRACT(YEAR FROM now())::int, EXTRACT(MONTH FROM now())::int, MAX(m."RendaMensal"), now()
                FROM "MembrosFamilia" m
                WHERE m."RendaMensal" IS NOT NULL AND m."RendaMensal" > 0 AND m."Ativo"
                GROUP BY m."UsuarioId";
                """);

            // 2. Categoria padrão "Dinheiro que volta" (receita que não é renda).
            migrationBuilder.Sql("""
                INSERT INTO "Categorias" ("Id", "Descricao", "Finalidade", "UsuarioId")
                SELECT gen_random_uuid(), 'Dinheiro que volta', 2, NULL
                WHERE NOT EXISTS (SELECT 1 FROM "Categorias" WHERE "UsuarioId" IS NULL AND "Descricao" = 'Dinheiro que volta');
                """);

            // 3. Cashback e Reembolso saem de "Renda" (subcategorias padrão, os lançamentos e as contas fixas vão junto).
            migrationBuilder.Sql("""
                UPDATE "Subcategorias" s
                SET "CategoriaId" = (SELECT "Id" FROM "Categorias" WHERE "UsuarioId" IS NULL AND "Descricao" = 'Dinheiro que volta' LIMIT 1)
                WHERE s."UsuarioId" IS NULL AND s."Nome" IN ('Cashback', 'Reembolso')
                  AND s."CategoriaId" = (SELECT "Id" FROM "Categorias" WHERE "UsuarioId" IS NULL AND "Descricao" = 'Renda' LIMIT 1);

                UPDATE "Transacoes" t
                SET "CategoriaId" = s."CategoriaId"
                FROM "Subcategorias" s
                WHERE t."SubcategoriaId" = s."Id" AND s."UsuarioId" IS NULL AND s."Nome" IN ('Cashback', 'Reembolso')
                  AND t."CategoriaId" IS DISTINCT FROM s."CategoriaId";

                UPDATE "Recorrentes" r
                SET "CategoriaId" = s."CategoriaId"
                FROM "Subcategorias" s
                WHERE r."SubcategoriaId" = s."Id" AND s."UsuarioId" IS NULL AND s."Nome" IN ('Cashback', 'Reembolso')
                  AND r."CategoriaId" IS DISTINCT FROM s."CategoriaId";
                """);

            // 4. Subcategorias novas (renda variável e benefícios do governo em "Renda"; "Estorno" em "Dinheiro que volta").
            migrationBuilder.Sql("""
                UPDATE "Subcategorias" SET "Nome" = 'Outro benefício do governo'
                WHERE "UsuarioId" IS NULL AND "Nome" = 'Auxílio do governo'
                  AND NOT EXISTS (SELECT 1 FROM "Subcategorias" x WHERE x."UsuarioId" IS NULL AND x."Nome" = 'Outro benefício do governo');

                INSERT INTO "Subcategorias" ("Id", "Nome", "CategoriaId", "UsuarioId")
                SELECT gen_random_uuid(), v.nome, c."Id", NULL
                FROM (VALUES ('Comissão e variável'), ('Bolsa Família'), ('BPC / LOAS'), ('Seguro-desemprego'), ('Outro benefício do governo')) AS v(nome)
                JOIN "Categorias" c ON c."UsuarioId" IS NULL AND c."Descricao" = 'Renda'
                WHERE NOT EXISTS (SELECT 1 FROM "Subcategorias" s WHERE s."UsuarioId" IS NULL AND s."CategoriaId" = c."Id" AND s."Nome" = v.nome);

                INSERT INTO "Subcategorias" ("Id", "Nome", "CategoriaId", "UsuarioId")
                SELECT gen_random_uuid(), v.nome, c."Id", NULL
                FROM (VALUES ('Cashback'), ('Reembolso'), ('Estorno')) AS v(nome)
                JOIN "Categorias" c ON c."UsuarioId" IS NULL AND c."Descricao" = 'Dinheiro que volta'
                WHERE NOT EXISTS (SELECT 1 FROM "Subcategorias" s WHERE s."UsuarioId" IS NULL AND s."CategoriaId" = c."Id" AND s."Nome" = v.nome);
                """);

            migrationBuilder.DropColumn(
                name: "RendaMensal",
                table: "MembrosFamilia");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RendasPrevistas");

            migrationBuilder.DropColumn(
                name: "RendaVisivelPara",
                table: "MembrosFamilia");

            migrationBuilder.DropColumn(
                name: "VisibilidadeRenda",
                table: "MembrosFamilia");

            migrationBuilder.AddColumn<decimal>(
                name: "RendaMensal",
                table: "MembrosFamilia",
                type: "numeric",
                nullable: true);
        }
    }
}
