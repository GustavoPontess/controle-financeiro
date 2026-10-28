namespace ControleFinanceiro.Api.Infrastructure.Email;

/// <summary>Quem manda os e-mails: os dados da empresa que aparecem no rodapé. Campo vazio não aparece.</summary>
public sealed record Empresa(string Nome, string? RazaoSocial, string? Cnpj, string? Endereco, string? Contato, string Site, string? Aviso = null);

/// <summary>
/// ÚNICO lugar dos dados da empresa nos e-mails. Hoje com os MESMOS dados de exemplo do rodapé do site (decisão do
/// Gustavo, 2026-10-27). Chegou o CNPJ: trocar aqui e nos outros lugares do mapa docs/DADOS_DA_EMPRESA.md, e apagar o
/// Aviso. Campo vazio não aparece.
/// </summary>
public static class DadosEmpresa
{
    public static readonly Empresa Atual = new(
        Nome: "Pontes",
        RazaoSocial: "Pontes Tecnologia Ltda.",                                  // EXEMPLO: trocar pela razão social
        Cnpj: "00.000.000/0001-00",                                             // EXEMPLO: trocar pelo CNPJ
        Endereco: "Rua Exemplo, 123, Sala 4 · Centro · Cidade/UF · CEP 00000-000", // EXEMPLO: trocar pelo endereço
        Contato: "contato@pontes.exemplo · (00) 0000-0000",                     // EXEMPLO: trocar pelo e-mail e telefone
        Site: "app.pontesdev.com.br",
        Aviso: "E-mail modelo: dados fictícios.");                              // APAGAR quando os dados forem reais

    /// <summary>As linhas do rodapé, na ordem do rodapé do site: quem é (com CNPJ), endereço, contato.</summary>
    public static IReadOnlyList<string> Linhas(Empresa e, int ano)
    {
        var quem = $"© {ano} {e.RazaoSocial ?? e.Nome}" + (e.Cnpj is null ? "" : $" · CNPJ {e.Cnpj}");
        var linhas = new List<string> { quem };
        if (e.Endereco is not null) linhas.Add(e.Endereco);
        linhas.Add(e.Contato is null ? e.Site : $"{e.Contato} · {e.Site}");
        if (e.Aviso is not null) linhas.Add(e.Aviso);
        return linhas;
    }
}
