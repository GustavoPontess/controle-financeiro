using System.ComponentModel.DataAnnotations;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Registro de acesso a aplicação (retenção Marco Civil da Internet, Lei 12.965/2014 Art. 15).
/// Guarda o "acesso à aplicação" (login concluído) pelo prazo legal de 6 meses, sob sigilo, num store
/// separado. Append-only: só é escrito no login e apagado pela purga de retenção vencida — a aplicação
/// nunca o edita.
///
/// O dado legal (Art. 5, VIII) é <b>data/hora + IP</b>; guardamos também um identificador
/// (<see cref="Email"/> snapshot) pra o registro continuar útil pra identificar o titular mesmo depois
/// que a conta é purgada (LGPD). Por isso o vínculo com o usuário é só um <see cref="UsuarioId"/> solto
/// (sem FK/cascade): a purga da conta (Módulo C — LGPD) NÃO leva estes registros junto; eles ficam
/// retidos os 6 meses por obrigação legal (LGPD Art. 16, I) e depois são purgados.
///
/// Minimização (LGPD Art. 6º III): guardamos só o necessário — sem User-Agent nem outros dados que
/// não integram o registro de acesso definido em lei.
/// </summary>
public class RegistroAcesso
{
    public Guid Id { get; set; }

    /// <summary>Usuário que acessou. Guid solto (sem FK) — sobrevive à purga da conta.</summary>
    public Guid UsuarioId { get; set; }

    /// <summary>E-mail no momento do acesso (snapshot). Identificador que mantém o registro útil
    /// mesmo após a conta ser purgada.</summary>
    [Required]
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    /// <summary>Endereço IP de origem do acesso. Comporta IPv6 (máx. 45 chars).</summary>
    [Required]
    [MaxLength(45)]
    public string Ip { get; set; } = string.Empty;

    public TipoEventoAcesso Tipo { get; set; } = TipoEventoAcesso.Login;

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
