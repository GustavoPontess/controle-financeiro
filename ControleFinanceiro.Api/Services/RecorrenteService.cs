using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Recorrente;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

public class RecorrenteService
{
    private readonly AppDbContext _context;

    public RecorrenteService(AppDbContext context)
    {
        _context = context;
    }

    private static DateTime ProximaData(DateTime atual, FrequenciaRecorrencia freq) => freq switch
    {
        FrequenciaRecorrencia.Semanal => atual.AddDays(7),
        FrequenciaRecorrencia.Mensal => atual.AddMonths(1),
        FrequenciaRecorrencia.Anual => atual.AddYears(1),
        _ => atual.AddMonths(1)
    };

    private static string DescricaoFrequencia(FrequenciaRecorrencia freq) => freq switch
    {
        FrequenciaRecorrencia.Semanal => "Semanal",
        FrequenciaRecorrencia.Mensal => "Mensal",
        FrequenciaRecorrencia.Anual => "Anual",
        _ => freq.ToString()
    };

    public async Task GerarPendentesAsync(Guid usuarioId)
    {
        var hoje = DateTime.UtcNow.Date;
        var recorrentes = await _context.Recorrentes
            .Where(r => r.CriadoPor == usuarioId && r.Ativo &&
                        (r.DataFim == null || r.DataFim.Value.Date >= hoje))
            .ToListAsync();

        bool houveMudanca = false;
        foreach (var r in recorrentes)
        {
            var proxima = (r.DataProximaGeracao ?? r.DataInicio).Date;
            while (proxima <= hoje && (r.DataFim == null || proxima <= r.DataFim.Value.Date))
            {
                _context.Transacoes.Add(new Transacao
                {
                    Id = Guid.NewGuid(),
                    Descricao = r.Descricao,
                    Valor = r.Valor,
                    Tipo = r.Tipo,
                    CategoriaId = r.CategoriaId,
                    ContaId = r.ContaId,
                    CriadoPor = usuarioId,
                    Data = proxima,
                    RecorrenteOrigemId = r.Id
                });
                proxima = ProximaData(proxima, r.Frequencia);
                houveMudanca = true;
            }
            r.DataProximaGeracao = proxima;
        }

        if (houveMudanca)
            await _context.SaveChangesAsync();
    }

    public async Task<List<RecorrenteDto>> ListarAsync(Guid usuarioId)
    {
        var lista = await _context.Recorrentes
            .Where(r => r.CriadoPor == usuarioId)
            .Include(r => r.Categoria)
            .Include(r => r.Conta)
            .OrderByDescending(r => r.Ativo)
            .ThenBy(r => r.Descricao)
            .AsNoTracking()
            .ToListAsync();

        return lista.Select(r => new RecorrenteDto
        {
            Id = r.Id,
            Descricao = r.Descricao,
            Valor = r.Valor,
            Tipo = (int)r.Tipo,
            TipoDescricao = r.Tipo == TipoTransacao.Receita ? "Receita" : "Despesa",
            CategoriaId = r.CategoriaId,
            CategoriaNome = r.Categoria?.Descricao,
            ContaId = r.ContaId,
            ContaNome = r.Conta?.Nome ?? string.Empty,
            Frequencia = (int)r.Frequencia,
            FrequenciaDescricao = DescricaoFrequencia(r.Frequencia),
            Dia = r.Dia,
            DataInicio = r.DataInicio,
            DataFim = r.DataFim,
            Ativo = r.Ativo,
            DataProximaGeracao = r.DataProximaGeracao
        }).ToList();
    }

    public async Task<RecorrenteDto> CriarAsync(CriarRecorrenteDto dto, Guid usuarioId)
    {
        var conta = await _context.Contas.FindAsync(dto.ContaId)
            ?? throw new Exception("Conta não encontrada.");
        if (conta.UsuarioIdProprietario != usuarioId)
            throw new Exception("Conta não pertence ao usuário.");

        var recorrente = new Recorrente
        {
            Id = Guid.NewGuid(),
            Descricao = dto.Descricao,
            Valor = dto.Valor,
            Tipo = (TipoTransacao)dto.Tipo,
            CategoriaId = dto.CategoriaId,
            ContaId = dto.ContaId,
            Frequencia = (FrequenciaRecorrencia)dto.Frequencia,
            Dia = dto.Dia,
            DataInicio = dto.DataInicio.ToUniversalTime(),
            DataFim = dto.DataFim?.ToUniversalTime(),
            Ativo = true,
            CriadoPor = usuarioId,
            DataProximaGeracao = dto.DataInicio.ToUniversalTime()
        };

        _context.Recorrentes.Add(recorrente);
        await _context.SaveChangesAsync();

        return (await ListarAsync(usuarioId)).First(r => r.Id == recorrente.Id);
    }

    public async Task AtualizarAsync(Guid id, CriarRecorrenteDto dto, Guid usuarioId)
    {
        var r = await _context.Recorrentes.FindAsync(id)
            ?? throw new Exception("Recorrente não encontrado.");
        if (r.CriadoPor != usuarioId)
            throw new Exception("Sem permissão.");

        r.Descricao = dto.Descricao;
        r.Valor = dto.Valor;
        r.Tipo = (TipoTransacao)dto.Tipo;
        r.CategoriaId = dto.CategoriaId;
        r.ContaId = dto.ContaId;
        r.Frequencia = (FrequenciaRecorrencia)dto.Frequencia;
        r.Dia = dto.Dia;
        r.DataFim = dto.DataFim?.ToUniversalTime();

        await _context.SaveChangesAsync();
    }

    public async Task ToggleAtivoAsync(Guid id, Guid usuarioId)
    {
        var r = await _context.Recorrentes.FindAsync(id)
            ?? throw new Exception("Recorrente não encontrado.");
        if (r.CriadoPor != usuarioId)
            throw new Exception("Sem permissão.");

        r.Ativo = !r.Ativo;
        await _context.SaveChangesAsync();
    }

    public async Task DeletarAsync(Guid id, Guid usuarioId)
    {
        var r = await _context.Recorrentes.FindAsync(id)
            ?? throw new Exception("Recorrente não encontrado.");
        if (r.CriadoPor != usuarioId)
            throw new Exception("Sem permissão.");

        _context.Recorrentes.Remove(r);
        await _context.SaveChangesAsync();
    }
}
