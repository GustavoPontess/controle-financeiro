using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Infrastructure.Identity;

/// <summary>
/// Envio de e-mails ligados à segurança da CONTA (código OTP + avisos out-of-band). Separado do
/// <see cref="IPasswordResetEmailSender"/> (que é específico do reset). Impl stub loga em Development;
/// em produção nunca loga o código (segredo em log é proibido).
/// </summary>
public interface IContaEmailSender
{
    /// <summary>Envia o código OTP (PIN) para confirmar uma ação sensível.</summary>
    Task EnviarCodigoAsync(string email, string codigo, TipoOtpEmail finalidade, DateTime expiraEm, CancellationToken ct = default);

    /// <summary>Aviso out-of-band de que a conta foi marcada para exclusão (permite a vítima reagir).</summary>
    Task EnviarAvisoExclusaoAsync(string email, DateTime marcadoEm, int diasCarencia, CancellationToken ct = default);

    /// <summary>A exclusão foi cancelada na carência (alerta: se não foi a pessoa, alguém entrou com a senha dela).</summary>
    Task EnviarExclusaoCanceladaAsync(string email, CancellationToken ct = default);

    /// <summary>Senha errada várias vezes seguidas: avisa o dono (no máximo 1 por dia).</summary>
    Task EnviarTentativasLoginAsync(string email, int falhas, DateTime quandoUtc, CancellationToken ct = default);

    /// <summary>A conta foi apagada de vez (fim da carência ou pelo admin): confirma que os dados saíram.</summary>
    Task EnviarContaApagadaAsync(string email, CancellationToken ct = default);

    /// <summary>Pedido de acesso aprovado no Admin (beta fechado): a pessoa já pode entrar.</summary>
    Task EnviarAcessoLiberadoAsync(string email, CancellationToken ct = default);

    /// <summary>Pedido de acesso recebido (beta fechado): confirma que o cadastro chegou e espera aprovação.</summary>
    Task EnviarPedidoRecebidoAsync(string email, string token, DateTime expiraEm, CancellationToken ct = default);
}
