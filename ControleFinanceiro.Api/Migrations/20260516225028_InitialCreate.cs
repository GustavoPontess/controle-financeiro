using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ControleFinanceiro.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Bancos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    NomeFantasia = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RazaoSocial = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CodigoBanco = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    Tipo = table.Column<int>(type: "integer", nullable: false),
                    Ativo = table.Column<bool>(type: "boolean", nullable: false),
                    LogoUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Cor = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Bancos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Categorias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Descricao = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Finalidade = table.Column<int>(type: "integer", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categorias", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Emprestimos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Descricao = table.Column<string>(type: "text", nullable: false),
                    Pessoa = table.Column<string>(type: "text", nullable: false),
                    ValorTotal = table.Column<decimal>(type: "numeric", nullable: false),
                    ValorPago = table.Column<decimal>(type: "numeric", nullable: false),
                    Tipo = table.Column<int>(type: "integer", nullable: false),
                    DataInicio = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DataVencimento = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Quitado = table.Column<bool>(type: "boolean", nullable: false),
                    Observacao = table.Column<string>(type: "text", nullable: true),
                    CriadoPor = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Emprestimos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FinancialEventLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CriadoPor = table.Column<Guid>(type: "uuid", nullable: false),
                    Tipo = table.Column<int>(type: "integer", nullable: false),
                    EntidadeAfetada = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    EntidadeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ValorAntes = table.Column<decimal>(type: "numeric", nullable: true),
                    ValorDepois = table.Column<decimal>(type: "numeric", nullable: true),
                    PayloadJson = table.Column<string>(type: "text", nullable: true),
                    CorrelationId = table.Column<Guid>(type: "uuid", nullable: false),
                    OrigemAcao = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FinancialEventLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Assinaturas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Descricao = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Valor = table.Column<decimal>(type: "numeric", nullable: false),
                    Tipo = table.Column<int>(type: "integer", nullable: false),
                    CategoriaId = table.Column<Guid>(type: "uuid", nullable: true),
                    ContaId = table.Column<Guid>(type: "uuid", nullable: true),
                    CartaoCreditoId = table.Column<Guid>(type: "uuid", nullable: true),
                    Frequencia = table.Column<int>(type: "integer", nullable: false),
                    Dia = table.Column<int>(type: "integer", nullable: false),
                    DataInicio = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DataFim = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Ativo = table.Column<bool>(type: "boolean", nullable: false),
                    CriadoPor = table.Column<Guid>(type: "uuid", nullable: false),
                    DataProximaGeracao = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CanceladoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MotivoCancelamento = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    CriadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Assinaturas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Assinaturas_Categorias_CategoriaId",
                        column: x => x.CategoriaId,
                        principalTable: "Categorias",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "CartoesCredito",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "text", nullable: false),
                    UltimosDigitos = table.Column<string>(type: "text", nullable: true),
                    Bandeira = table.Column<int>(type: "integer", nullable: false),
                    TemCredito = table.Column<bool>(type: "boolean", nullable: false),
                    TemDebito = table.Column<bool>(type: "boolean", nullable: false),
                    EhPrePago = table.Column<bool>(type: "boolean", nullable: false),
                    LimiteTotal = table.Column<decimal>(type: "numeric", nullable: true),
                    DiaFechamento = table.Column<int>(type: "integer", nullable: true),
                    DiaVencimento = table.Column<int>(type: "integer", nullable: true),
                    ContaId = table.Column<Guid>(type: "uuid", nullable: true),
                    BancoId = table.Column<Guid>(type: "uuid", nullable: true),
                    Ativo = table.Column<bool>(type: "boolean", nullable: false),
                    CriadoPor = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CartoesCredito", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CartoesCredito_Bancos_BancoId",
                        column: x => x.BancoId,
                        principalTable: "Bancos",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Faturas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CartaoCreditoId = table.Column<Guid>(type: "uuid", nullable: false),
                    DataInicio = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DataFechamento = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DataVencimento = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ValorPago = table.Column<decimal>(type: "numeric", nullable: false),
                    CriadoPor = table.Column<Guid>(type: "uuid", nullable: false),
                    EstadoCiclo = table.Column<int>(type: "integer", nullable: false),
                    EstadoPagamento = table.Column<int>(type: "integer", nullable: false),
                    EstaAtrasada = table.Column<bool>(type: "boolean", nullable: false),
                    DataFechamentoEfetiva = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DataPagamentoTotal = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    JurosDeMora = table.Column<decimal>(type: "numeric", nullable: false),
                    Multa = table.Column<decimal>(type: "numeric", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Faturas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Faturas_CartoesCredito_CartaoCreditoId",
                        column: x => x.CartaoCreditoId,
                        principalTable: "CartoesCredito",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Parcelamentos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CriadoPor = table.Column<Guid>(type: "uuid", nullable: false),
                    Tipo = table.Column<int>(type: "integer", nullable: false),
                    Descricao = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    DataCompra = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ValorTotal = table.Column<decimal>(type: "numeric", nullable: false),
                    ValorComJuros = table.Column<decimal>(type: "numeric", nullable: true),
                    QuantidadeParcelas = table.Column<int>(type: "integer", nullable: false),
                    TaxaJuroMensal = table.Column<decimal>(type: "numeric", nullable: true),
                    CartaoCreditoId = table.Column<Guid>(type: "uuid", nullable: false),
                    CategoriaId = table.Column<Guid>(type: "uuid", nullable: true),
                    Ativo = table.Column<bool>(type: "boolean", nullable: false),
                    CanceladoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MotivoCancelamento = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    CriadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Parcelamentos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Parcelamentos_CartoesCredito_CartaoCreditoId",
                        column: x => x.CartaoCreditoId,
                        principalTable: "CartoesCredito",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Parcelamentos_Categorias_CategoriaId",
                        column: x => x.CategoriaId,
                        principalTable: "Categorias",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ParcelasTransacao",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ParcelamentoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Numero = table.Column<int>(type: "integer", nullable: false),
                    QuantidadeTotal = table.Column<int>(type: "integer", nullable: false),
                    DataVencimento = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Valor = table.Column<decimal>(type: "numeric", nullable: false),
                    ValorComJuros = table.Column<decimal>(type: "numeric", nullable: true),
                    TaxaJuro = table.Column<decimal>(type: "numeric", nullable: true),
                    IOF = table.Column<decimal>(type: "numeric", nullable: true),
                    FaturaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    PagoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CanceladoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MotivoCancelamento = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    CriadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CriadoPor = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParcelasTransacao", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ParcelasTransacao_Faturas_FaturaId",
                        column: x => x.FaturaId,
                        principalTable: "Faturas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ParcelasTransacao_Parcelamentos_ParcelamentoId",
                        column: x => x.ParcelamentoId,
                        principalTable: "Parcelamentos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CompartilhamentosContas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ContaId = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    PermissaoLeitura = table.Column<bool>(type: "boolean", nullable: false),
                    PermissaoEscrita = table.Column<bool>(type: "boolean", nullable: false),
                    DataCompartilhamento = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CriadoPor = table.Column<Guid>(type: "uuid", nullable: false),
                    RelacionamentoId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CompartilhamentosContas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Contas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    NumeroConta = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Tipo = table.Column<int>(type: "integer", nullable: false),
                    TipoCartao = table.Column<int>(type: "integer", nullable: true),
                    IsCarteira = table.Column<bool>(type: "boolean", nullable: false),
                    BancoId = table.Column<Guid>(type: "uuid", nullable: true),
                    UsuarioIdProprietario = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Contas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Contas_Bancos_BancoId",
                        column: x => x.BancoId,
                        principalTable: "Bancos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Transacoes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Descricao = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Valor = table.Column<decimal>(type: "numeric", nullable: false),
                    Tipo = table.Column<int>(type: "integer", nullable: false),
                    CategoriaId = table.Column<Guid>(type: "uuid", nullable: true),
                    ContaId = table.Column<Guid>(type: "uuid", nullable: true),
                    CartaoCreditoId = table.Column<Guid>(type: "uuid", nullable: true),
                    UsadoComoCredito = table.Column<bool>(type: "boolean", nullable: false),
                    MeioPagamento = table.Column<int>(type: "integer", nullable: true),
                    FaturaId = table.Column<Guid>(type: "uuid", nullable: true),
                    CriadoPor = table.Column<Guid>(type: "uuid", nullable: false),
                    Data = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RecorrenteOrigemId = table.Column<Guid>(type: "uuid", nullable: true),
                    ParcelamentoId = table.Column<Guid>(type: "uuid", nullable: true),
                    ParcelaTransacaoId = table.Column<Guid>(type: "uuid", nullable: true),
                    StatusTransacao = table.Column<int>(type: "integer", nullable: false),
                    EhPagamentoFatura = table.Column<bool>(type: "boolean", nullable: false),
                    FaturaPagaId = table.Column<Guid>(type: "uuid", nullable: true),
                    Ativo = table.Column<bool>(type: "boolean", nullable: false),
                    CanceladoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MotivoCancelamento = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    CriadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Transacoes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Transacoes_CartoesCredito_CartaoCreditoId",
                        column: x => x.CartaoCreditoId,
                        principalTable: "CartoesCredito",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Transacoes_Categorias_CategoriaId",
                        column: x => x.CategoriaId,
                        principalTable: "Categorias",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Transacoes_Contas_ContaId",
                        column: x => x.ContaId,
                        principalTable: "Contas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Transacoes_Faturas_FaturaId",
                        column: x => x.FaturaId,
                        principalTable: "Faturas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Transacoes_Faturas_FaturaPagaId",
                        column: x => x.FaturaPagaId,
                        principalTable: "Faturas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Transacoes_Parcelamentos_ParcelamentoId",
                        column: x => x.ParcelamentoId,
                        principalTable: "Parcelamentos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Transacoes_ParcelasTransacao_ParcelaTransacaoId",
                        column: x => x.ParcelaTransacaoId,
                        principalTable: "ParcelasTransacao",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Transferencias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ContaOrigemId = table.Column<Guid>(type: "uuid", nullable: false),
                    ContaDestinoId = table.Column<Guid>(type: "uuid", nullable: false),
                    Valor = table.Column<decimal>(type: "numeric", nullable: false),
                    Data = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Descricao = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    CriadoPor = table.Column<Guid>(type: "uuid", nullable: false),
                    TransacaoOrigemId = table.Column<Guid>(type: "uuid", nullable: false),
                    TransacaoDestinoId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Transferencias", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Transferencias_Contas_ContaDestinoId",
                        column: x => x.ContaDestinoId,
                        principalTable: "Contas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Transferencias_Contas_ContaOrigemId",
                        column: x => x.ContaOrigemId,
                        principalTable: "Contas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Orcamentos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    CategoriaId = table.Column<Guid>(type: "uuid", nullable: true),
                    Mes = table.Column<int>(type: "integer", nullable: false),
                    Ano = table.Column<int>(type: "integer", nullable: false),
                    ValorLimite = table.Column<decimal>(type: "numeric", nullable: false),
                    PercentualAlerta = table.Column<decimal>(type: "numeric", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AtualizadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Orcamentos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Orcamentos_Categorias_CategoriaId",
                        column: x => x.CategoriaId,
                        principalTable: "Categorias",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "PasswordResetTokens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Token = table.Column<string>(type: "text", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Usado = table.Column<bool>(type: "boolean", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PasswordResetTokens", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RefreshTokens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Token = table.Column<string>(type: "text", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Revogado = table.Column<bool>(type: "boolean", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RefreshTokens", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Relacionamentos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId1 = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId2 = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    DataCriacao = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CriadoPor = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Relacionamentos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Usuarios",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    Nome = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    DataNascimento = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Ativo = table.Column<bool>(type: "boolean", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AtualizadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RelacionamentoId = table.Column<Guid>(type: "uuid", nullable: true),
                    RelacionamentoId1 = table.Column<Guid>(type: "uuid", nullable: true)
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
                name: "IX_Assinaturas_CartaoCreditoId",
                table: "Assinaturas",
                column: "CartaoCreditoId");

            migrationBuilder.CreateIndex(
                name: "IX_Assinaturas_CategoriaId",
                table: "Assinaturas",
                column: "CategoriaId");

            migrationBuilder.CreateIndex(
                name: "IX_Assinaturas_ContaId",
                table: "Assinaturas",
                column: "ContaId");

            migrationBuilder.CreateIndex(
                name: "IX_CartoesCredito_BancoId",
                table: "CartoesCredito",
                column: "BancoId");

            migrationBuilder.CreateIndex(
                name: "IX_CartoesCredito_ContaId",
                table: "CartoesCredito",
                column: "ContaId");

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
                name: "IX_Contas_BancoId",
                table: "Contas",
                column: "BancoId");

            migrationBuilder.CreateIndex(
                name: "IX_Contas_UsuarioIdProprietario",
                table: "Contas",
                column: "UsuarioIdProprietario");

            migrationBuilder.CreateIndex(
                name: "IX_Faturas_CartaoCreditoId",
                table: "Faturas",
                column: "CartaoCreditoId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialEventLogs_CorrelationId",
                table: "FinancialEventLogs",
                column: "CorrelationId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialEventLogs_CriadoPor_CriadoEm",
                table: "FinancialEventLogs",
                columns: new[] { "CriadoPor", "CriadoEm" });

            migrationBuilder.CreateIndex(
                name: "IX_FinancialEventLogs_EntidadeAfetada_EntidadeId",
                table: "FinancialEventLogs",
                columns: new[] { "EntidadeAfetada", "EntidadeId" });

            migrationBuilder.CreateIndex(
                name: "IX_Orcamentos_CategoriaId",
                table: "Orcamentos",
                column: "CategoriaId");

            migrationBuilder.CreateIndex(
                name: "IX_Orcamentos_UsuarioId_CategoriaId_Mes_Ano",
                table: "Orcamentos",
                columns: new[] { "UsuarioId", "CategoriaId", "Mes", "Ano" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Parcelamentos_CartaoCreditoId",
                table: "Parcelamentos",
                column: "CartaoCreditoId");

            migrationBuilder.CreateIndex(
                name: "IX_Parcelamentos_CategoriaId",
                table: "Parcelamentos",
                column: "CategoriaId");

            migrationBuilder.CreateIndex(
                name: "IX_ParcelasTransacao_FaturaId",
                table: "ParcelasTransacao",
                column: "FaturaId");

            migrationBuilder.CreateIndex(
                name: "IX_ParcelasTransacao_ParcelamentoId",
                table: "ParcelasTransacao",
                column: "ParcelamentoId");

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResetTokens_Token",
                table: "PasswordResetTokens",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResetTokens_UsuarioId",
                table: "PasswordResetTokens",
                column: "UsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_Token",
                table: "RefreshTokens",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_UsuarioId",
                table: "RefreshTokens",
                column: "UsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_Relacionamentos_UsuarioId1",
                table: "Relacionamentos",
                column: "UsuarioId1",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Transacoes_CartaoCreditoId",
                table: "Transacoes",
                column: "CartaoCreditoId");

            migrationBuilder.CreateIndex(
                name: "IX_Transacoes_CategoriaId",
                table: "Transacoes",
                column: "CategoriaId");

            migrationBuilder.CreateIndex(
                name: "IX_Transacoes_ContaId",
                table: "Transacoes",
                column: "ContaId");

            migrationBuilder.CreateIndex(
                name: "IX_Transacoes_FaturaId",
                table: "Transacoes",
                column: "FaturaId");

            migrationBuilder.CreateIndex(
                name: "IX_Transacoes_FaturaPagaId",
                table: "Transacoes",
                column: "FaturaPagaId");

            migrationBuilder.CreateIndex(
                name: "IX_Transacoes_ParcelamentoId",
                table: "Transacoes",
                column: "ParcelamentoId");

            migrationBuilder.CreateIndex(
                name: "IX_Transacoes_ParcelaTransacaoId",
                table: "Transacoes",
                column: "ParcelaTransacaoId");

            migrationBuilder.CreateIndex(
                name: "IX_Transferencias_ContaDestinoId",
                table: "Transferencias",
                column: "ContaDestinoId");

            migrationBuilder.CreateIndex(
                name: "IX_Transferencias_ContaOrigemId",
                table: "Transferencias",
                column: "ContaOrigemId");

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
                name: "FK_Assinaturas_CartoesCredito_CartaoCreditoId",
                table: "Assinaturas",
                column: "CartaoCreditoId",
                principalTable: "CartoesCredito",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Assinaturas_Contas_ContaId",
                table: "Assinaturas",
                column: "ContaId",
                principalTable: "Contas",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_CartoesCredito_Contas_ContaId",
                table: "CartoesCredito",
                column: "ContaId",
                principalTable: "Contas",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_CompartilhamentosContas_Contas_ContaId",
                table: "CompartilhamentosContas",
                column: "ContaId",
                principalTable: "Contas",
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
                name: "FK_Contas_Usuarios_UsuarioIdProprietario",
                table: "Contas",
                column: "UsuarioIdProprietario",
                principalTable: "Usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Orcamentos_Usuarios_UsuarioId",
                table: "Orcamentos",
                column: "UsuarioId",
                principalTable: "Usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PasswordResetTokens_Usuarios_UsuarioId",
                table: "PasswordResetTokens",
                column: "UsuarioId",
                principalTable: "Usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_RefreshTokens_Usuarios_UsuarioId",
                table: "RefreshTokens",
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
                name: "FK_Usuarios_Relacionamentos_RelacionamentoId1",
                table: "Usuarios");

            migrationBuilder.DropTable(
                name: "Assinaturas");

            migrationBuilder.DropTable(
                name: "CompartilhamentosContas");

            migrationBuilder.DropTable(
                name: "Emprestimos");

            migrationBuilder.DropTable(
                name: "FinancialEventLogs");

            migrationBuilder.DropTable(
                name: "Orcamentos");

            migrationBuilder.DropTable(
                name: "PasswordResetTokens");

            migrationBuilder.DropTable(
                name: "RefreshTokens");

            migrationBuilder.DropTable(
                name: "Transacoes");

            migrationBuilder.DropTable(
                name: "Transferencias");

            migrationBuilder.DropTable(
                name: "ParcelasTransacao");

            migrationBuilder.DropTable(
                name: "Faturas");

            migrationBuilder.DropTable(
                name: "Parcelamentos");

            migrationBuilder.DropTable(
                name: "CartoesCredito");

            migrationBuilder.DropTable(
                name: "Categorias");

            migrationBuilder.DropTable(
                name: "Contas");

            migrationBuilder.DropTable(
                name: "Bancos");

            migrationBuilder.DropTable(
                name: "Relacionamentos");

            migrationBuilder.DropTable(
                name: "Usuarios");
        }
    }
}
