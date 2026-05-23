using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.DTOs.Transferencia;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

public class TransferenciaService
{
    private readonly AppDbContext _context;

    public TransferenciaService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<TransferenciaDto> CriarAsync(CriarTransferenciaDto dto, Guid usuarioId)
    {
        if (dto.ContaOrigemId == dto.ContaDestinoId)
            throw new Exception("Conta de origem e destino não podem ser iguais.");

        if (dto.Valor <= 0)
            throw new Exception("O valor da transferência deve ser positivo.");

        var contaOrigem = await _context.Contas
            .FirstOrDefaultAsync(c => c.Id == dto.ContaOrigemId && c.UsuarioIdProprietario == usuarioId);
        if (contaOrigem == null)
            throw new Exception("Conta de origem não encontrada.");

        var contaDestino = await _context.Contas
            .FirstOrDefaultAsync(c => c.Id == dto.ContaDestinoId && c.UsuarioIdProprietario == usuarioId);
        if (contaDestino == null)
            throw new Exception("Conta de destino não encontrada.");

        var descricao = string.IsNullOrWhiteSpace(dto.Descricao)
            ? $"Transferência: {contaOrigem.Nome} → {contaDestino.Nome}"
            : dto.Descricao;

        var transacaoSaida = new Transacao
        {
            Id = Guid.NewGuid(),
            Descricao = descricao,
            Valor = dto.Valor,
            Tipo = TipoTransacao.Despesa,
            ContaId = dto.ContaOrigemId,
            CriadoPor = usuarioId,
            Data = dto.Data,
            CategoriaId = null,
            EhTransferencia = true
        };

        var transacaoEntrada = new Transacao
        {
            Id = Guid.NewGuid(),
            Descricao = descricao,
            Valor = dto.Valor,
            Tipo = TipoTransacao.Receita,
            ContaId = dto.ContaDestinoId,
            CriadoPor = usuarioId,
            Data = dto.Data,
            CategoriaId = null,
            EhTransferencia = true
        };

        var transferencia = new Transferencia
        {
            Id = Guid.NewGuid(),
            ContaOrigemId = dto.ContaOrigemId,
            ContaDestinoId = dto.ContaDestinoId,
            Valor = dto.Valor,
            Data = dto.Data,
            Descricao = descricao,
            CriadoPor = usuarioId,
            TransacaoOrigemId = transacaoSaida.Id,
            TransacaoDestinoId = transacaoEntrada.Id
        };

        _context.Transacoes.Add(transacaoSaida);
        _context.Transacoes.Add(transacaoEntrada);
        _context.Transferencias.Add(transferencia);
        await _context.SaveChangesAsync();

        return MapToDto(transferencia, contaOrigem.Nome, contaDestino.Nome);
    }

    public async Task<PagedResult<TransferenciaDto>> ListarAsync(Guid usuarioId, int page = 1, int pageSize = 20)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _context.Transferencias
            .Where(t => t.CriadoPor == usuarioId)
            .Include(t => t.ContaOrigem)
            .Include(t => t.ContaDestino)
            .OrderByDescending(t => t.Data);

        var total = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => MapToDto(t, t.ContaOrigem!.Nome, t.ContaDestino!.Nome))
            .ToListAsync();

        return new PagedResult<TransferenciaDto>
        {
            Items = items,
            Total = total,
            Page = page,
            PageSize = pageSize,
        };
    }

    public async Task DeletarAsync(Guid id, Guid usuarioId)
    {
        var transferencia = await _context.Transferencias
            .FirstOrDefaultAsync(t => t.Id == id && t.CriadoPor == usuarioId);
        if (transferencia == null)
            throw new Exception("Transferência não encontrada.");

        var transacoes = await _context.Transacoes
            .Where(t => t.Id == transferencia.TransacaoOrigemId || t.Id == transferencia.TransacaoDestinoId)
            .ToListAsync();

        // Soft delete das pernas (preserva auditoria) — não remove fisicamente.
        foreach (var t in transacoes)
        {
            t.Ativo = false;
            t.StatusTransacao = StatusTransacao.Cancelado;
            t.CanceladoEm = DateTime.UtcNow;
            t.MotivoCancelamento = "Transferência excluída";
        }
        _context.Transferencias.Remove(transferencia);
        await _context.SaveChangesAsync();
    }

    private static TransferenciaDto MapToDto(Transferencia t, string nomeOrigem, string nomeDestino) => new()
    {
        Id = t.Id,
        ContaOrigemId = t.ContaOrigemId,
        ContaOrigemNome = nomeOrigem,
        ContaDestinoId = t.ContaDestinoId,
        ContaDestinoNome = nomeDestino,
        Valor = t.Valor,
        Data = t.Data,
        Descricao = t.Descricao
    };
}
