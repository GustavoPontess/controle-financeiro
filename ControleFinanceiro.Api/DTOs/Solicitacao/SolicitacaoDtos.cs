using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Solicitacao;

/// <summary>Anexo novo: tipo (1 print, 2 bloco apontado), de que tela veio, o bloco e o texto dele, a escolha dos valores
/// e a imagem (base64).</summary>
public record AnexoNovoDto(
    int Tipo,
    [Required, MaxLength(200)] string Tela,
    [MaxLength(120)] string? Bloco,
    [MaxLength(500)] string? TextoDoBloco,
    bool MostrarValores,
    [Required, MaxLength(2_000_000)] string ImagemBase64);

/// <summary>Nova solicitação: tipo (1 algo errado, 2 melhoria), título, descrição e os anexos da tela (opcionais, até 5).</summary>
public record CriarSolicitacaoDto(
    int Tipo,
    [Required, MaxLength(100)] string Titulo,
    [MaxLength(2000)] string? Descricao,
    [Required, MaxLength(200)] string Tela,
    [MaxLength(20)] string? Janela,
    [MaxLength(5)] List<AnexoNovoDto>? Anexos = null);

/// <summary>Resposta de quem mandou (sem a nota do admin).</summary>
public record MinhaSolicitacaoDto(Guid Id, int Tipo, string Titulo, string? Descricao, string Tela, int Status, int Anexos, DateTime CriadoEm);

/// <summary>Anexo como o admin vê (a imagem vem por GET .../anexos/{id}).</summary>
public record AnexoAdminDto(Guid Id, int Tipo, string Tela, string? Bloco, string? TextoDoBloco, bool MostrarValores);

/// <summary>Como o admin vê: com quem mandou, prioridade, nota e os anexos.</summary>
public record SolicitacaoAdminDto(
    Guid Id, int Tipo, string Titulo, string? Descricao, string Tela, string? Janela,
    int Status, int? Prioridade, string? NotaAdmin, string NomeUsuario, string EmailUsuario, DateTime CriadoEm, DateTime? AtualizadoEm,
    bool MostrarValores, List<AnexoAdminDto> Anexos);

/// <summary>Triagem do admin: status, prioridade (0 a 3, null = sem) e nota.</summary>
public record AtualizarSolicitacaoDto(
    int Status,
    [Range(0, 3)] int? Prioridade,
    [MaxLength(1000)] string? NotaAdmin);
