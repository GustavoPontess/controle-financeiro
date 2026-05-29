using Microsoft.EntityFrameworkCore;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.DTOs.Emprestimo;
using ControleFinanceiro.Api.Infrastructure;

namespace ControleFinanceiro.Api.Services;

public class EmprestimoService(AppDbContext context)
{
    private readonly AppDbContext _context = context;

    public async Task<PagedResult<EmprestimoDto>> ListarAsync(Guid usuarioId, int page = 1, int pageSize = 25)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _context.Emprestimos
            .Where(e => e.CriadoPor == usuarioId)
            .OrderBy(e => e.Quitado)
            .ThenBy(e => e.DataVencimento)
            .ThenBy(e => e.DataInicio);

        var total = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<EmprestimoDto>
        {
            Items = items.Select(ToDto),
            Total = total,
            Page = page,
            PageSize = pageSize,
        };
    }

    public async Task<EmprestimoDto?> BuscarPorIdAsync(Guid id, Guid usuarioId)
    {
        var e = await _context.Emprestimos.FirstOrDefaultAsync(x => x.Id == id && x.CriadoPor == usuarioId);
        return e is null ? null : ToDto(e);
    }

    public async Task<EmprestimoDto> CriarAsync(CriarEmprestimoDto dto, Guid usuarioId)
    {
        if (dto.ValorTotal <= 0)
            throw new Exception("Valor total do empréstimo deve ser positivo.");

        if (dto.DataVencimento.HasValue && dto.DataVencimento.Value.Date < dto.DataInicio.Date)
            throw new Exception("Data de vencimento não pode ser anterior à data de início.");

        var emprestimo = new Emprestimo
        {
            Id = Guid.NewGuid(),
            Descricao = dto.Descricao,
            Pessoa = dto.Pessoa,
            ValorTotal = dto.ValorTotal,
            ValorPago = 0,
            Tipo = dto.Tipo,
            DataInicio = dto.DataInicio.ToUniversalTime(),
            DataVencimento = dto.DataVencimento.HasValue ? dto.DataVencimento.Value.ToUniversalTime() : null,
            Quitado = false,
            Observacao = dto.Observacao,
            CriadoPor = usuarioId,
        };

        _context.Emprestimos.Add(emprestimo);
        await _context.SaveChangesAsync();
        return ToDto(emprestimo);
    }

    public async Task<bool> RegistrarPagamentoAsync(Guid id, decimal valor, Guid usuarioId)
    {
        if (valor <= 0)
            throw new Exception("Valor do pagamento deve ser positivo.");

        var e = await _context.Emprestimos.FirstOrDefaultAsync(x => x.Id == id && x.CriadoPor == usuarioId);
        if (e is null || e.Quitado) return false;

        e.ValorPago = Math.Min(e.ValorPago + valor, e.ValorTotal);
        if (e.ValorPago >= e.ValorTotal) e.Quitado = true;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> QuitarAsync(Guid id, Guid usuarioId)
    {
        var e = await _context.Emprestimos.FirstOrDefaultAsync(x => x.Id == id && x.CriadoPor == usuarioId);
        if (e is null) return false;

        e.ValorPago = e.ValorTotal;
        e.Quitado = true;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeletarAsync(Guid id, Guid usuarioId)
    {
        var e = await _context.Emprestimos.FirstOrDefaultAsync(x => x.Id == id && x.CriadoPor == usuarioId);
        if (e is null) return false;

        _context.Emprestimos.Remove(e);
        await _context.SaveChangesAsync();
        return true;
    }

    private static EmprestimoDto ToDto(Emprestimo e)
    {
        var restante = e.ValorTotal - e.ValorPago;
        var percentual = e.ValorTotal > 0 ? Math.Round(e.ValorPago / e.ValorTotal * 100, 1) : 0;
        var vencido = !e.Quitado && e.DataVencimento.HasValue && e.DataVencimento.Value.Date < DateTime.UtcNow.Date;

        return new EmprestimoDto
        {
            Id = e.Id,
            Descricao = e.Descricao,
            Pessoa = e.Pessoa,
            ValorTotal = e.ValorTotal,
            ValorPago = e.ValorPago,
            ValorRestante = restante,
            PercentualPago = percentual,
            Tipo = (int)e.Tipo,
            TipoDescricao = e.Tipo == TipoEmprestimo.Emprestei ? "Emprestei" : "Peguei emprestado",
            DataInicio = e.DataInicio,
            DataVencimento = e.DataVencimento,
            Quitado = e.Quitado,
            Vencido = vencido,
            Observacao = e.Observacao,
        };
    }
}
