using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Meta;

/// <summary>Onde o dinheiro da meta está guardado: quanto de cada conta está reservado pra ela.</summary>
public record MetaReservaDto(Guid ContaId, string ContaNome, string? BancoNome, string? BancoCor, decimal Valor);

/// <summary>
/// Meta com o progresso calculado das reservas (modelo do Monarch: o dinheiro fica na conta, a meta reserva).
/// <c>Situacao</c>: "concluida" · "sem-prazo" · "prazo-passou" · "no-ritmo" · "atras" (comparando o guardado com o
/// que já deveria estar guardado se fosse igual todo mês desde a criação). <c>PorMes</c> = quanto falta dividido
/// pelos meses até o prazo (contando o atual); null sem prazo, concluída ou prazo passado.
/// <c>ValorAtual</c> = <c>Guardado</c> (compatibilidade com o app antigo).
/// </summary>
public record MetaDto(
    Guid Id,
    string Nome,
    string? Descricao,
    decimal ValorAlvo,
    decimal Guardado,
    decimal Falta,
    decimal PercentualConcluido,
    bool Concluida,
    DateTime? DataLimite,
    int? MesesRestantes,
    decimal? PorMes,
    string Situacao,
    List<MetaReservaDto> Reservas,
    Guid UsuarioId,
    Guid? FamiliaId,
    Guid? CategoriaId,
    bool Ativo,
    DateTime CriadoEm,
    DateTime AtualizadoEm)
{
    public decimal ValorAtual => Guardado;
}

/// <summary>Criação ou atualização de uma meta. <c>DataLimite</c>: o mês do prazo (o dia é ignorado).</summary>
public record CriarMetaDto(
    [Required][MaxLength(120)] string Nome,
    [MaxLength(500)] string? Descricao,
    [Range(0.01, 999_999_999.99, ErrorMessage = "Diga quanto quer juntar.")] decimal ValorAlvo,
    DateTime? DataLimite,
    Guid? FamiliaId,
    Guid? CategoriaId);

/// <summary>Guardar (reservar) ou tirar dinheiro de uma conta pra/da meta.</summary>
public record MovimentoMetaDto(
    Guid ContaId,
    [Range(0.01, 999_999_999.99, ErrorMessage = "Diga quanto.")] decimal Valor);

/// <summary>Conta aberta da pessoa com o que está reservado em metas e o que sobra livre.</summary>
public record ContaLivreDto(Guid ContaId, string Nome, string? BancoNome, string? BancoCor, decimal Saldo, decimal Reservado, decimal Livre);
