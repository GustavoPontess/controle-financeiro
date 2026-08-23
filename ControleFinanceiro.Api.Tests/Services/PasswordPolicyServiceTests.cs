using ControleFinanceiro.Api.Services;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Política de senha — NIST SP 800-63B §5.1.1.2: mínimo 15 chars (sem MFA), teto 128 (anti-DoS
/// no Argon2id), blocklist de senha comum, e SEM regra de composição (maiúscula/número/especial
/// removida em 2026-08-23 — NIST SHALL NOT impor isso).
/// </summary>
public class PasswordPolicyServiceTests
{
    [Fact]
    public void Senha_com14chars_falhaMinimo15()
    {
        var erros = PasswordPolicyService.Validar("Abcdefgh123!@#"); // 14 chars
        Assert.Contains(erros, e => e.Contains("Mínimo 15"));
    }

    [Fact]
    public void Senha_com15chars_validaTodasAsRegras_passa()
    {
        Assert.Empty(PasswordPolicyService.Validar("Abcdefghij1234!")); // 15 chars, todas as classes
    }

    [Fact]
    public void Senha_com15chars_sohMinuscula_passa()
    {
        // NIST: sem regra de composição — tamanho é o que importa.
        Assert.Empty(PasswordPolicyService.Validar("somenteminuscula"));
    }

    [Fact]
    public void Senha_acimaDe128_falhaMaximo()
    {
        var longa = "Aa1!" + new string('x', 130); // > 128
        var erros = PasswordPolicyService.Validar(longa);
        Assert.Contains(erros, e => e.Contains("Máximo 128"));
    }

    [Fact]
    public void ValidarOuLancar_senhaCurta_lancaArgumentException()
    {
        Assert.Throws<ArgumentException>(() => PasswordPolicyService.ValidarOuLancar("Abc1!"));
    }
}
