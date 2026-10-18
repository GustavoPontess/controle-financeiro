using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Emprestimo;

public record VincularEmprestimoDto([Required, EmailAddress, MaxLength(255)] string Email);

/// <summary>
/// Link pronto pra credor copiar/compartilhar (WhatsApp, e-mail, etc — sem SMTP no projeto).
/// Devolvido só pra quem chamou Vincular, nunca fica exposto em nenhuma listagem.
/// </summary>
public record EmprestimoConviteResultadoDto(string LinkConvite);

public record EmprestimoConvitePendenteDto(
    Guid EmprestimoId,
    string Descricao,
    decimal ValorTotal,
    string CredorOuDevedorNome,
    string TipoDescricao);
