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

        var efeitos = new Dictionary<Guid, decimal>();
        Somar(efeitos, dto.ContaOrigemId, -dto.Valor);
        Somar(efeitos, dto.ContaDestinoId, dto.Valor);
        await RegistrarNoLogAsync(_context, FinancialEventType.TransferenciaCriada, usuarioId, transferencia.Id, efeitos,
            Dados(transferencia));

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

        // Desfaz o efeito antigo e aplica o novo, por conta: com as contas trocadas, entram até 4 contas no log.
        var antes = Dados(transferencia);
        var efeitos = new Dictionary<Guid, decimal>();
        Somar(efeitos, transferencia.ContaOrigemId, transferencia.Valor);
        Somar(efeitos, transferencia.ContaDestinoId, -transferencia.Valor);
        Somar(efeitos, dto.ContaOrigemId, -dto.Valor);
        Somar(efeitos, dto.ContaDestinoId, dto.Valor);

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
        await RegistrarNoLogAsync(_context, FinancialEventType.TransferenciaEditada, usuarioId, transferencia.Id, efeitos,
            new { antes, depois = Dados(transferencia) });
        await _context.SaveChangesAsync();

        return MapToDto(transferencia, contaOrigem.Nome, contaDestino.Nome);
    }

    /// <summary>
    /// Junta duas pernas que já existem (a do extrato importado e a que já estava na outra conta) numa transferência:
    /// as duas passam a ser transferência, sem categoria, fora do resultado. Não move dinheiro (as duas já estavam no
    /// saldo): o log registra o vínculo com o saldo igual antes e depois. Salva.
    /// </summary>
    public static async Task JuntarPernasAsync(AppDbContext context, Guid usuarioId, Guid pernaNovaId, Guid pernaExistenteId, string descricao)
    {
        var pernas = await context.Transacoes.Where(t => t.Id == pernaNovaId || t.Id == pernaExistenteId).ToListAsync();
        var saida = pernas.Single(t => t.Tipo == TipoTransacao.Despesa);
        var entrada = pernas.Single(t => t.Tipo == TipoTransacao.Receita);
        foreach (var perna in pernas)
        {
            perna.EhTransferencia = true;
            perna.CategoriaId = null;
            perna.SubcategoriaId = null;
        }
        var transferencia = new Transferencia
        {
            Id = Guid.NewGuid(),
            ContaOrigemId = saida.ContaId!.Value,
            ContaDestinoId = entrada.ContaId!.Value,
            Valor = saida.Valor,
            Data = saida.Data.ToDateTime(saida.Hora ?? TimeOnly.MinValue),
            Descricao = descricao,
            CriadoPor = usuarioId,
            TransacaoOrigemId = saida.Id,
            TransacaoDestinoId = entrada.Id,
        };
        context.Transferencias.Add(transferencia);
        await RegistrarNoLogAsync(context, FinancialEventType.TransferenciaCriada, usuarioId, transferencia.Id,
            new Dictionary<Guid, decimal> { [saida.ContaId!.Value] = 0m, [entrada.ContaId!.Value] = 0m }, Dados(transferencia));
        await context.SaveChangesAsync();
    }

    public const string OperacaoLancamentoViraTransferencia = "LancamentoViraTransferencia";

    /// <summary>
    /// "Isso foi entre minhas contas": um lançamento que já está na conta (veio do extrato como receita ou despesa) vira
    /// uma perna de transferência com <paramref name="outraContaId"/>. A outra perna é a que já estiver lá (mesmo valor,
    /// sinal oposto, até <see cref="ImportacaoService.DiasDoPar"/> dias, solta) ou nasce agora com a mesma data e hora.
    /// O lançamento perde a categoria e sai do resultado; o saldo dele não muda, só o da outra conta quando a perna
    /// nasce. Tudo num SaveChanges, com Idempotency-Key.
    /// </summary>
    public async Task<TransferenciaDto> DeLancamentoAsync(Guid transacaoId, Guid outraContaId, Guid usuarioId, string? idempotencyKey)
    {
        Idempotencia.ExigirTamanho(idempotencyKey);
        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            var registro = await Idempotencia.BuscarAsync(_context, usuarioId, OperacaoLancamentoViraTransferencia, idempotencyKey);
            if (registro != null)
            {
                var original = await _context.Transferencias.AsNoTracking().Include(t => t.ContaOrigem).Include(t => t.ContaDestino)
                    .FirstOrDefaultAsync(t => t.Id == registro.ReferenciaId && t.CriadoPor == usuarioId)
                    ?? throw new InvalidOperationException(Idempotencia.MensagemChaveConsumida);
                if ((original.TransacaoOrigemId != transacaoId && original.TransacaoDestinoId != transacaoId)
                    || (original.ContaOrigemId != outraContaId && original.ContaDestinoId != outraContaId))
                    throw new InvalidOperationException(Idempotencia.MensagemChaveComOutrosDados);
                return MapToDto(original, original.ContaOrigem?.Nome ?? "", original.ContaDestino?.Nome ?? "");
            }
        }

        // Só o lançamento da PRÓPRIA pessoa, numa conta dela (cartão não: compra no cartão não é transferência).
        var lancamento = await _context.Transacoes.Include(t => t.Conta)
            .FirstOrDefaultAsync(t => t.Id == transacaoId && t.Ativo && t.ContaId != null && t.Conta!.UsuarioIdProprietario == usuarioId)
            ?? throw new KeyNotFoundException("Lançamento não encontrado.");
        if (lancamento.StatusTransacao != StatusTransacao.Executado)
            throw new InvalidOperationException("Só um lançamento que já aconteceu vira transferência.");
        if (lancamento.EhTransferencia || lancamento.EhPagamentoFatura || lancamento.EhSaldoInicial || lancamento.EhAjusteReconciliacao
            || lancamento.EhPixNoCredito || lancamento.EhEmprestimo || lancamento.EhAcerto || lancamento.FamiliaId != null
            || lancamento.RecorrenteOrigemId != null || lancamento.ParcelamentoId != null)
            throw new InvalidOperationException("Esse lançamento não pode virar transferência.");
        if (lancamento.ContaId == outraContaId)
            throw new ArgumentException("Escolha outra conta.");

        var conta = lancamento.Conta!;
        var outra = await _context.Contas.FirstOrDefaultAsync(c => c.Id == outraContaId && c.UsuarioIdProprietario == usuarioId)
            ?? throw new KeyNotFoundException("Conta não encontrada.");
        if (outra.Tipo == TipoConta.Caixinha)
            throw new InvalidOperationException(Conta.MensagemCaixinha);
        if (outra.EncerradaEm != null)
            throw new InvalidOperationException(DonoRecursos.MensagemContaEncerrada(outra.Nome));

        var tipoDoPar = lancamento.Tipo == TipoTransacao.Receita ? TipoTransacao.Despesa : TipoTransacao.Receita;
        var de = lancamento.Data.AddDays(-ImportacaoService.DiasDoPar);
        var ate = lancamento.Data.AddDays(ImportacaoService.DiasDoPar);
        var par = (await _context.Transacoes
                .Where(t => t.ContaId == outraContaId && t.Ativo && t.StatusTransacao == StatusTransacao.Executado
                            && t.Tipo == tipoDoPar && t.Valor == lancamento.Valor && t.Data >= de && t.Data <= ate
                            && t.FamiliaId == null && !t.EhPagamentoFatura && !t.EhSaldoInicial && !t.EhAjusteReconciliacao
                            && !t.EhPixNoCredito && !t.EhEmprestimo && !t.EhAcerto
                            && !_context.Transferencias.Any(tr => tr.TransacaoOrigemId == t.Id || tr.TransacaoDestinoId == t.Id))
                .ToListAsync())
            .OrderBy(t => Math.Abs(t.Data.DayNumber - lancamento.Data.DayNumber))
            .FirstOrDefault();

        var efeitos = new Dictionary<Guid, decimal> { [conta.Id] = 0m, [outra.Id] = 0m };
        if (par is null)
        {
            par = new Transacao
            {
                Id = Guid.NewGuid(),
                Valor = lancamento.Valor,
                Tipo = tipoDoPar,
                ContaId = outra.Id,
                CriadoPor = usuarioId,
                Data = lancamento.Data,
                Hora = lancamento.Hora,
                StatusTransacao = StatusTransacao.Executado,
            };
            _context.Transacoes.Add(par);
            efeitos[outra.Id] = tipoDoPar == TipoTransacao.Receita ? lancamento.Valor : -lancamento.Valor;
        }

        var saida = lancamento.Tipo == TipoTransacao.Despesa ? lancamento : par;
        var entrada = lancamento.Tipo == TipoTransacao.Receita ? lancamento : par;
        var nomeOrigem = saida == lancamento ? conta.Nome : outra.Nome;
        var nomeDestino = entrada == lancamento ? conta.Nome : outra.Nome;
        var descricao = $"Transferência: {nomeOrigem} → {nomeDestino}";
        par.Descricao = string.IsNullOrWhiteSpace(par.Descricao) ? descricao : par.Descricao;
        foreach (var perna in new[] { lancamento, par })
        {
            perna.EhTransferencia = true;
            perna.CategoriaId = null;
            perna.SubcategoriaId = null;
        }

        var transferencia = new Transferencia
        {
            Id = Guid.NewGuid(),
            ContaOrigemId = saida.ContaId!.Value,
            ContaDestinoId = entrada.ContaId!.Value,
            Valor = lancamento.Valor,
            Data = lancamento.Data.ToDateTime(lancamento.Hora ?? TimeOnly.MinValue),
            Descricao = descricao,
            CriadoPor = usuarioId,
            TransacaoOrigemId = saida.Id,
            TransacaoDestinoId = entrada.Id,
        };
        _context.Transferencias.Add(transferencia);
        await RegistrarNoLogAsync(_context, FinancialEventType.TransferenciaCriada, usuarioId, transferencia.Id, efeitos, Dados(transferencia));
        if (!string.IsNullOrWhiteSpace(idempotencyKey))
            _context.RegistrosIdempotencia.Add(Idempotencia.Novo(usuarioId, OperacaoLancamentoViraTransferencia, idempotencyKey, transferencia.Id));
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (!string.IsNullOrWhiteSpace(idempotencyKey) && Idempotencia.EhViolacaoDeUnicidade(ex))
        {
            _context.ChangeTracker.Clear();
            return await DeLancamentoAsync(transacaoId, outraContaId, usuarioId, idempotencyKey);
        }
        return MapToDto(transferencia, nomeOrigem, nomeDestino);
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
        var efeitos = new Dictionary<Guid, decimal>();
        Somar(efeitos, transferencia.ContaOrigemId, transferencia.Valor);
        Somar(efeitos, transferencia.ContaDestinoId, -transferencia.Valor);
        await RegistrarNoLogAsync(context, FinancialEventType.TransferenciaExcluida, transferencia.CriadoPor, transferencia.Id,
            efeitos, Dados(transferencia));

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

    // FinancialEventLog (CLAUDE.md: toda operação que afeta saldo; achado 2026-10-31): um evento por conta que a
    // operação mexe, com o saldo antes e depois, gravado no MESMO SaveChanges da mudança (tudo ou nada). O antes é o
    // saldo do banco, lido antes de salvar; o depois é o antes mais o efeito da operação naquela conta. Sem a chave de
    // idempotência no payload (ela mora no RegistroIdempotencia).
    private static async Task RegistrarNoLogAsync(AppDbContext context, FinancialEventType tipo, Guid usuarioId,
        Guid transferenciaId, Dictionary<Guid, decimal> efeitos, object dados)
    {
        var saldos = await RegrasFinanceiras.SaldosDasContasAsync(context, efeitos.Keys, usuarioId);
        var log = new FinancialEventLogService(context);
        var correlacao = Guid.NewGuid();
        foreach (var (contaId, efeito) in efeitos)
        {
            var antes = saldos[contaId].Saldo;
            log.Registrar(usuarioId, tipo, "Conta", contaId, correlacao, "API", antes, antes + efeito,
                new { transferenciaId, efeito, dados });
        }
    }

    private static void Somar(Dictionary<Guid, decimal> efeitos, Guid contaId, decimal valor) =>
        efeitos[contaId] = efeitos.GetValueOrDefault(contaId) + valor;

    private static object Dados(Transferencia t) => new
    {
        contaOrigemId = t.ContaOrigemId,
        contaDestinoId = t.ContaDestinoId,
        valor = t.Valor,
        data = t.Data,
        descricao = t.Descricao,
    };

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
