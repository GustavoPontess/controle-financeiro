using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Familia;

public record CriarFamiliaDto(string Nome);

public record EditarPapelDto(string Papel);

/// <summary>Feature 2.3 — admin promove/rebaixa a permissão de um membro.</summary>
public record EditarPermissaoDto(PapelFamilia PapelPermissao);

/// <summary>Feature 2.4 — define/limpa o limite de aprovação da família. Null = desliga.</summary>
public record DefinirLimiteAprovacaoDto(decimal? LimiteAprovacao);

public record FamiliaDto(
    Guid Id,
    string Nome,
    Guid CriadoPorUsuarioId,
    DateTime CriadoEm,
    bool EhAdmin,
    int TotalMembros,
    decimal? LimiteAprovacao);

/// <summary>Membro da família. Renda não vem aqui: é derivada (renda-e-visibilidade.md) e sai em
/// <c>GET /familias/{id}/renda</c> já filtrada por quem pede. <c>VisibilidadeRenda</c> é o nível que a pessoa
/// escolheu; <c>RendaVisivelPara</c> (a lista de quem vê o valor) só vai pro PRÓPRIO membro.</summary>
public record MembroFamiliaDto(
    Guid Id,
    Guid UsuarioId,
    string NomeUsuario,
    string EmailUsuario,
    string Papel,
    DateTime EntrouEm,
    PapelFamilia PapelPermissao,
    VisibilidadeRenda VisibilidadeRenda,
    List<Guid>? RendaVisivelPara,
    DateTime? FotoEm = null);

/// <summary>A própria pessoa escolhe o que a família vê da renda dela. <c>Para</c> só vale com ValorParaAlguns.</summary>
public record DefinirVisibilidadeRendaDto(VisibilidadeRenda Visibilidade, List<Guid>? Para);

/// <summary>Renda da casa num mês, calculada no servidor pra quem pede: só entra quem liberou o valor pra essa pessoa.</summary>
public record RendaFamiliaDto(
    int Ano,
    int Mes,
    decimal Total,
    decimal Previsto,
    List<RendaMembroDto> Membros);

/// <summary>Um membro na renda da casa. Sem valor quando a pessoa não liberou pra quem pede.</summary>
public record RendaMembroDto(Guid UsuarioId, string Nome, bool Mostrada, decimal? Recebido, decimal? Previsto);

public record FamiliaDetalheDto(
    Guid Id,
    string Nome,
    Guid CriadoPorUsuarioId,
    DateTime CriadoEm,
    bool EhAdmin,
    ModoRateio ModoRateioPadrao,
    List<MembroFamiliaDto> Membros,
    List<ConviteFamiliaDto> ConvitesPendentes,
    decimal? LimiteAprovacao);
