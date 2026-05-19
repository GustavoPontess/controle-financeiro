using Microsoft.EntityFrameworkCore;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.CartaoCredito;
using ControleFinanceiro.Api.Infrastructure;

namespace ControleFinanceiro.Api.Services;

public class CartaoCreditoService(AppDbContext context)
{
    private readonly AppDbContext _context = context;

    public async Task<List<CartaoCreditoDto>> ListarAsync(Guid usuarioId)
    {
        var cartoes = await _context.CartoesCredito
            .Where(c => c.CriadoPor == usuarioId)
            .Include(c => c.Conta)
            .Include(c => c.Banco)
            .Include(c => c.Transacoes)
            .Include(c => c.Faturas)
            .OrderBy(c => c.Nome)
            .ToListAsync();

        return cartoes.Select(ToDto).ToList();
    }

    public async Task<CartaoCreditoDto?> BuscarPorIdAsync(Guid id, Guid usuarioId)
    {
        var cartao = await _context.CartoesCredito
            .Where(c => c.Id == id && c.CriadoPor == usuarioId)
            .Include(c => c.Conta)
            .Include(c => c.Banco)
            .Include(c => c.Transacoes)
            .Include(c => c.Faturas)
            .FirstOrDefaultAsync();

        return cartao is null ? null : ToDto(cartao);
    }

    public async Task<CartaoCreditoDto> CriarAsync(CriarCartaoCreditoDto dto, Guid usuarioId)
    {
        if (string.IsNullOrWhiteSpace(dto.Nome))
            throw new Exception("Nome do cartão é obrigatório.");

        if (dto.TemCredito)
        {
            if (!dto.Limite.HasValue || dto.Limite.Value <= 0)
                throw new Exception("Limite do cartão deve ser positivo.");

            if (!dto.DiaFechamento.HasValue || dto.DiaFechamento.Value is < 1 or > 28)
                throw new Exception("Dia de fechamento deve ser entre 1 e 28.");

            if (!dto.DiaVencimento.HasValue || dto.DiaVencimento.Value is < 1 or > 28)
                throw new Exception("Dia de vencimento deve ser entre 1 e 28.");
        }

        if (!dto.EhPrePago && dto.ContaId.HasValue)
        {
            var conta = await _context.Contas.FirstOrDefaultAsync(c => c.Id == dto.ContaId && c.UsuarioIdProprietario == usuarioId);
            if (conta is null) throw new Exception("Conta vinculada não encontrada.");
        }

        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(),
            Nome = dto.Nome,
            UltimosDigitos = dto.UltimosDigitos,
            Bandeira = dto.Bandeira,
            TemCredito = dto.TemCredito,
            TemDebito = dto.TemDebito,
            EhPrePago = dto.EhPrePago,
            LimiteTotal = dto.TemCredito ? dto.Limite : null,
            DiaFechamento = dto.TemCredito ? dto.DiaFechamento : null,
            DiaVencimento = dto.TemCredito ? dto.DiaVencimento : null,
            ContaId = dto.EhPrePago ? null : dto.ContaId,
            BancoId = dto.BancoId,
            Ativo = true,
            CriadoPor = usuarioId,
        };

        _context.CartoesCredito.Add(cartao);
        await _context.SaveChangesAsync();

        return await BuscarPorIdAsync(cartao.Id, usuarioId) ?? ToDto(cartao);
    }

    public async Task<bool> AtualizarAsync(Guid id, CriarCartaoCreditoDto dto, Guid usuarioId)
    {
        var cartao = await _context.CartoesCredito.FirstOrDefaultAsync(c => c.Id == id && c.CriadoPor == usuarioId);
        if (cartao is null) return false;

        if (string.IsNullOrWhiteSpace(dto.Nome))
            throw new Exception("Nome do cartão é obrigatório.");

        if (dto.TemCredito)
        {
            if (!dto.Limite.HasValue || dto.Limite.Value <= 0)
                throw new Exception("Limite do cartão deve ser positivo.");

            if (!dto.DiaFechamento.HasValue || dto.DiaFechamento.Value is < 1 or > 28)
                throw new Exception("Dia de fechamento deve ser entre 1 e 28.");

            if (!dto.DiaVencimento.HasValue || dto.DiaVencimento.Value is < 1 or > 28)
                throw new Exception("Dia de vencimento deve ser entre 1 e 28.");
        }

        if (!dto.EhPrePago && dto.ContaId.HasValue && dto.ContaId != cartao.ContaId)
        {
            var conta = await _context.Contas.FirstOrDefaultAsync(c => c.Id == dto.ContaId && c.UsuarioIdProprietario == usuarioId);
            if (conta is null) throw new Exception("Conta vinculada não encontrada.");
        }

        cartao.Nome = dto.Nome;
        cartao.UltimosDigitos = dto.UltimosDigitos;
        cartao.Bandeira = dto.Bandeira;
        cartao.TemCredito = dto.TemCredito;
        cartao.TemDebito = dto.TemDebito;
        cartao.EhPrePago = dto.EhPrePago;
        cartao.LimiteTotal = dto.TemCredito ? dto.Limite : null;
        cartao.DiaFechamento = dto.TemCredito ? dto.DiaFechamento : null;
        cartao.DiaVencimento = dto.TemCredito ? dto.DiaVencimento : null;
        cartao.ContaId = dto.EhPrePago ? null : dto.ContaId;
        cartao.BancoId = dto.BancoId;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeletarAsync(Guid id, Guid usuarioId)
    {
        var cartao = await _context.CartoesCredito.FirstOrDefaultAsync(c => c.Id == id && c.CriadoPor == usuarioId);
        if (cartao is null) return false;

        var transacoes = await _context.Transacoes
            .Where(t => t.CartaoCreditoId == id)
            .ToListAsync();
        _context.Transacoes.RemoveRange(transacoes);

        var faturas = await _context.Faturas
            .Where(f => f.CartaoCreditoId == id)
            .ToListAsync();
        _context.Faturas.RemoveRange(faturas);

        _context.CartoesCredito.Remove(cartao);
        await _context.SaveChangesAsync();
        return true;
    }

    private static (DateTime inicio, DateTime fim) CicloAtual(int? diaFechamento)
    {
        var hoje = DateTime.UtcNow.Date;
        if (!diaFechamento.HasValue)
            return (new DateTime(hoje.Year, hoje.Month, 1), hoje);

        var dia = Math.Min(diaFechamento.Value, DateTime.DaysInMonth(hoje.Year, hoje.Month));
        var fechamentoMesAtual = new DateTime(hoje.Year, hoje.Month, dia);

        if (hoje <= fechamentoMesAtual)
        {
            var prev = fechamentoMesAtual.AddMonths(-1);
            var diaAnterior = Math.Min(diaFechamento.Value, DateTime.DaysInMonth(prev.Year, prev.Month));
            return (new DateTime(prev.Year, prev.Month, diaAnterior).AddDays(1), fechamentoMesAtual);
        }
        return (fechamentoMesAtual.AddDays(1), fechamentoMesAtual.AddMonths(1));
    }

    private static CartaoCreditoDto ToDto(CartaoCredito c)
    {
        var (inicio, fim) = CicloAtual(c.DiaFechamento);

        // Gastos no ciclo = total bruto das transações de crédito no período
        // menos o que já foi pago nas faturas correspondentes.
        // Fatura parcialmente paga libera apenas o valor pago (não a fatura inteira).
        var transacoesNoCiclo = c.TemCredito
            ? c.Transacoes
                .Where(t => t.UsadoComoCredito
                    && t.Tipo == TipoTransacao.Despesa
                    && t.Ativo
                    && t.Data.Date >= inicio
                    && t.Data.Date <= fim)
                .ToList()
            : new();

        var totalBruto = transacoesNoCiclo.Sum(t => t.Valor);

        var faturaIdsNoCiclo = transacoesNoCiclo
            .Where(t => t.FaturaId.HasValue)
            .Select(t => t.FaturaId!.Value)
            .ToHashSet();

        var totalPagoNasFaturas = c.Faturas
            .Where(f => faturaIdsNoCiclo.Contains(f.Id))
            .Sum(f => f.ValorPago);

        var gastos = Math.Max(0m, totalBruto - totalPagoNasFaturas);

        var limiteDisponivel = c.TemCredito && c.LimiteTotal.HasValue ? c.LimiteTotal.Value - gastos : (decimal?)null;

        var bandeiraDesc = c.Bandeira switch
        {
            BandeiraCartao.Visa => "Visa",
            BandeiraCartao.Mastercard => "Mastercard",
            BandeiraCartao.Elo => "Elo",
            BandeiraCartao.Hipercard => "Hipercard",
            BandeiraCartao.AmericanExpress => "American Express",
            _ => "Outros"
        };

        return new CartaoCreditoDto
        {
            Id = c.Id,
            Nome = c.Nome,
            UltimosDigitos = c.UltimosDigitos,
            Bandeira = (int)c.Bandeira,
            BandeiraDescricao = bandeiraDesc,
            TemCredito = c.TemCredito,
            TemDebito = c.TemDebito,
            EhPrePago = c.EhPrePago,
            Limite = c.TemCredito ? c.LimiteTotal : null,
            LimiteDisponivel = limiteDisponivel,
            GastosNoCicloAtual = gastos,
            DiaFechamento = c.DiaFechamento,
            DiaVencimento = c.DiaVencimento,
            ContaId = c.ContaId,
            ContaNome = c.Conta?.Nome,
            BancoId = c.BancoId,
            BancoNome = c.Banco?.Nome,
            Ativo = c.Ativo,
        };
    }
}
