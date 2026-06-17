using ControleFinanceiro.Api.Services;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Política de senha — NIST SP 800-63B: mínimo 15 chars (sem MFA), teto 128 (anti-DoS no
/// Argon2id), e blocklist de senha comum.
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
    public void Senha_acimaDe128_falhaMaximo()
    {
        var longa = "Aa1!" + new string('x', 130); // > 128
        var erros = PasswordPolicyService.Validar(longa);
        Assert.Contains(erros, e => e.Contains("Máximo 128"));
    }

    [Fact]
    public void Senha_semClasseDeCaractere_eRejeitada()
    {
        // 16 chars mas só minúsculas → faltam maiúscula/número/especial.
        var erros = PasswordPolicyService.Validar("abcdefghijklmnop");
        Assert.Contains(erros, e => e.Contains("maiúscula"));
        Assert.Contains(erros, e => e.Contains("número"));
        Assert.Contains(erros, e => e.Contains("especial"));
    }

    [Fact]
    public void ValidarOuLancar_senhaCurta_lancaArgumentException()
    {
        Assert.Throws<ArgumentException>(() => PasswordPolicyService.ValidarOuLancar("Abc1!"));
    }
}
