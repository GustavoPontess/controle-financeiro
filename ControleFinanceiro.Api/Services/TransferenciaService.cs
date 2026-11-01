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

    public const string OperacaoCriarTransferencia = "CriarTransferencia";

    // idempotencyKey (opcional): com chave, repetir o pedido devolve a transferência original em vez de mover o
    // dinheiro de novo; a mesma chave com outros dados → 409.
    public async Task<TransferenciaDto> CriarAsync(CriarTransferenciaDto dto, Guid usuarioId, string? idempotencyKey = null)
    {
        Idempotencia.ExigirTamanho(idempotencyKey);
        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            var anterior = await BuscarCriacaoPorChaveAsync(usuarioId, idempotencyKey, dto);
            if (anterior != null)
                return anterior;
        }

        var (contaOrigem, contaDestino, descricao) = await ConferirAsync(dto, usuarioId);

        var transacaoSaida = new Transacao
        {
            Id = Guid.NewGuid(),
            Descricao = descricao,
            Valor = dto.Valor,
            Tipo = TipoTransacao.Despesa,
            ContaId = dto.ContaOrigemId,
            CriadoPor = usuarioId,
            Data = dto.Data,
            Hora = dto.Hora,
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
            Hora = dto.Hora,
            CategoriaId = null,
            EhTransferencia = true
        };

        var transferencia = new Transferencia
        {
            Id = Guid.NewGuid(),
            ContaOrigemId = dto.ContaOrigemId,
            ContaDestinoId = dto.ContaDestinoId,
            Valor = dto.Valor,
            // Dia + hora de relógio (sem hora = meia-noite), como a lista de transferências sempre leu.
            Data = dto.Data.ToDateTime(dto.Hora ?? TimeOnly.MinValue),
            Descricao = descricao,
            CriadoPor = usuarioId,
            TransacaoOrigemId = transacaoSaida.Id,
            TransacaoDestinoId = transacaoEntrada.Id
        };

        _context.Transacoes.Add(transacaoSaida);
        _context.Transacoes.Add(transacaoEntrada);
        _context.Transferencias.Add(transferencia);
        // Chave no MESMO SaveChanges das pernas: a 2ª requisição concorrente estoura o índice e vira replay.
        if (!string.IsNullOrWhiteSpace(idempotencyKey))
            _context.RegistrosIdempotencia.Add(Idempotencia.Novo(usuarioId, OperacaoCriarTransferencia, idempotencyKey, transferencia.Id));
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (!string.IsNullOrWhiteSpace(idempotencyKey) && Idempotencia.EhViolacaoDeUnicidade(ex))
        {
            _context.ChangeTracker.Clear();
            var vencedora = await BuscarCriacaoPorChaveAsync(usuarioId, idempotencyKey!, dto);
            if (vencedora != null)
                return vencedora;
            throw;
        }

        return MapToDto(transferencia, contaOrigem.Nome, contaDestino.Nome);
    }

    // Regra do formulário (2026-10-31): criar e editar conferem a MESMA coisa, num lugar só. Devolve as contas e a
    // descrição (vazia vira "Transferência: A → B").
    private async Task<(Conta Origem, Conta Destino, string Descricao)> ConferirAsync(CriarTransferenciaDto dto, Guid usuarioId)
    {
        if (dto.ContaOrigemId == dto.ContaDestinoId)
            throw new ArgumentException("Conta de origem e destino não podem ser iguais.");

        if (dto.Valor <= 0)
            throw new ArgumentException("O valor da transferência deve ser positivo.");

        // As duas pernas nascem efetivadas (entram no saldo na hora): transferência futura moveria um
        // dinheiro que ainda não saiu. O front já barrava; o back não — mesma regra do lançamento em conta.
        if (dto.Data > HorarioBrasil.Hoje())
            throw new ArgumentException("A data da transferência não pode ser futura.");

        var contaOrigem = await _context.Contas
            .FirstOrDefaultAsync(c => c.Id == dto.ContaOrigemId && c.UsuarioIdProprietario == usuarioId);
        if (contaOrigem == null)
            throw new KeyNotFoundException("Conta de origem não encontrada.");

        var contaDestino = await _context.Contas
            .FirstOrDefaultAsync(c => c.Id == dto.ContaDestinoId && c.UsuarioIdProprietario == usuarioId);
        if (contaDestino == null)
            throw new KeyNotFoundException("Conta de destino não encontrada.");
        // Conta encerrada não recebe nem manda dinheiro novo (reabra antes).
        if (contaOrigem.EncerradaEm != null)
            throw new InvalidOperationException(DonoRecursos.MensagemContaEncerrada(contaOrigem.Nome));
        if (contaDestino.EncerradaEm != null)
            throw new InvalidOperationException(DonoRecursos.MensagemContaEncerrada(contaDestino.Nome));

        var descricao = string.IsNullOrWhiteSpace(dto.Descricao)
            ? $"Transferência: {contaOrigem.Nome} → {contaDestino.Nome}"
            : dto.Descricao;
        return (contaOrigem, contaDestino, descricao);
    }

    /// <summary>
    /// Edita a transferência inteira (contas, valor, data, hora, descrição) com a mesma conferência de criar. As DUAS
    /// pernas mudam juntas, no mesmo SaveChanges: tudo ou nada. Caixinha de meta fica de fora pela trava do
    /// AppDbContext (409): guardar e resgatar só por Metas.
    /// </summary>
    public async Task<TransferenciaDto> EditarAsync(Guid id, CriarTransferenciaDto dto, Guid usuarioId)
    {
        var transferencia = await _context.Transferencias.FirstOrDefaultAsync(t => t.Id == id && t.CriadoPor == usuarioId)
            ?? throw new KeyNotFoundException("Transferência não encontrada.");
        var (contaOrigem, contaDestino, descricao) = await ConferirAsync(dto, usuarioId);

        var pernas = await _context.Transacoes
            .Where(t => t.Id == transferencia.TransacaoOrigemId || t.Id == transferencia.TransacaoDestinoId)
            .ToListAsync();
        foreach (var perna in pernas)
        {
            perna.ContaId = perna.Id == transferencia.TransacaoOrigemId ? dto.ContaOrigemId : dto.ContaDestinoId;
            perna.Valor = dto.Valor;
            perna.Data = dto.Data;
            perna.Hora = dto.Hora;
            perna.Descricao = descricao;
        }

        transferencia.ContaOrigemId = dto.ContaOrigemId;
        transferencia.ContaDestinoId = dto.ContaDestinoId;
        transferencia.Valor = dto.Valor;
        transferencia.Data = dto.Data.ToDateTime(dto.Hora ?? TimeOnly.MinValue);
        transferencia.Descricao = descricao;
        await _context.SaveChangesAsync();

        return MapToDto(transferencia, contaOrigem.Nome, contaDestino.Nome);
    }

    /// <summary>A transferência de que esta transação é uma perna (origem ou destino). 404 se não for, ou de outra pessoa.</summary>
    public async Task<TransferenciaDto> ObterPelaPernaAsync(Guid transacaoId, Guid usuarioId)
    {
        var t = await _context.Transferencias.AsNoTracking()
            .Include(x => x.ContaOrigem)
            .Include(x => x.ContaDestino)
            .FirstOrDefaultAsync(x => (x.TransacaoOrigemId == transacaoId || x.TransacaoDestinoId == transacaoId) && x.CriadoPor == usuarioId)
            ?? throw new KeyNotFoundException("Transferência não encontrada.");
        var dto = MapToDto(t, t.ContaOrigem?.Nome ?? "", t.ContaDestino?.Nome ?? "");
        dto.ComCaixinha = t.ContaOrigem?.Tipo == TipoConta.Caixinha || t.ContaDestino?.Tipo == TipoConta.Caixinha;
        return dto;
    }

    /// <summary>Transferência já criada com esta chave (replay) ou null. 409 se excluída depois ou com outros dados.</summary>
    private async Task<TransferenciaDto?> BuscarCriacaoPorChaveAsync(Guid usuarioId, string chave, CriarTransferenciaDto dto)
    {
        var registro = await Idempotencia.BuscarAsync(_context, usuarioId, OperacaoCriarTransferencia, chave);
        if (registro == null)
            return null;
        var original = await _context.Transferencias.AsNoTracking()
            .Include(t => t.ContaOrigem)
            .Include(t => t.ContaDestino)
            .FirstOrDefaultAsync(t => t.Id == registro.ReferenciaId && t.CriadoPor == usuarioId)
            ?? throw new InvalidOperationException(Idempotencia.MensagemChaveConsumida);
        if (original.Valor != dto.Valor || DateOnly.FromDateTime(original.Data) != dto.Data
            || original.ContaOrigemId != dto.ContaOrigemId || original.ContaDestinoId != dto.ContaDestinoId)
            throw new InvalidOperationException(Idempotencia.MensagemChaveComOutrosDados);
        return MapToDto(original, original.ContaOrigem?.Nome ?? "", original.ContaDestino?.Nome ?? "");
    }

    /// <summary>
    /// KPIs agregados — total movimentado e quantidade no filtro de data opcional.
    /// Calculado no banco, exato pra qualquer volume.
    /// </summary>
    public async Task<TransferenciaStatsDto> ObterStatsAsync(
        Guid usuarioId,
        DateTime? from = null,
        DateTime? to = null)
    {
        var query = _context.Transferencias.Where(t => t.CriadoPor == usuarioId);
        if (from.HasValue) query = query.Where(t => t.Data >= from.Value);
        if (to.HasValue) query = query.Where(t => t.Data < to.Value);

        var total = await query.SumAsync(t => (decimal?)t.Valor) ?? 0m;
        var qtd = await query.CountAsync();

        return new TransferenciaStatsDto
        {
            TotalMovimentado = total,
            QtdTotal = qtd,
        };
    }

    public async Task<PagedResult<TransferenciaDto>> ListarAsync(
        Guid usuarioId, int page = 1, int pageSize = 25, string? busca = null,
        decimal? valorMin = null, decimal? valorMax = null, DateTime? from = null, DateTime? to = null)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var filtrada = _context.Transferencias.Where(t => t.CriadoPor == usuarioId);

        // Busca SERVER-SIDE (a lista é paginada: filtrar só a página carregada no front esconderia
        // o resto). ToLower().Contains() é portável (InMemory nos testes + lower()/LIKE no Postgres);
        // termo limitado pra não virar vetor de custo; EF parametriza (sem SQL injection).
        if (!string.IsNullOrWhiteSpace(busca))
        {
            var termo = busca.Trim().ToLower();
            if (termo.Length > 100) termo = termo[..100];
            filtrada = filtrada.Where(t =>
                t.Descricao.ToLower().Contains(termo)
                || (t.ContaOrigem != null && t.ContaOrigem.Nome.ToLower().Contains(termo))
                || (t.ContaDestino != null && t.ContaDestino.Nome.ToLower().Contains(termo)));
        }

        // Filtros avançados SERVER-SIDE (conforme o dado da tela): faixa de valor e período.
        if (valorMin.HasValue) filtrada = filtrada.Where(t => t.Valor >= valorMin.Value);
        if (valorMax.HasValue) filtrada = filtrada.Where(t => t.Valor <= valorMax.Value);
        if (from.HasValue) filtrada = filtrada.Where(t => t.Data >= from.Value);
        if (to.HasValue) filtrada = filtrada.Where(t => t.Data < to.Value.AddDays(1)); // 'até' inclusivo no dia

        var query = filtrada
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
            throw new KeyNotFoundException("Transferência não encontrada.");

        await CancelarComAsPernasAsync(_context, transferencia);
        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// Exclui a transferência E as DUAS pernas juntas (soft delete — preserva auditoria). Lugar único: a tela de
    /// Transações também chega aqui (`TransacaoService.DeletarAsync` numa perna) — antes ela cancelava só a perna
    /// clicada e o dinheiro sumia (ou aparecia) numa das contas. Não salva.
    /// </summary>
    public static async Task CancelarComAsPernasAsync(AppDbContext context, Transferencia transferencia)
    {
        var transacoes = await context.Transacoes
            .Where(t => t.Id == transferencia.TransacaoOrigemId || t.Id == transferencia.TransacaoDestinoId)
            .ToListAsync();
        foreach (var t in transacoes)
        {
            t.Ativo = false;
            t.StatusTransacao = StatusTransacao.Cancelado;
            t.CanceladoEm = DateTime.UtcNow;
            t.MotivoCancelamento = "Transferência excluída";
        }
        context.Transferencias.Remove(transferencia);
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
