using System.Linq.Expressions;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.DTOs.Renda;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Renda de cada um e o que a família vê dela (docs/features/familia/renda-e-visibilidade.md).
/// Renda é da PESSOA: o recebido vem dos lançamentos de receita que são renda; o previsto é o que ela DECLARA
/// esperar, fixa + variável (<see cref="RendaPrevista"/>; nada a ver com "contas fixas", que são contas a pagar).
/// A família não guarda número nenhum: guarda só a regra de quem vê (<see cref="MembroFamilia.VisibilidadeRenda"/>),
/// e tudo que sai pra família é calculado aqui, pra quem pede. Nunca mandar valor pro front esconder.
/// </summary>
public class RendaService
{
    public const string CategoriaDinheiroQueVolta = "Dinheiro que volta";
    private const int MesesDaSugestao = 3;

    private readonly AppDbContext _context;

    public RendaService(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>Receita que é renda: entra no resultado (fora transferência, pagamento de fatura, saldo inicial,
    /// ajuste, Pix no Crédito) e não é "dinheiro que volta" (cashback, reembolso, estorno: categoria padrão).</summary>
    public static readonly Expression<Func<Transacao, bool>> EhRenda = t =>
        t.Tipo == TipoTransacao.Receita && t.Ativo && t.StatusTransacao != StatusTransacao.Cancelado
        && !t.EhTransferencia && !t.EhPagamentoFatura && !t.EhSaldoInicial && !t.EhAjusteReconciliacao && !t.EhPixNoCredito
        && (t.Categoria == null || t.Categoria.UsuarioId != null || t.Categoria.Descricao != CategoriaDinheiroQueVolta);

    // ── Pessoa ───────────────────────────────────────────────────────────────────────────────────

    /// <summary>O mês da pessoa: previsto (fixa + variável declaradas), recebido, o que falta e as entradas.</summary>
    public async Task<RendaMesDto> ObterMesAsync(Guid usuarioId, int ano, int mes)
    {
        ValidarMes(ano, mes);
        var entradas = await _context.Transacoes
            .Where(EhRenda)
            .Where(t => t.CriadoPor == usuarioId && t.Data.Year == ano && t.Data.Month == mes)
            .OrderByDescending(t => t.Data).ThenByDescending(t => t.CriadoEm)
            .Select(t => new EntradaRendaDto(t.Id, t.Data, t.Descricao, t.Valor,
                t.Subcategoria != null ? t.Subcategoria.Nome : null,
                t.StatusTransacao == StatusTransacao.Executado))
            .ToListAsync();

        var recebido = entradas.Where(e => e.Recebida).Sum(e => e.Valor);
        var (fixa, variavel, doMes) = await DeclaracaoAsync(usuarioId, ano, mes);
        var previsto = fixa + variavel;
        var sugestao = await SugestaoAsync(usuarioId, ano, mes);

        return new RendaMesDto(ano, mes, previsto, fixa, variavel, doMes, recebido, Math.Max(0m, previsto - recebido), sugestao, entradas);
    }

    /// <summary>Declara o que a pessoa espera no mês (fixa e variável). Vale pros meses seguintes até ela mudar.</summary>
    public async Task<RendaMesDto> DefinirPrevistoAsync(Guid usuarioId, DefinirRendaPrevistaDto dto)
    {
        ValidarMes(dto.Ano, dto.Mes);
        if (dto.FixaEsperada < 0 || dto.VariavelEsperada < 0)
            throw new ArgumentException("A renda esperada não pode ser negativa.");

        var linha = await _context.RendasPrevistas
            .FirstOrDefaultAsync(r => r.UsuarioId == usuarioId && r.Ano == dto.Ano && r.Mes == dto.Mes);
        if (linha == null)
        {
            _context.RendasPrevistas.Add(new RendaPrevista
            {
                Id = Guid.NewGuid(), UsuarioId = usuarioId, Ano = dto.Ano, Mes = dto.Mes,
                FixaEsperada = dto.FixaEsperada, VariavelEsperada = dto.VariavelEsperada, AtualizadoEm = DateTime.UtcNow,
            });
        }
        else
        {
            linha.FixaEsperada = dto.FixaEsperada;
            linha.VariavelEsperada = dto.VariavelEsperada;
            linha.AtualizadoEm = DateTime.UtcNow;
        }
        await _context.SaveChangesAsync();
        return await ObterMesAsync(usuarioId, dto.Ano, dto.Mes);
    }

    /// <summary>Apaga a declaração do mês: volta a valer a do último mês que tem (ou nenhuma).</summary>
    public async Task<RendaMesDto> LimparPrevistoAsync(Guid usuarioId, int ano, int mes)
    {
        ValidarMes(ano, mes);
        var linha = await _context.RendasPrevistas
            .FirstOrDefaultAsync(r => r.UsuarioId == usuarioId && r.Ano == ano && r.Mes == mes);
        if (linha != null)
        {
            _context.RendasPrevistas.Remove(linha);
            await _context.SaveChangesAsync();
        }
        return await ObterMesAsync(usuarioId, ano, mes);
    }

    // ── Família ──────────────────────────────────────────────────────────────────────────────────

    /// <summary>A própria pessoa escolhe o que a família vê da renda dela. Nem o admin muda a dos outros.</summary>
    public async Task DefinirVisibilidadeAsync(Guid familiaId, Guid membroId, Guid usuarioId, DefinirVisibilidadeRendaDto dto)
    {
        await FamiliaPermissoes.ExigirMembroAsync(_context, familiaId, usuarioId);
        if (!Enum.IsDefined(dto.Visibilidade))
            throw new ArgumentException("Escolha o que a família vê da sua renda.");

        var membro = await _context.MembrosFamilia
            .FirstOrDefaultAsync(m => m.Id == membroId && m.FamiliaId == familiaId && m.Ativo)
            ?? throw new KeyNotFoundException("Membro não encontrado.");
        if (membro.UsuarioId != usuarioId)
            throw new ForbiddenAccessException("Só você decide quem vê a sua renda.");

        var para = new List<Guid>();
        if (dto.Visibilidade == VisibilidadeRenda.ValorParaAlguns)
        {
            var pedidos = (dto.Para ?? new List<Guid>()).Where(id => id != usuarioId).Distinct().ToList();
            var membrosDaFamilia = await _context.MembrosFamilia
                .Where(m => m.FamiliaId == familiaId && m.Ativo && pedidos.Contains(m.UsuarioId))
                .Select(m => m.UsuarioId)
                .ToListAsync();
            if (membrosDaFamilia.Count != pedidos.Count)
                throw new ArgumentException("Só dá pra mostrar a renda pra quem está na família.");
            para = membrosDaFamilia;
        }

        membro.VisibilidadeRenda = dto.Visibilidade;
        membro.RendaVisivelPara = para;
        await _context.SaveChangesAsync();
    }

    /// <summary>Renda da casa no mês pra quem pede: cada membro aparece, mas o valor só vem de quem liberou pra
    /// essa pessoa (a própria sempre; quem só vê nunca vê o valor dos outros). Totais somam só o mostrado.</summary>
    public async Task<RendaFamiliaDto> ObterRendaFamiliaAsync(Guid familiaId, Guid usuarioId, int ano, int mes)
    {
        ValidarMes(ano, mes);
        var papel = await FamiliaPermissoes.ExigirMembroAsync(_context, familiaId, usuarioId);
        var membros = await _context.MembrosFamilia
            .Where(m => m.FamiliaId == familiaId && m.Ativo)
            .Include(m => m.Usuario)
            .OrderBy(m => m.EntrouEm)
            .ToListAsync();

        var saida = new List<RendaMembroDto>();
        foreach (var m in membros)
        {
            var mostrada = m.UsuarioId == usuarioId || (papel != PapelFamilia.Dependente && (
                m.VisibilidadeRenda == VisibilidadeRenda.ValorParaTodos
                || (m.VisibilidadeRenda == VisibilidadeRenda.ValorParaAlguns && m.RendaVisivelPara.Contains(usuarioId))));
            if (!mostrada)
            {
                saida.Add(new RendaMembroDto(m.UsuarioId, m.Usuario!.Nome, false, null, null));
                continue;
            }
            var (recebido, previsto) = await ResumoAsync(m.UsuarioId, ano, mes);
            saida.Add(new RendaMembroDto(m.UsuarioId, m.Usuario!.Nome, true, recebido, previsto));
        }

        return new RendaFamiliaDto(ano, mes,
            saida.Where(s => s.Mostrada).Sum(s => s.Recebido ?? 0m),
            saida.Where(s => s.Mostrada).Sum(s => s.Previsto ?? 0m),
            saida);
    }

    /// <summary>Peso de cada membro no rateio proporcional do mês: a renda prevista (declarada) de quem não escondeu
    /// tudo. Quem escolheu "nada" (ou não declarou) fica com zero; sem nenhum peso o balanço cai pra divisão igual.
    /// Quem "só vê" (Dependente) não paga e nem entra.</summary>
    public async Task<Dictionary<Guid, decimal>> PesosAsync(Guid familiaId, int ano, int mes)
    {
        var membros = await _context.MembrosFamilia
            .Where(m => m.FamiliaId == familiaId && m.Ativo && m.PapelPermissao != PapelFamilia.Dependente)
            .Select(m => new { m.UsuarioId, m.VisibilidadeRenda })
            .ToListAsync();
        var pesos = new Dictionary<Guid, decimal>();
        foreach (var m in membros)
        {
            if (m.VisibilidadeRenda == VisibilidadeRenda.Nada) { pesos[m.UsuarioId] = 0m; continue; }
            var (_, previsto) = await ResumoAsync(m.UsuarioId, ano, mes);
            pesos[m.UsuarioId] = previsto;
        }
        return pesos;
    }

    // ── Miolo ────────────────────────────────────────────────────────────────────────────────────

    private async Task<(decimal Recebido, decimal Previsto)> ResumoAsync(Guid usuarioId, int ano, int mes)
    {
        var recebido = await _context.Transacoes
            .Where(EhRenda)
            .Where(t => t.CriadoPor == usuarioId && t.Data.Year == ano && t.Data.Month == mes
                        && t.StatusTransacao == StatusTransacao.Executado)
            .SumAsync(t => t.Valor);
        var (fixa, variavel, _) = await DeclaracaoAsync(usuarioId, ano, mes);
        return (recebido, fixa + variavel);
    }

    /// <summary>O que vale no mês: a declaração do mês, ou a do último mês anterior que tem.</summary>
    private async Task<(decimal Fixa, decimal Variavel, bool DoMes)> DeclaracaoAsync(Guid usuarioId, int ano, int mes)
    {
        var chave = ano * 12 + mes;
        var linha = await _context.RendasPrevistas
            .Where(r => r.UsuarioId == usuarioId && r.Ano * 12 + r.Mes <= chave)
            .OrderByDescending(r => r.Ano).ThenByDescending(r => r.Mes)
            .FirstOrDefaultAsync();
        if (linha == null) return (0m, 0m, false);
        return (linha.FixaEsperada, linha.VariavelEsperada, linha.Ano == ano && linha.Mes == mes);
    }

    /// <summary>Média do recebido nos meses anteriores que tiveram renda (até 3), pra quem ainda não disse o previsto.</summary>
    private async Task<decimal?> SugestaoAsync(Guid usuarioId, int ano, int mes)
    {
        var fim = new DateOnly(ano, mes, 1);
        var inicio = fim.AddMonths(-MesesDaSugestao);
        var meses = await _context.Transacoes
            .Where(EhRenda)
            .Where(t => t.CriadoPor == usuarioId && t.StatusTransacao == StatusTransacao.Executado && t.Data >= inicio && t.Data < fim)
            .GroupBy(t => new { t.Data.Year, t.Data.Month })
            .Select(g => g.Sum(t => t.Valor))
            .ToListAsync();
        if (meses.Count == 0) return null;
        return Math.Round(meses.Average(), 2);
    }

    private static void ValidarMes(int ano, int mes)
    {
        if (mes is < 1 or > 12 || ano is < 2000 or > 2100)
            throw new ArgumentException("Mês inválido.");
    }
}
