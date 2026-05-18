using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

public class DependenteService
{
    private readonly AppDbContext _context;

    public DependenteService(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>Cria um dependente na família. Só membros ativos podem.</summary>
    public async Task<DependenteDto> CriarAsync(Guid familiaId, Guid usuarioId, CriarDependenteDto dto)
    {
        await ExigirMembroAsync(familiaId, usuarioId);

        var dependente = new Dependente
        {
            Id = Guid.NewGuid(),
            FamiliaId = familiaId,
            Nome = dto.Nome,
            Apelido = dto.Apelido,
            DataNascimento = dto.DataNascimento,
            Tipo = dto.Tipo,
        };

        _context.Dependentes.Add(dependente);
        await _context.SaveChangesAsync();

        return MapToDto(dependente);
    }

    /// <summary>Lista os dependentes ativos da família.</summary>
    public async Task<List<DependenteDto>> ListarAsync(Guid familiaId, Guid usuarioId)
    {
        await ExigirMembroAsync(familiaId, usuarioId);

        return await _context.Dependentes
            .Where(d => d.FamiliaId == familiaId && d.Ativo)
            .OrderBy(d => d.Nome)
            .Select(d => new DependenteDto(
                d.Id, d.FamiliaId, d.Nome, d.Apelido, d.DataNascimento, d.Tipo, d.Ativo))
            .ToListAsync();
    }

    /// <summary>Edita um dependente.</summary>
    public async Task<DependenteDto> AtualizarAsync(
        Guid familiaId, Guid dependenteId, Guid usuarioId, CriarDependenteDto dto)
    {
        await ExigirMembroAsync(familiaId, usuarioId);

        var dependente = await BuscarDependenteAsync(familiaId, dependenteId);

        dependente.Nome = dto.Nome;
        dependente.Apelido = dto.Apelido;
        dependente.DataNascimento = dto.DataNascimento;
        dependente.Tipo = dto.Tipo;
        await _context.SaveChangesAsync();

        return MapToDto(dependente);
    }

    /// <summary>Inativa o dependente (soft delete — preserva histórico de atribuições).</summary>
    public async Task InativarAsync(Guid familiaId, Guid dependenteId, Guid usuarioId)
    {
        await ExigirMembroAsync(familiaId, usuarioId);

        var dependente = await BuscarDependenteAsync(familiaId, dependenteId);
        dependente.Ativo = false;
        await _context.SaveChangesAsync();
    }

    /// <summary>Total gasto com o dependente no mês/ano (despesas executadas).</summary>
    public async Task<GastoDependenteDto> ObterGastoAsync(
        Guid familiaId, Guid dependenteId, Guid usuarioId, int mes, int ano)
    {
        await ExigirMembroAsync(familiaId, usuarioId);

        var dependente = await BuscarDependenteAsync(familiaId, dependenteId);

        var total = await _context.Transacoes
            .Where(t => t.DependenteId == dependenteId
                && t.Ativo
                && t.StatusTransacao == StatusTransacao.Executado
                && t.Tipo == TipoTransacao.Despesa
                && t.Data.Month == mes
                && t.Data.Year == ano)
            .SumAsync(t => (decimal?)t.Valor) ?? 0m;

        return new GastoDependenteDto(dependente.Id, dependente.Nome, mes, ano, total);
    }

    /// <summary>Atribui ou desatribui uma transação a um dependente.</summary>
    public async Task AtribuirAsync(Guid transacaoId, Guid usuarioId, Guid? dependenteId)
    {
        var transacao = await _context.Transacoes
            .FirstOrDefaultAsync(t => t.Id == transacaoId && t.Ativo)
            ?? throw new KeyNotFoundException("Transação não encontrada.");

        if (transacao.CriadoPor != usuarioId)
            throw new UnauthorizedAccessException("Você só pode alterar suas próprias transações.");

        if (dependenteId is null)
        {
            transacao.DependenteId = null;
            await _context.SaveChangesAsync();
            return;
        }

        if (transacao.Tipo != TipoTransacao.Despesa)
            throw new InvalidOperationException("Apenas despesas podem ser atribuídas a um dependente.");

        var dependente = await _context.Dependentes
            .FirstOrDefaultAsync(d => d.Id == dependenteId && d.Ativo)
            ?? throw new KeyNotFoundException("Dependente não encontrado.");

        // A transação deve pertencer a um membro da mesma família do dependente.
        await ExigirMembroAsync(dependente.FamiliaId, usuarioId);

        transacao.DependenteId = dependente.Id;
        await _context.SaveChangesAsync();
    }

    private async Task<Dependente> BuscarDependenteAsync(Guid familiaId, Guid dependenteId)
    {
        return await _context.Dependentes
            .FirstOrDefaultAsync(d => d.Id == dependenteId && d.FamiliaId == familiaId && d.Ativo)
            ?? throw new KeyNotFoundException("Dependente não encontrado.");
    }

    private async Task ExigirMembroAsync(Guid familiaId, Guid usuarioId)
    {
        var ehMembro = await _context.MembrosFamilia
            .AnyAsync(m => m.FamiliaId == familiaId && m.UsuarioId == usuarioId && m.Ativo);
        if (!ehMembro)
            throw new KeyNotFoundException("Família não encontrada.");
    }

    private static DependenteDto MapToDto(Dependente d) =>
        new(d.Id, d.FamiliaId, d.Nome, d.Apelido, d.DataNascimento, d.Tipo, d.Ativo);
}
