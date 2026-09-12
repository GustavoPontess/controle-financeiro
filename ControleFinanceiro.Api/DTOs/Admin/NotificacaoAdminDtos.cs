using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Admin;

public record NotificacaoAdminDto(
    Guid Id,
    TipoNotificacaoAdmin Tipo,
    string Titulo,
    string Mensagem,
    string? LinkRelativo,
    bool Lida,
    DateTime CriadoEm);

public record ContagemNotificacaoAdminDto(int NaoLidas);
