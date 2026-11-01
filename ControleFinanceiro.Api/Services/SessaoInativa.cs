using ControleFinanceiro.Api.Domain.Entities;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Sair por inatividade (2026-10-31, OWASP Session Management: 15 a 30 min pra app de risco menor, e a trava tem
/// que estar no servidor). Vale só pra sessão SEM "Manter-me conectado" (o padrão, pensado pra computador
/// emprestado); com ele a pessoa disse que o aparelho é dela e a sessão vai até os 7 dias do refresh.
/// A tela fecha a sessão depois de <see cref="Minutos"/> sem mexer (aviso 1 min antes; o <c>/auth/me</c> manda o
/// limite). O servidor é a trava de verdade: o front só pede refresh quando o jwt vence, então um refresh criado há
/// mais de jwt + <see cref="Minutos"/> significa ninguém usando no meio. Na prática, parado por no máximo 30 min
/// (jwt de 15) a sessão não renova mais, mesmo que a aba tenha sido fechada com o navegador aberto.
/// </summary>
public static class SessaoInativa
{
    public const int Minutos = 15;

    public static bool Venceu(RefreshToken rt, DateTime agoraUtc, int minutosDoJwt) =>
        !rt.LembrarSessao && agoraUtc - rt.CriadoEm > TimeSpan.FromMinutes(minutosDoJwt + Minutos);
}

/// <summary>
/// Refresh recusado por <see cref="SessaoInativa"/>. HTTP 401 com code <c>SESSAO_INATIVA</c>: o front manda pra tela
/// de entrar com o aviso "você saiu por ficar parado". Deriva de <see cref="UnauthorizedAccessException"/>: quem só
/// conhece o 401 genérico continua tratando como não autenticado.
/// </summary>
public class SessaoInativaException : UnauthorizedAccessException
{
    public SessaoInativaException() : base($"Você saiu porque ficou {SessaoInativa.Minutos} minutos sem usar. Entre de novo.") { }
}
