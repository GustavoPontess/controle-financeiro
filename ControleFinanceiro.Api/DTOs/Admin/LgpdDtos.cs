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
    // Validação da conta pessoal (2026-10-20): a tela promete "uma cópia de tudo que é seu" e faltava metade.
    public List<ContaFixaExportadaDto> ContasFixas { get; set; } = new();
    public List<ParcelamentoExportadoDto> ComprasParceladas { get; set; } = new();
    public List<EmprestimoExportadoDto> Emprestimos { get; set; } = new();
    public List<RendaEsperadaExportadaDto> RendaEsperada { get; set; } = new();
    public List<CategoriaExportadaDto> CategoriasProprias { get; set; } = new();
    /// <summary>O que o app aprendeu ao importar extrato: "daqui é esta categoria" (estabelecimento ou pessoa do Pix).</summary>
    public List<RegraCategoriaExportadaDto> CategoriasAprendidas { get; set; } = new();
    /// <summary>As importações de extrato que a pessoa confirmou (conta, período dos lançamentos, quantos, quando).</summary>
    public List<ImportacaoExportadaDto> ImportacoesDeExtrato { get; set; } = new();
    public List<SugestaoDispensadaExportadaDto> SugestoesDeContaFixaDispensadas { get; set; } = new();
    /// <summary>Arquivos anexados aos lançamentos (print da nota, foto, PDF), com o conteúdo (data URL).</summary>
    public List<AnexoExportadoDto> Anexos { get; set; } = new();
    public List<ConferenciaExportadaDto> ConferenciasDeSaldo { get; set; } = new();
    public List<NotificacaoExportadaDto> Notificacoes { get; set; } = new();
    public List<SolicitacaoExportadaDto> Solicitacoes { get; set; } = new();
    /// <summary>As famílias de que a pessoa faz ou fez parte, com o papel dela. Nada dos outros membros.</summary>
    public List<FamiliaExportadaDto> Familias { get; set; } = new();
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
    public string? Agencia { get; set; }
    public string? NumeroConta { get; set; }
    public DateTime? EncerradaEm { get; set; }
}

public class CartaoExportadoDto
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string? UltimosDigitos { get; set; }
    public decimal? LimiteTotal { get; set; }
    public int? DiaFechamento { get; set; }
    public int? DiaVencimento { get; set; }
}

public class TransacaoExportadaDto
{
    public Guid Id { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public string Tipo { get; set; } = string.Empty;
    public DateTime Data { get; set; }
    public string? Categoria { get; set; }
    public string? Subcategoria { get; set; }
    /// <summary>Nome da conta ou do cartão em que foi lançado.</summary>
    public string? Conta { get; set; }
    public string? Cartao { get; set; }
    public string? FormaDePagamento { get; set; }
    /// <summary>Executado, Previsao ou Cancelado.</summary>
    public string Situacao { get; set; } = string.Empty;
    /// <summary>A pessoa excluiu o lançamento (fica no histórico, fora do saldo).</summary>
    public bool Excluido { get; set; }
    /// <summary>Onde aconteceu (o ponto do aparelho, arredondado a ~11 m); null = sem localização.</summary>
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}

public class AnexoExportadoDto
{
    public Guid TransacaoId { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public DateTime CriadoEm { get; set; }
    /// <summary>O arquivo guardado (data URL, base64).</summary>
    public string Conteudo { get; set; } = string.Empty;
}

public class MetaExportadaDto
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public decimal ValorAlvo { get; set; }
    public DateTime? DataLimite { get; set; }
    /// <summary>Quando a meta foi concluída (o dinheiro foi usado) e quanto juntou; null = não concluída.</summary>
    public DateTime? ConcluidaEm { get; set; }
    public decimal? ValorJuntado { get; set; }

    /// <summary>Saldo da caixinha da meta (o que está guardado nela).</summary>
    public decimal Guardado { get; set; }
}

public class OrcamentoExportadoDto
{
    public Guid Id { get; set; }
    public string? Categoria { get; set; }
    public int Mes { get; set; }
    public int Ano { get; set; }
    public decimal Valor { get; set; }
}

public class ContaFixaExportadaDto
{
    public Guid Id { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public string Tipo { get; set; } = string.Empty;
    public string Frequencia { get; set; } = string.Empty;
    public int Dia { get; set; }
    public DateTime DataInicio { get; set; }
    public DateTime? DataFim { get; set; }
    public string? Categoria { get; set; }
    public string? Conta { get; set; }
    public string? Cartao { get; set; }
    public string? FormaDePagamento { get; set; }
    public bool Ativa { get; set; }
    public DateTime? CanceladaEm { get; set; }
    public DateTime? ExcluidaEm { get; set; }
}

public class ParcelamentoExportadoDto
{
    public Guid Id { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public DateTime DataCompra { get; set; }
    public decimal ValorTotal { get; set; }
    public decimal? ValorComJuros { get; set; }
    public decimal? TaxaJuroMensal { get; set; }
    public int QuantidadeParcelas { get; set; }
    public int ParcelasPagasAntes { get; set; }
    public string? Cartao { get; set; }
    public string? Categoria { get; set; }
    public DateTime? CanceladoEm { get; set; }
    public List<ParcelaExportadaDto> Parcelas { get; set; } = new();
}

public class ParcelaExportadaDto
{
    public int Numero { get; set; }
    public decimal Valor { get; set; }
    public decimal? ValorComJuros { get; set; }
    public DateTime DataVencimento { get; set; }
    public string Situacao { get; set; } = string.Empty;
    public DateTime? PagoEm { get; set; }
}

public class EmprestimoExportadoDto
{
    public Guid Id { get; set; }
    public string Descricao { get; set; } = string.Empty;
    /// <summary>O nome que a pessoa deu pra quem emprestou ou pegou.</summary>
    public string Pessoa { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public decimal ValorTotal { get; set; }
    public decimal ValorPago { get; set; }
    public decimal? TaxaJuroMensal { get; set; }
    public DateTime DataInicio { get; set; }
    public DateTime? DataVencimento { get; set; }
    public bool Quitado { get; set; }
    public string? Observacao { get; set; }
}

/// <summary>Sugestão de conta fixa que a pessoa dispensou: o cartão e o lugar.</summary>
public class SugestaoDispensadaExportadaDto
{
    public string? Cartao { get; set; }
    public string Lugar { get; set; } = string.Empty;
    public DateTime CriadoEm { get; set; }
}

public class ImportacaoExportadaDto
{
    public string? Conta { get; set; }
    public DateOnly De { get; set; }
    public DateOnly Ate { get; set; }
    public int Quantidade { get; set; }
    public DateTime CriadoEm { get; set; }
}

public class RegraCategoriaExportadaDto
{
    public string Estabelecimento { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public string? Categoria { get; set; }
    public DateTime AtualizadoEm { get; set; }
}

public class RendaEsperadaExportadaDto
{
    public int Ano { get; set; }
    public int Mes { get; set; }
    public decimal FixaEsperada { get; set; }
    public decimal VariavelEsperada { get; set; }
}

public class CategoriaExportadaDto
{
    public Guid Id { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public string Finalidade { get; set; } = string.Empty;
    public List<string> Subcategorias { get; set; } = new();
}

public class ConferenciaExportadaDto
{
    public string? Conta { get; set; }
    public DateTime DataHora { get; set; }
    public decimal SaldoNoBanco { get; set; }
    public decimal SaldoNoApp { get; set; }
    public decimal Diferenca { get; set; }
    public bool Ajustada { get; set; }
}

public class NotificacaoExportadaDto
{
    public string Titulo { get; set; } = string.Empty;
    public string Mensagem { get; set; } = string.Empty;
    public bool Lida { get; set; }
    public DateTime CriadoEm { get; set; }
}

public class SolicitacaoExportadaDto
{
    public string Tipo { get; set; } = string.Empty;
    public string Titulo { get; set; } = string.Empty;
    public string? Descricao { get; set; }
    public string Tela { get; set; } = string.Empty;
    public bool MostrarValores { get; set; }
    public int Anexos { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CriadoEm { get; set; }
}

public class FamiliaExportadaDto
{
    public string Nome { get; set; } = string.Empty;
    /// <summary>A relação que a pessoa declarou (Cônjuge, Filho(a)…).</summary>
    public string Relacao { get; set; } = string.Empty;
    public string Permissao { get; set; } = string.Empty;
    public DateTime EntrouEm { get; set; }
    public DateTime? SaiuEm { get; set; }
}

/// <summary>Corpo do POST de purga — confirmação forte digitando o e-mail do alvo (defesa em
/// profundidade junto do PontesDialog do front). Deve bater com o e-mail da conta, senão 400.</summary>
public class PurgarUsuarioRequest
{
    public string EmailConfirmacao { get; set; } = string.Empty;
}
