using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Admin;

/// <summary>
/// Pacote de exportação dos dados pessoais de um usuário (Módulo C — LGPD, direito de acesso/
/// portabilidade, Art. 18). Só dados do próprio usuário — nunca dados de terceiros com quem ele
/// compartilha (rateio/família de outro dono). Serializa direto pra JSON no endpoint; o front baixa.
/// Ação auditada (<see cref="AcaoAdmin.ExportarDados"/>).
/// </summary>
public class ExportacaoUsuarioDto
{
    public DateTime GeradoEm { get; set; }
    public PerfilExportadoDto Perfil { get; set; } = new();
    public List<ContaExportadaDto> Contas { get; set; } = new();
    public List<CartaoExportadoDto> Cartoes { get; set; } = new();
    public List<TransacaoExportadaDto> Transacoes { get; set; } = new();
    public List<MetaExportadaDto> Metas { get; set; } = new();
    public List<OrcamentoExportadoDto> Orcamentos { get; set; } = new();
}

public class PerfilExportadoDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public DateTime? DataNascimento { get; set; }
    /// <summary>A foto de perfil como data URL ("data:image/webp;base64,..."), ou null.</summary>
    public string? FotoPerfil { get; set; }
    public StatusUsuario Status { get; set; }
    public bool MfaAtivo { get; set; }
    public bool OnboardingConcluido { get; set; }
    public DateTime CriadoEm { get; set; }
    public DateTime? UltimoAcessoEm { get; set; }
}

public class ContaExportadaDto
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public string? Banco { get; set; }
}

public class CartaoExportadoDto
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string? UltimosDigitos { get; set; }
    public decimal? LimiteTotal { get; set; }
}

public class TransacaoExportadaDto
{
    public Guid Id { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public string Tipo { get; set; } = string.Empty;
    public DateTime Data { get; set; }
    public string? Categoria { get; set; }
}

public class MetaExportadaDto
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public decimal ValorAlvo { get; set; }
}

public class OrcamentoExportadoDto
{
    public Guid Id { get; set; }
    public int Mes { get; set; }
    public int Ano { get; set; }
    public decimal Valor { get; set; }
}

/// <summary>Corpo do POST de purga — confirmação forte digitando o e-mail do alvo (defesa em
/// profundidade junto do PontesDialog do front). Deve bater com o e-mail da conta, senão 400.</summary>
public class PurgarUsuarioRequest
{
    public string EmailConfirmacao { get; set; } = string.Empty;
}
