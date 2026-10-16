using System.ComponentModel.DataAnnotations;
using System.Reflection;
using ControleFinanceiro.Api.DTOs.Importacao;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Trava: em DTO <c>record</c> com construtor primário, atributo de validação tem que estar no PARÂMETRO
/// (<c>[MaxLength(300)] string X</c>), não na propriedade (<c>[property: MaxLength(300)]</c>). No formato da
/// propriedade o ASP.NET recusa o corpo da requisição (incidente 2026-10-16, confirmar importação) ou ignora a
/// regra em silêncio. Teste de unidade do service não pega (não passa pelo MVC), então a varredura fica aqui.
/// </summary>
public class DtoRecordValidacaoTests
{
    [Fact]
    public void RecordsDosDtos_ValidacaoNoParametroDoConstrutor_NuncaSoNaPropriedade()
    {
        var dtos = typeof(ConfirmarImportacaoDto).Assembly.GetTypes()
            .Where(t => t.Namespace?.StartsWith("ControleFinanceiro.Api.DTOs") == true && t.IsClass
                        && t.GetMethod("<Clone>$") is not null); // record

        var erros = new List<string>();
        foreach (var tipo in dtos)
        {
            var construtor = tipo.GetConstructors().OrderByDescending(c => c.GetParameters().Length).FirstOrDefault();
            if (construtor is null) continue;
            foreach (var parametro in construtor.GetParameters())
            {
                var propriedade = tipo.GetProperty(parametro.Name!, BindingFlags.Public | BindingFlags.Instance);
                if (propriedade is null) continue;
                var naPropriedade = propriedade.GetCustomAttributes<ValidationAttribute>(inherit: false).Any();
                var noParametro = parametro.GetCustomAttributes<ValidationAttribute>(inherit: false).Any();
                if (naPropriedade && !noParametro)
                    erros.Add($"{tipo.Name}.{propriedade.Name}");
            }
        }

        Assert.True(erros.Count == 0, "Validação na propriedade (use o atributo no parâmetro): " + string.Join(", ", erros));
    }
}
