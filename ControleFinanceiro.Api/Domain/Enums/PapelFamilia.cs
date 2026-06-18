namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>
/// Papel de PERMISSÃO de um membro na família (Feature 2.3). Fonte da verdade pra
/// autorização — distinto do rótulo de relação livre (<c>MembroFamilia.Papel</c>, ex. "Cônjuge").
/// Hierarquia de poder: Admin &gt; Membro &gt; Dependente.
/// Spec: docs/features/familia/papeis-permissoes.md.
/// </summary>
public enum PapelFamilia
{
    /// <summary>Dono(s) da família — gestão completa (convidar, remover, promover, config).</summary>
    Admin = 1,

    /// <summary>Adulto participante (default) — lança/compartilha, rateia, acerta, aprova.</summary>
    Membro = 2,

    /// <summary>Acesso restrito (ex.: filho com login) — só leitura, não age.</summary>
    Dependente = 3,
}
