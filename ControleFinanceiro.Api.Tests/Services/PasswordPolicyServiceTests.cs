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

    // --- Blocklist (NIST: a senha INTEIRA, não substring) e acentos ---

    [Theory]
    [InlineData("123456789012345")]      // sequência com volta (…890123…)
    [InlineData("987654321098765")]      // descendo
    [InlineData("abcdefghijklmnop")]     // letras em sequência
    [InlineData("aaaaaaaaaaaaaaa")]      // um caractere repetido
    [InlineData("senhasenhasenha")]      // pedaço repetido
    [InlineData("MinhaSenhaForte")]      // comum (sem diferenciar maiúscula)
    [InlineData("qwertyuiopasdfgh")]
    public void SenhaComumOuPrevisivel_Recusa_ComOMotivo(string senha)
    {
        var ex = Assert.Throws<ArgumentException>(() => PasswordPolicyService.ValidarOuLancar(senha));
        Assert.Equal(PasswordPolicyService.MensagemComum, ex.Message);
    }

    [Fact]
    public void SenhaQueSoContemPedacoComum_Passa_PorqueComparaASenhaInteira()
    {
        Assert.Empty(PasswordPolicyService.Validar("meu cachorro 123456789 late"));
        Assert.Empty(PasswordPolicyService.Validar("senhasenhasenhaX"));
    }

    [Fact]
    public void OProprioEmail_Recusa()
    {
        var ex = Assert.Throws<ArgumentException>(() => PasswordPolicyService.ValidarOuLancar("ana.souza.silva@teste.com", "Ana.Souza.Silva@teste.com"));
        Assert.Equal(PasswordPolicyService.MensagemEmail, ex.Message);
        Assert.Throws<ArgumentException>(() => PasswordPolicyService.ValidarOuLancar("anasouzasilva123", "anasouzasilva123@teste.com"));
        Assert.Empty(PasswordPolicyService.Validar("uma frase bem comprida", "ana@teste.com"));
    }

    [Fact]
    public void Tamanho_ContaCaractereDeVerdade_EmojiEAcentoDecomposto()
    {
        // 14 caracteres visíveis com emoji (2 unidades UTF-16 cada) — antes passava como 15+.
        Assert.Contains(PasswordPolicyService.Validar("🔒🔒🔒🔒🔒🔒🔒🔒🔒🔒🔒🔒🔒🔒"), e => e.Contains("Mínimo 15"));
        // "é" decomposto (e + acento) conta 1 depois do NFC.
        var decomposta = "cafécafécaféxyz".Normalize(System.Text.NormalizationForm.FormD);
        Assert.Equal(15, PasswordPolicyService.Tamanho(decomposta));
    }
}
