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
        // Soft-delete: cartões inativos ficam no DB mas somem da listagem.
        var cartoes = await _context.CartoesCredito
            .Where(c => c.CriadoPor == usuarioId && c.Ativo)
            .Include(c => c.Conta)
            .Include(c => c.Banco)
            .OrderBy(c => c.Nome)
            .ToListAsync();

        // Limite usado de todos os cartões de crédito numa leva só (duas consultas agregadas, não uma
        // por cartão nem o histórico de lançamentos em memória) — mesma regra do LimiteCalculator.
        var usados = await RegrasFinanceiras.LimitesUsadosDosCartoesAsync(
            _context, cartoes.Where(c => c.TemCredito).Select(c => c.Id), usuarioId);

        return cartoes.Select(c => ToDto(c, usados.GetValueOrDefault(c.Id))).ToList();
    }

    public async Task<CartaoCreditoDto?> BuscarPorIdAsync(Guid id, Guid usuarioId)
    {
        var cartao = await _context.CartoesCredito
            .Where(c => c.Id == id && c.CriadoPor == usuarioId && c.Ativo)
            .Include(c => c.Conta)
            .Include(c => c.Banco)
            .FirstOrDefaultAsync();
        if (cartao is null) return null;

        var usado = cartao.TemCredito
            ? await RegrasFinanceiras.LimiteUsadoDoCartaoAsync(_context, cartao.Id, usuarioId)
            : 0m;
        return ToDto(cartao, usado);
    }

    public async Task<CartaoCreditoDto> CriarAsync(CriarCartaoCreditoDto dto, Guid usuarioId)
    {
        if (string.IsNullOrWhiteSpace(dto.Nome))
            throw new ArgumentException("Nome do cartão é obrigatório.");

        if (dto.TemCredito)
        {
            if (!dto.Limite.HasValue || dto.Limite.Value <= 0)
                throw new ArgumentException("Limite do cartão deve ser positivo.");

            if (!dto.DiaFechamento.HasValue || dto.DiaFechamento.Value is < 1 or > 28)
                throw new ArgumentException("Dia de fechamento deve ser entre 1 e 28.");

            if (!dto.DiaVencimento.HasValue || dto.DiaVencimento.Value is < 1 or > 28)
                throw new ArgumentException("Dia de vencimento deve ser entre 1 e 28.");
        }

        if (!dto.EhPrePago && dto.ContaId.HasValue)
        {
            var conta = await _context.Contas.FirstOrDefaultAsync(c => c.Id == dto.ContaId && c.UsuarioIdProprietario == usuarioId);
            if (conta is null) throw new KeyNotFoundException("Conta vinculada não encontrada.");
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

        return await BuscarPorIdAsync(cartao.Id, usuarioId) ?? ToDto(cartao, 0m);
    }

    public async Task<bool> AtualizarAsync(Guid id, CriarCartaoCreditoDto dto, Guid usuarioId)
    {
        var cartao = await _context.CartoesCredito.FirstOrDefaultAsync(c => c.Id == id && c.CriadoPor == usuarioId);
        if (cartao is null) return false;

        if (string.IsNullOrWhiteSpace(dto.Nome))
            throw new ArgumentException("Nome do cartão é obrigatório.");

        if (dto.TemCredito)
        {
            if (!dto.Limite.HasValue || dto.Limite.Value <= 0)
                throw new ArgumentException("Limite do cartão deve ser positivo.");

            if (!dto.DiaFechamento.HasValue || dto.DiaFechamento.Value is < 1 or > 28)
                throw new ArgumentException("Dia de fechamento deve ser entre 1 e 28.");

            if (!dto.DiaVencimento.HasValue || dto.DiaVencimento.Value is < 1 or > 28)
                throw new ArgumentException("Dia de vencimento deve ser entre 1 e 28.");
        }

        if (!dto.EhPrePago && dto.ContaId.HasValue && dto.ContaId != cartao.ContaId)
        {
            var conta = await _context.Contas.FirstOrDefaultAsync(c => c.Id == dto.ContaId && c.UsuarioIdProprietario == usuarioId);
            if (conta is null) throw new KeyNotFoundException("Conta vinculada não encontrada.");
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
        var cartao = await _context.CartoesCredito.FirstOrDefaultAsync(c => c.Id == id && c.CriadoPor == usuarioId && c.Ativo);
        if (cartao is null) return false;

        // Soft-delete preserva histórico (auditoria, relatórios pretéritos).
        // - Cartão: Ativo=false → some da listagem mas registros vinculados continuam acessíveis.
        // - Compras feitas no cartão: Ativo=false → somem do extrato/relatório atual.
        // - Pagamentos de fatura: mantêm vínculo (FaturaPagaId) e Ativo=true — saída real de
        //   dinheiro da conta continua refletida no saldo. Fica rastreável pelo cartão histórico.
        // - Faturas: ficam intactas. Acessíveis só via cartão (que está oculto), então somem da UI.
        var compras = await _context.Transacoes
            .Where(t => t.CartaoCreditoId == id && t.Ativo)
            .ToListAsync();
        foreach (var c in compras) c.Ativo = false;

        cartao.Ativo = false;
        await _context.SaveChangesAsync();
        return true;
    }

    /// <summary>
    /// Monta o DTO. <paramref name="limiteUsado"/> vem da regra única de limite
    /// (<see cref="RegrasFinanceiras.LimitesUsadosDosCartoesAsync"/>) — o mesmo número que o
    /// LimiteCalculator usa na trava de compra parcelada e no dashboard. Antes o card calculava à parte
    /// (só compra à vista do ciclo atual, sem parcela, menos o ValorPago inteiro) e mostrava 0% usado
    /// com R$ 1.500 em parcelamentos.
    /// </summary>
    private static CartaoCreditoDto ToDto(CartaoCredito c, decimal limiteUsado)
    {
        var limiteDisponivel = c.TemCredito && c.LimiteTotal.HasValue
            ? RegrasFinanceiras.LimiteDisponivel(c.LimiteTotal.Value, limiteUsado)
            : (decimal?)null;

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
            LimiteUsado = c.TemCredito ? limiteUsado : null,
            DiaFechamento = c.DiaFechamento,
            DiaVencimento = c.DiaVencimento,
            ContaId = c.ContaId,
            ContaNome = c.Conta?.Nome,
            BancoId = c.BancoId,
            BancoNome = c.Banco?.Nome,
            BancoLogoUrl = c.Banco?.LogoUrl,
            BancoCor = c.Banco?.Cor,
            Ativo = c.Ativo,
        };
    }
}
