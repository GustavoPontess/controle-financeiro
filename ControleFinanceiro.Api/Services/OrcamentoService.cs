using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.DinheiroDoMes;
using ControleFinanceiro.Api.DTOs.Orcamento;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// O planejado por categoria do Orçamento: as Despesas (quanto planeja gastar; era a tela Limites) e as Receitas
/// (quanto espera receber em cada categoria de receita; 2026-10-22). Um planejado VALE TODO MÊS até a pessoa mudar
/// (ver <see cref="Orcamento"/>): o do mês M é a linha mais recente da categoria até M. Mudar ou tirar só vale do mês
/// atual em diante; mês passado fica como estava. A categoria diz de que lado a linha está (receita ou gasto). O gasto
/// vem da regra única <see cref="RegrasFinanceiras.GastosPorCategoriaDoMesAsync"/> (inclui a parcela do mês das
/// compras parceladas); o recebido, de <see cref="RendaService.EhRenda"/>.
/// </summary>
public class OrcamentoService
{
    private readonly AppDbContext _context;

    public OrcamentoService(AppDbContext context)
    {
        _context = context;
    }

    private static int Chave(int ano, int mes) => ano * 12 + mes;

    // ── Ler ──────────────────────────────────────────────────────────────────

    /// <summary>Planejados de gasto que valem no mês, com gasto e previsto, e as outras categorias de gasto (as que
    /// gastaram primeiro, depois as sem gasto: a planilha mostra todas).</summary>
    public async Task<LimitesDoMesDto> DoMesAsync(Guid usuarioId, int ano, int mes, DateTime? agora = null)
    {
        ValidarMes(ano, mes);
        var foraDasDespesas = (await CategoriasDoLadoAsync(usuarioId, Finalidade.Receita)).Keys
            .Concat((await CategoriasDoLadoAsync(usuarioId, Finalidade.Investimento)).Keys).ToHashSet();
        var vigentes = (await VigentesAsync(usuarioId, ano, mes))
            .Where(o => o.SubcategoriaId == null && (o.CategoriaId is not { } c || !foraDasDespesas.Contains(c))).ToList();
        var gastos = await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(_context, usuarioId, ano, mes);
        var previstos = await RegrasFinanceiras.PrevistosDoMesAsync(_context, usuarioId, ano, mes);
        // Parcelas já compradas que caem nos meses seguintes (comprometem os limites de lá).
        var parcelasFuturas = await RegrasFinanceiras.ParcelasPorMesAsync(_context, usuarioId, new DateTime(ano, mes, 1).AddMonths(1),
            DinheiroDoMesService.MesesDeParcelas, soPendentes: true);

        var ids = vigentes.Where(o => o.CategoriaId.HasValue).Select(o => o.CategoriaId!.Value)
            .Concat(gastos.Keys.Where(k => k != RegrasFinanceiras.SemCategoria))
            .Concat(previstos.Where(p => p.CategoriaId.HasValue).Select(p => p.CategoriaId!.Value)).Distinct().ToList();
        var nomes = await _context.Categorias.AsNoTracking().Where(c => ids.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Descricao);
        string Nome(Guid? id) => id is null ? "Todos os gastos"
            : id == RegrasFinanceiras.SemCategoria ? "Sem categoria" : nomes.GetValueOrDefault(id.Value, "Categoria");

        var limites = vigentes.Select(o =>
        {
            var g = o.CategoriaId is { } c ? gastos.GetValueOrDefault(c)
                : new RegrasFinanceiras.GastoCategoria(gastos.Values.Sum(x => x.Gasto), gastos.Values.Sum(x => x.Previsto));
            var vem = previstos.Where(p => o.CategoriaId is null || p.CategoriaId == o.CategoriaId)
                .Select(p => new AindaVemDto(p.TransacaoId, p.ContaFixaId, p.Descricao, p.Data, p.CategoriaId,
                    p.CategoriaId is null ? "Sem categoria" : Nome(p.CategoriaId), p.Valor))
                .ToList();
            var pct = Math.Round(g.Gasto * 100m / o.ValorLimite, 1);
            var situacao = Situacao(o.ValorLimite, g.Gasto, vem.Sum(v => v.Valor), pct, o.PercentualAlerta);
            var futuras = parcelasFuturas.Where(p => o.CategoriaId is null || p.CategoriaId == o.CategoriaId).ToList();
            return new LimiteDoMesDto(o.CategoriaId, Nome(o.CategoriaId), o.ValorLimite, g.Gasto, g.Previsto,
                o.ValorLimite - g.Gasto, pct, situacao, o.Ano, o.Mes, o.PercentualAlerta, vem,
                Responder(situacao, o.ValorLimite, g.Gasto, vem),
                futuras.Sum(p => p.Valor), futuras.LastOrDefault()?.Ano, futuras.LastOrDefault()?.Mes);
        })
            // O que precisa de atenção primeiro: quem passou, quem vai passar, quem está perto; depois pelo quanto gastou.
            .OrderBy(l => Prioridade(l.Situacao)).ThenByDescending(l => l.Percentual).ThenBy(l => l.Categoria, StringComparer.CurrentCulture)
            .ToList();

        var comLimite = vigentes.Where(o => o.CategoriaId.HasValue).Select(o => o.CategoriaId!.Value).ToHashSet();
        var semLimite = gastos.Where(kv => kv.Value.Gasto > 0 && !comLimite.Contains(kv.Key))
            .Select(kv => new GastoSemLimiteDto(kv.Key == RegrasFinanceiras.SemCategoria ? null : kv.Key, Nome(kv.Key), kv.Value.Gasto))
            .OrderByDescending(s => s.Gasto)
            .ToList();
        // Como a planilha: toda categoria de gasto aparece, a que não teve gasto no fim (pra planejar).
        var jaListadas = semLimite.Where(s => s.CategoriaId.HasValue).Select(s => s.CategoriaId!.Value).Concat(comLimite).ToHashSet();
        semLimite.AddRange((await _context.Categorias.AsNoTracking()
                .Where(c => c.Finalidade != Finalidade.Receita && c.Finalidade != Finalidade.Investimento
                            && (c.UsuarioId == null || c.UsuarioId == usuarioId))
                .Select(c => new { c.Id, c.Descricao })
                .ToListAsync())
            .Where(c => !jaListadas.Contains(c.Id))
            .OrderBy(c => c.Descricao, StringComparer.CurrentCulture)
            .Select(c => new GastoSemLimiteDto(c.Id, c.Descricao, 0m)));

        var deCategoria = limites.Where(l => l.CategoriaId.HasValue).ToList();
        return new LimitesDoMesDto(ano, mes, Editavel(ano, mes, agora ?? HorarioBrasil.Agora()),
            deCategoria.Sum(l => l.Limite), deCategoria.Sum(l => l.Gasto), deCategoria.Sum(l => l.Previsto),
            limites, semLimite);
    }

    /// <summary>Média do gasto da categoria nos 3 meses antes de <paramref name="mes"/> (pra sugerir o limite).</summary>
    public async Task<SugestaoLimiteDto> SugestaoAsync(Guid usuarioId, Guid? categoriaId, int ano, int mes)
    {
        ValidarMes(ano, mes);
        if (categoriaId.HasValue)
            await DonoRecursos.ExigirCategoriaAsync(_context, categoriaId.Value, usuarioId);
        var total = 0m;
        var inicio = new DateTime(ano, mes, 1);
        for (var i = 1; i <= 3; i++)
        {
            var m = inicio.AddMonths(-i);
            var gastos = await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(_context, usuarioId, m.Year, m.Month);
            total += categoriaId is { } c ? gastos.GetValueOrDefault(c).Gasto : gastos.Values.Sum(g => g.Gasto);
        }
        return new SugestaoLimiteDto(total > 0 ? Math.Round(total / 3m, 2) : null);
    }

    // ── Escrever ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Põe ou muda o limite da categoria do mês em diante: grava a linha do mês e apaga as dos meses depois
    /// (o novo valor vale pra frente). Mês passado é recusado.
    /// </summary>
    public async Task<LimitesDoMesDto> DefinirAsync(DefinirLimiteDto dto, Guid usuarioId, DateTime? agora = null)
    {
        ValidarMes(dto.Ano, dto.Mes);
        if (dto.Valor <= 0 || dto.Valor > 999_999_999.99m)
            throw new ArgumentException("Diga quanto você planeja gastar.");
        ExigirEditavel(dto.Ano, dto.Mes, agora ?? HorarioBrasil.Agora());
        if (dto.CategoriaId.HasValue)
            await ExigirCategoriaDeGastoAsync(dto.CategoriaId.Value, usuarioId);
        await GravarAsync(usuarioId, dto.CategoriaId, null, dto.Ano, dto.Mes, dto.Valor);
        return await DoMesAsync(usuarioId, dto.Ano, dto.Mes, agora);
    }

    /// <summary>Tira o limite da categoria do mês em diante (os meses passados guardam o que tinham).</summary>
    public async Task<LimitesDoMesDto> TirarAsync(Guid? categoriaId, int ano, int mes, Guid usuarioId, DateTime? agora = null)
    {
        ValidarMes(ano, mes);
        ExigirEditavel(ano, mes, agora ?? HorarioBrasil.Agora());
        await ApagarAsync(usuarioId, categoriaId, null, ano, mes);
        return await DoMesAsync(usuarioId, ano, mes, agora);
    }

    // ── Receitas e Investimentos (fontes) ────────────────────────────────────

    /// <summary>
    /// A seção Receitas do mês: uma linha por FONTE de renda, que é a subcategoria (Salário, Freela, Aluguel recebido…
    /// dentro de Renda; 2026-10-22, "eu tenho bem mais categorias de renda") ou a categoria de receita que não tem
    /// subcategoria. Realizado = renda (<see cref="RendaService.EhRenda"/>) efetivada; o que ainda vai cair = renda
    /// prevista no mês.
    /// </summary>
    public Task<FontesDoMesDto> ReceitasDoMesAsync(Guid usuarioId, int ano, int mes, DateTime? agora = null) =>
        FontesDoMesAsync(usuarioId, ano, mes, Finalidade.Receita, agora);

    /// <summary>
    /// A seção Investimentos do mês (2026-10-22): uma linha por fonte de investimento (Poupança, Tesouro, Ações…
    /// dentro de Investimentos, ou a categoria de investimento sem subcategoria). Realizado = o que foi investido no mês:
    /// aportes (saídas) menos resgates (entradas) efetivados; o que ainda vem = os previstos, do mesmo jeito.
    /// </summary>
    public Task<FontesDoMesDto> InvestimentosDoMesAsync(Guid usuarioId, int ano, int mes, DateTime? agora = null) =>
        FontesDoMesAsync(usuarioId, ano, mes, Finalidade.Investimento, agora);

    /// <summary>Planeja quanto espera receber numa fonte de renda do mês em diante (vale todo mês até mudar).</summary>
    public Task<FontesDoMesDto> DefinirReceitaAsync(DefinirFonteDto dto, Guid usuarioId, DateTime? agora = null) =>
        DefinirFonteAsync(Finalidade.Receita, dto, usuarioId, agora);

    /// <summary>Planeja quanto vai investir numa fonte de investimento do mês em diante (vale todo mês até mudar).</summary>
    public Task<FontesDoMesDto> DefinirInvestimentoAsync(DefinirFonteDto dto, Guid usuarioId, DateTime? agora = null) =>
        DefinirFonteAsync(Finalidade.Investimento, dto, usuarioId, agora);

    /// <summary>Tira o planejado da fonte de renda do mês em diante (os meses passados guardam o que tinham).</summary>
    public Task<FontesDoMesDto> TirarReceitaAsync(Guid categoriaId, Guid? subcategoriaId, int ano, int mes, Guid usuarioId, DateTime? agora = null) =>
        TirarFonteAsync(Finalidade.Receita, categoriaId, subcategoriaId, ano, mes, usuarioId, agora);

    /// <summary>Tira o planejado da fonte de investimento do mês em diante.</summary>
    public Task<FontesDoMesDto> TirarInvestimentoAsync(Guid categoriaId, Guid? subcategoriaId, int ano, int mes, Guid usuarioId, DateTime? agora = null) =>
        TirarFonteAsync(Finalidade.Investimento, categoriaId, subcategoriaId, ano, mes, usuarioId, agora);

    /// <summary>
    /// Receitas e Investimentos são a mesma peça (decisão do Gustavo 2026-10-22: seções irmãs iguais): cada fonte com
    /// o planejado (vale todo mês até mudar), o realizado e o que ainda vem. Como a planilha, toda fonte aparece: as
    /// planejadas, depois as que tiveram dinheiro sem planejado e, no fim, as sem nada.
    /// </summary>
    private async Task<FontesDoMesDto> FontesDoMesAsync(Guid usuarioId, int ano, int mes, Finalidade lado, DateTime? agora)
    {
        ValidarMes(ano, mes);
        var doLado = await CategoriasDoLadoAsync(usuarioId, lado);
        var idsDoLado = doLado.Keys.ToList();
        var subs = await _context.Subcategorias.AsNoTracking()
            .Where(x => idsDoLado.Contains(x.CategoriaId) && (x.UsuarioId == null || x.UsuarioId == usuarioId))
            .Select(x => new { x.Id, x.CategoriaId, x.Nome })
            .ToListAsync();
        var subPorId = subs.ToDictionary(x => x.Id);
        var comSub = subs.Select(x => x.CategoriaId).ToHashSet();
        var vigentes = (await VigentesAsync(usuarioId, ano, mes))
            .Where(o => o.CategoriaId is { } c && doLado.ContainsKey(c)).ToList();

        var doMes = _context.Transacoes.AsNoTracking()
            .Where(t => t.CriadoPor == usuarioId && t.Data.Year == ano && t.Data.Month == mes);
        doMes = lado == Finalidade.Investimento
            ? doMes.Where(t => t.EhInvestimento && t.Ativo && t.StatusTransacao != StatusTransacao.Cancelado)
            : doMes.Where(RendaService.EhRenda);
        // Investimento: aporte (saída) soma, resgate (entrada) desconta.
        var movimentos = await doMes
            .GroupBy(t => new { t.CategoriaId, t.SubcategoriaId, Efetivado = t.StatusTransacao == StatusTransacao.Executado })
            .Select(g => new
            {
                g.Key.CategoriaId, g.Key.SubcategoriaId, g.Key.Efetivado,
                // Renda que volta de empréstimo conta só os juros (RegrasFinanceiras.ValorNoResultado).
                Valor = g.Sum(t => t.Tipo == TipoTransacao.Receita && lado == Finalidade.Investimento ? -t.Valor
                    : t.EhEmprestimo ? (t.ValorJuros ?? 0m) : t.Valor),
            })
            .ToListAsync();

        // A fonte de um movimento: a subcategoria (se é da categoria) ou a categoria inteira.
        (Guid? Cat, Guid? Sub) Fonte(Guid? c, Guid? sub) =>
            sub is { } x && subPorId.TryGetValue(x, out var sc) && sc.CategoriaId == c ? (c, sub) : (c, null);
        var porFonte = movimentos.GroupBy(e => Fonte(e.CategoriaId, e.SubcategoriaId)).ToDictionary(g => g.Key,
            g => (Realizado: g.Where(e => e.Efetivado).Sum(e => e.Valor), AindaVem: g.Where(e => !e.Efetivado).Sum(e => e.Valor)));
        var outrasIds = porFonte.Keys.Where(k => k.Cat is { } c && !doLado.ContainsKey(c)).Select(k => k.Cat!.Value).Distinct().ToList();
        var nomesOutras = await _context.Categorias.AsNoTracking()
            .Where(c => outrasIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Descricao);
        string NomeCategoria(Guid? c) => c is not { } id ? "Sem categoria"
            : doLado.TryGetValue(id, out var n) ? n : nomesOutras.GetValueOrDefault(id, "Categoria");
        string Nome((Guid? Cat, Guid? Sub) f) => f.Sub is { } x ? subPorId[x].Nome
            : f.Cat is { } id && comSub.Contains(id) ? $"{NomeCategoria(id)} (sem subcategoria)" : NomeCategoria(f.Cat);

        var linhas = vigentes
            .Select(o =>
            {
                var f = (o.CategoriaId, o.SubcategoriaId);
                var m = porFonte.GetValueOrDefault(f);
                return new FonteDoMesDto(o.CategoriaId!.Value, o.SubcategoriaId, Nome(f), NomeCategoria(o.CategoriaId),
                    o.ValorLimite, m.Realizado, m.AindaVem, o.Ano, o.Mes);
            })
            .OrderByDescending(r => r.Planejado).ThenBy(r => r.Nome, StringComparer.CurrentCulture)
            .ToList();

        var planejadas = vigentes.Select(o => (o.CategoriaId, o.SubcategoriaId)).ToHashSet();
        var semPlanejado = porFonte
            .Where(kv => !planejadas.Contains(kv.Key) && (kv.Value.Realizado != 0 || kv.Value.AindaVem != 0))
            .Select(kv => new FonteSemPlanejadoDto(kv.Key.Cat, kv.Key.Sub, Nome(kv.Key), NomeCategoria(kv.Key.Cat),
                kv.Value.Realizado, kv.Value.AindaVem, kv.Key.Cat is { } c && doLado.ContainsKey(c)))
            .OrderByDescending(r => Math.Abs(r.Realizado) + Math.Abs(r.AindaVem))
            .ToList();
        // Como a planilha: toda fonte aparece. Cada subcategoria do lado e a categoria do lado sem subcategoria.
        var listadas = planejadas.Concat(semPlanejado.Select(r => (r.CategoriaId, r.SubcategoriaId))).ToHashSet();
        var fontes = subs.Select(x => ((Guid?)x.CategoriaId, (Guid?)x.Id))
            .Concat(doLado.Keys.Where(c => !comSub.Contains(c)).Select(c => ((Guid?)c, (Guid?)null)));
        semPlanejado.AddRange(fontes.Where(f => !listadas.Contains(f))
            .Select(f => new FonteSemPlanejadoDto(f.Item1, f.Item2, Nome(f), NomeCategoria(f.Item1), 0m, 0m, true))
            .OrderBy(r => r.Nome, StringComparer.CurrentCulture));

        return new FontesDoMesDto(ano, mes, Editavel(ano, mes, agora ?? HorarioBrasil.Agora()),
            linhas.Sum(l => l.Planejado), linhas.Sum(l => l.Realizado), linhas.Sum(l => l.AindaVem), linhas, semPlanejado);
    }

    private async Task<FontesDoMesDto> DefinirFonteAsync(Finalidade lado, DefinirFonteDto dto, Guid usuarioId, DateTime? agora)
    {
        ValidarMes(dto.Ano, dto.Mes);
        if (dto.Valor <= 0 || dto.Valor > 999_999_999.99m)
            throw new ArgumentException(lado == Finalidade.Investimento ? "Diga quanto você planeja investir." : "Diga quanto você espera receber.");
        ExigirEditavel(dto.Ano, dto.Mes, agora ?? HorarioBrasil.Agora());
        await ExigirFonteAsync(lado, dto.CategoriaId, dto.SubcategoriaId, usuarioId);
        await GravarAsync(usuarioId, dto.CategoriaId, dto.SubcategoriaId, dto.Ano, dto.Mes, dto.Valor);
        return await FontesDoMesAsync(usuarioId, dto.Ano, dto.Mes, lado, agora);
    }

    private async Task<FontesDoMesDto> TirarFonteAsync(Finalidade lado, Guid categoriaId, Guid? subcategoriaId, int ano, int mes, Guid usuarioId, DateTime? agora)
    {
        ValidarMes(ano, mes);
        ExigirEditavel(ano, mes, agora ?? HorarioBrasil.Agora());
        await ExigirFonteAsync(lado, categoriaId, subcategoriaId, usuarioId);
        await ApagarAsync(usuarioId, categoriaId, subcategoriaId, ano, mes);
        return await FontesDoMesAsync(usuarioId, ano, mes, lado, agora);
    }

    /// <summary>
    /// A renda esperada do mês pelo planejado das categorias de receita (null = a pessoa nunca planejou receita por
    /// categoria até o mês; aí vale a declaração antiga de <see cref="RendaPrevista"/>). <c>DoMes</c>: mudou neste mês.
    /// </summary>
    public static async Task<(decimal Total, bool DoMes)?> ReceitaPlanejadaAsync(AppDbContext context, Guid usuarioId, int ano, int mes)
    {
        var chave = Chave(ano, mes);
        var linhas = await context.Orcamentos.AsNoTracking()
            .Where(o => o.UsuarioId == usuarioId && o.Categoria != null && o.Categoria.Finalidade == Finalidade.Receita
                        && o.Ano * 12 + o.Mes <= chave)
            .ToListAsync();
        if (linhas.Count == 0) return null;
        var total = linhas.GroupBy(o => (o.CategoriaId, o.SubcategoriaId)).Sum(g => g.MaxBy(o => Chave(o.Ano, o.Mes))!.ValorLimite);
        return (total, linhas.Any(o => Chave(o.Ano, o.Mes) == chave));
    }

    /// <summary>Passou (o que já aconteceu) › vai passar (com o que ainda vem) › perto (do alerta) › ok.</summary>
    public static string Situacao(decimal limite, decimal gasto, decimal aindaVem, decimal percentual, decimal alerta) =>
        gasto > limite ? "passou" : gasto + aindaVem > limite ? "vai-passar" : percentual >= alerta ? "perto" : "ok";

    private static int Prioridade(string situacao) => situacao switch { "passou" => 0, "vai-passar" => 1, "perto" => 2, _ => 3 };

    /// <summary>
    /// A resposta do limite ("e agora?"), contando o que ainda vem na categoria. O que passou é só o que já
    /// aconteceu; o que vem entra na conta da frase, nunca no número da sobra.
    /// </summary>
    public static string? Responder(string situacao, decimal limite, decimal gasto, IReadOnlyList<AindaVemDto> vem)
    {
        var totalVem = vem.Sum(v => v.Valor);
        var vemFrase = vem.Count switch
        {
            0 => null,
            1 => $"Ainda vem {vem[0].Descricao} (dia {vem[0].Data.Day}, {Reais.Formatar(vem[0].Valor)}).",
            _ => $"Ainda vêm {vem.Count} contas ({Reais.Formatar(totalVem)}).",
        };
        return situacao switch
        {
            "passou" when vemFrase is not null =>
                $"Passou {Reais.Formatar(gasto - limite)}. {vemFrase} Pausar ou cancelar uma dessas contas alivia o mês.",
            "passou" => $"Passou {Reais.Formatar(gasto - limite)} do planejado.",
            "vai-passar" => $"{vemFrase} Contando isso, passa {Reais.Formatar(gasto + totalVem - limite)} do planejado.",
            _ when vemFrase is not null => $"{vemFrase} Contando isso, dá pra gastar mais {Reais.Formatar(limite - gasto - totalVem)} sem passar.",
            "perto" => $"Dá pra gastar mais {Reais.Formatar(limite - gasto)} sem passar.",
            _ => null,
        };
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /// <summary>Grava o valor do mês e apaga as linhas dos meses depois (o novo valor vale pra frente).</summary>
    private async Task GravarAsync(Guid usuarioId, Guid? categoriaId, Guid? subcategoriaId, int ano, int mes, decimal valor)
    {
        var chave = Chave(ano, mes);
        var linhas = await _context.Orcamentos
            .Where(o => o.UsuarioId == usuarioId && o.CategoriaId == categoriaId && o.SubcategoriaId == subcategoriaId
                        && o.Ano * 12 + o.Mes >= chave)
            .ToListAsync();
        var doMes = linhas.FirstOrDefault(o => Chave(o.Ano, o.Mes) == chave);
        _context.Orcamentos.RemoveRange(linhas.Where(o => o != doMes));
        if (doMes is null)
            _context.Orcamentos.Add(new Orcamento
            {
                Id = Guid.NewGuid(), UsuarioId = usuarioId, CategoriaId = categoriaId, SubcategoriaId = subcategoriaId,
                Ano = ano, Mes = mes, ValorLimite = valor,
            });
        else
        {
            doMes.ValorLimite = valor;
            doMes.AtualizadoEm = DateTime.UtcNow;
        }
        await _context.SaveChangesAsync();
    }

    /// <summary>Tira do mês em diante: apaga as linhas dali pra frente e, se vinha valendo de antes, grava zero no mês
    /// (os meses passados continuam com o valor).</summary>
    private async Task ApagarAsync(Guid usuarioId, Guid? categoriaId, Guid? subcategoriaId, int ano, int mes)
    {
        var chave = Chave(ano, mes);
        var daCategoria = await _context.Orcamentos
            .Where(o => o.UsuarioId == usuarioId && o.CategoriaId == categoriaId && o.SubcategoriaId == subcategoriaId)
            .ToListAsync();
        var vigenteAntes = daCategoria.Where(o => Chave(o.Ano, o.Mes) < chave).MaxBy(o => Chave(o.Ano, o.Mes));
        var doMesEmDiante = daCategoria.Where(o => Chave(o.Ano, o.Mes) >= chave).ToList();
        if (doMesEmDiante.Count == 0 && (vigenteAntes is null || vigenteAntes.ValorLimite == 0))
            throw new KeyNotFoundException("Essa categoria não tem planejado neste mês.");

        _context.Orcamentos.RemoveRange(doMesEmDiante);
        if (vigenteAntes is { ValorLimite: > 0 })
            _context.Orcamentos.Add(new Orcamento
            {
                Id = Guid.NewGuid(), UsuarioId = usuarioId, CategoriaId = categoriaId, SubcategoriaId = subcategoriaId,
                Ano = ano, Mes = mes, ValorLimite = 0m,
            });
        await _context.SaveChangesAsync();
    }

    /// <summary>As categorias da pessoa (as padrão e as dela) de um lado: receita (fora "Dinheiro que volta", cashback e
    /// reembolso não são renda) ou investimento. Id → nome.</summary>
    private Task<Dictionary<Guid, string>> CategoriasDoLadoAsync(Guid usuarioId, Finalidade lado) =>
        _context.Categorias.AsNoTracking()
            .Where(c => c.Finalidade == lado && (c.UsuarioId == null || c.UsuarioId == usuarioId)
                        && !(c.UsuarioId == null && c.Descricao == RendaService.CategoriaDinheiroQueVolta))
            .ToDictionaryAsync(c => c.Id, c => c.Descricao);

    /// <summary>Fonte da pessoa (ou padrão) do lado certo: categoria de receita que é renda ("Dinheiro que volta" não se
    /// planeja) ou de investimento e, se vier, uma subcategoria DELA.</summary>
    private async Task ExigirFonteAsync(Finalidade lado, Guid categoriaId, Guid? subcategoriaId, Guid usuarioId)
    {
        await DonoRecursos.ExigirCategoriaAsync(_context, categoriaId, usuarioId);
        if (!(await CategoriasDoLadoAsync(usuarioId, lado)).ContainsKey(categoriaId))
            throw new ArgumentException(lado == Finalidade.Investimento ? "Escolha uma categoria de investimento." : "Escolha uma categoria de receita.");
        if (subcategoriaId is not { } sub) return;
        await DonoRecursos.ExigirSubcategoriaAsync(_context, sub, usuarioId);
        if (!await _context.Subcategorias.AnyAsync(x => x.Id == sub && x.CategoriaId == categoriaId))
            throw new ArgumentException("A subcategoria tem que ser da categoria.");
    }

    /// <summary>A linha que vale em cada categoria no mês (a mais recente até ele), sem as "sem limite".</summary>
    /// <summary>
    /// O planejado de cada mês de uma janela, numa consulta só (a linha do tempo de Relatórios): as despesas planejadas
    /// (a mesma soma do TotalLimite de <see cref="DoMesAsync"/>: os limites por categoria vigentes no mês, sem o de
    /// "todos os gastos" nem subcategoria) e os investimentos planejados (a soma do TotalPlanejado de
    /// <see cref="InvestimentosDoMesAsync"/>: as fontes de investimento vigentes). Vigente = o último valor lançado até o
    /// mês, igual a <see cref="VigentesAsync"/>. Mês sem planejado não aparece.
    /// </summary>
    public static async Task<Dictionary<(int Ano, int Mes), (decimal Despesas, decimal Investimentos)>> PlanejadoPorMesAsync(
        AppDbContext context, Guid usuarioId, DateTime de, int meses)
    {
        var ultimaChave = Chave(de.Year, de.Month) + meses - 1;
        var linhas = await context.Orcamentos.AsNoTracking()
            .Where(o => o.UsuarioId == usuarioId && o.Ano * 12 + o.Mes <= ultimaChave)
            .Select(o => new { o.CategoriaId, o.SubcategoriaId, o.Ano, o.Mes, o.ValorLimite })
            .ToListAsync();
        if (linhas.Count == 0) return new();
        var lados = await context.Categorias.AsNoTracking()
            .Where(c => (c.Finalidade == Finalidade.Receita || c.Finalidade == Finalidade.Investimento) && (c.UsuarioId == null || c.UsuarioId == usuarioId))
            .Select(c => new { c.Id, c.Finalidade })
            .ToListAsync();
        var investimento = lados.Where(c => c.Finalidade == Finalidade.Investimento).Select(c => c.Id).ToHashSet();
        var foraDasDespesas = lados.Select(c => c.Id).ToHashSet();
        var porFonte = linhas.GroupBy(o => (o.CategoriaId, o.SubcategoriaId)).ToList();
        var resultado = new Dictionary<(int, int), (decimal, decimal)>();
        for (var i = 0; i < meses; i++)
        {
            var m = de.AddMonths(i);
            var chave = Chave(m.Year, m.Month);
            decimal despesas = 0m, investimentos = 0m;
            foreach (var fonte in porFonte)
            {
                var vigente = fonte.Where(o => Chave(o.Ano, o.Mes) <= chave).MaxBy(o => Chave(o.Ano, o.Mes));
                if (vigente is null || vigente.ValorLimite <= 0) continue;
                if (fonte.Key.CategoriaId is { } c && investimento.Contains(c)) investimentos += vigente.ValorLimite;
                else if (fonte.Key.CategoriaId is { } d && fonte.Key.SubcategoriaId is null && !foraDasDespesas.Contains(d)) despesas += vigente.ValorLimite;
            }
            if (despesas > 0 || investimentos > 0) resultado[(m.Year, m.Month)] = (despesas, investimentos);
        }
        return resultado;
    }

    /// <summary>
    /// O limite de cada categoria somado nos meses de uma janela (o "Ano completo" de Relatórios: o limite do ano é a soma
    /// do limite vigente em cada mês). Só limite de categoria de despesa, sem subcategoria nem "todos os gastos", como em
    /// <see cref="PlanejadoPorMesAsync"/>. Categoria sem limite na janela não aparece.
    /// </summary>
    public static async Task<Dictionary<Guid, decimal>> LimitesPorCategoriaAsync(AppDbContext context, Guid usuarioId, DateTime de, int meses)
    {
        var ultimaChave = Chave(de.Year, de.Month) + meses - 1;
        var linhas = await context.Orcamentos.AsNoTracking()
            .Where(o => o.UsuarioId == usuarioId && o.Ano * 12 + o.Mes <= ultimaChave && o.CategoriaId != null && o.SubcategoriaId == null)
            .Select(o => new { CategoriaId = o.CategoriaId!.Value, o.Ano, o.Mes, o.ValorLimite })
            .ToListAsync();
        if (linhas.Count == 0) return new();
        var foraDasDespesas = (await context.Categorias.AsNoTracking()
            .Where(c => (c.Finalidade == Finalidade.Receita || c.Finalidade == Finalidade.Investimento) && (c.UsuarioId == null || c.UsuarioId == usuarioId))
            .Select(c => c.Id).ToListAsync()).ToHashSet();
        var resultado = new Dictionary<Guid, decimal>();
        foreach (var fonte in linhas.Where(o => !foraDasDespesas.Contains(o.CategoriaId)).GroupBy(o => o.CategoriaId))
        {
            var soma = 0m;
            for (var i = 0; i < meses; i++)
            {
                var m = de.AddMonths(i);
                var vigente = fonte.Where(o => Chave(o.Ano, o.Mes) <= Chave(m.Year, m.Month)).MaxBy(o => Chave(o.Ano, o.Mes));
                if (vigente is { ValorLimite: > 0 }) soma += vigente.ValorLimite;
            }
            if (soma > 0) resultado[fonte.Key] = soma;
        }
        return resultado;
    }

    private async Task<List<Orcamento>> VigentesAsync(Guid usuarioId, int ano, int mes)
    {
        var chave = Chave(ano, mes);
        var linhas = await _context.Orcamentos.AsNoTracking()
            .Where(o => o.UsuarioId == usuarioId && o.Ano * 12 + o.Mes <= chave)
            .ToListAsync();
        return linhas.GroupBy(o => (o.CategoriaId, o.SubcategoriaId))
            .Select(g => g.MaxBy(o => Chave(o.Ano, o.Mes))!)
            .Where(o => o.ValorLimite > 0)
            .ToList();
    }

    /// <summary>Mês atual ou futuro. Um dia de folga pro fuso: o mês em UTC vira antes do de Brasília.</summary>
    private static bool Editavel(int ano, int mes, DateTime agora)
    {
        var hoje = agora.AddDays(-1);
        return Chave(ano, mes) >= Chave(hoje.Year, hoje.Month);
    }

    private static void ExigirEditavel(int ano, int mes, DateTime agora)
    {
        if (!Editavel(ano, mes, agora))
            throw new InvalidOperationException("Mês que já passou fica como estava. Mude o planejado a partir deste mês.");
    }

    private static void ValidarMes(int ano, int mes)
    {
        if (mes < 1 || mes > 12) throw new ArgumentException("Mês inválido.");
        if (ano < 2000 || ano > 2100) throw new ArgumentException("Ano inválido.");
    }

    /// <summary>Categoria da pessoa (ou padrão) que aceita gasto: planejado de despesa em categoria de receita ou de
    /// investimento (que tem a seção dela) não faz sentido.</summary>
    private async Task ExigirCategoriaDeGastoAsync(Guid categoriaId, Guid usuarioId)
    {
        await DonoRecursos.ExigirCategoriaAsync(_context, categoriaId, usuarioId);
        if (await _context.Categorias.AnyAsync(c => c.Id == categoriaId && (c.Finalidade == Finalidade.Receita || c.Finalidade == Finalidade.Investimento)))
            throw new ArgumentException("O planejado é pra categoria de gasto.");
    }
}
