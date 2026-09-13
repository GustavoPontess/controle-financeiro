using System.Security.Cryptography;

namespace ControleFinanceiro.Api.Infrastructure.Identity;

/// <summary>
/// Códigos de recuperação de MFA — formato "XXXX-XXXX" (8 chars úteis), alfabeto sem
/// caracteres ambíguos (sem 0/O, 1/I/L) pra digitar sem confundir. Hash igual
/// <see cref="OpaqueTokenHasher"/> — nunca guarda o bruto.
/// </summary>
public static class MfaBackupCodeHelper
{
    private const string Alfabeto = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // sem 0,O,1,I,L
    private const int Quantidade = 10;

    public static List<string> GerarLote()
    {
        var codigos = new List<string>(Quantidade);
        for (var i = 0; i < Quantidade; i++)
            codigos.Add($"{Gerar4()}-{Gerar4()}");
        return codigos;
    }

    private static string Gerar4()
    {
        Span<char> chars = stackalloc char[4];
        for (var i = 0; i < 4; i++)
            chars[i] = Alfabeto[RandomNumberGenerator.GetInt32(Alfabeto.Length)];
        return new string(chars);
    }

    public static string Hash(string codigo) => OpaqueTokenHasher.Hash(Normalizar(codigo));

    /// <summary>Maiúsculo + sem espaço — usuário pode digitar em qualquer case/com espaço extra.</summary>
    public static string Normalizar(string codigo) => codigo.Trim().ToUpperInvariant();
}
