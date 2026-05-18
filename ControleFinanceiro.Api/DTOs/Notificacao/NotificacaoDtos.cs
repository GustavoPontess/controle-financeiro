using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Notificacao;

public record NotificacaoDto(
    Guid Id,
    TipoNotificacao Tipo,
    string Titulo,
    string Mensagem,
    string? LinkRelativo,
    bool Lida,
    DateTime CriadoEm);

public record ContagemNotificacaoDto(int NaoLidas);
