using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.DTOs.Meta;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Metas no modelo de RESERVA (Monarch; decisão do Gustavo em 2026-10-19): guardar numa meta reserva parte do
/// saldo de uma conta, sem mover dinheiro nem criar lançamento. Progresso = Σ reservas. Livre de uma conta =
/// saldo real (<see cref="RegrasFinanceiras"/>) − Σ reservas dela; não dá pra reservar mais que o livre.
/// Guardar e tirar exigem Idempotency-Key (<see cref="Idempotencia"/>): duplo clique não reserva duas vezes.
/// </summary>
public class MetaService
{
    public const string OperacaoGuardar = "MetaGuardar";
    public const string OperacaoTirar = "MetaTirar";

    private readonly AppDbContext _context;

    public MetaService(AppDbContext context)
    {
        _context = context;
    }

    // ── Criar / editar / excluir ─────────────────────────────────────────────

    /// <summary>Cria uma meta pessoal (ou de família, se <c>FamiliaId</c>).</summary>
    public async Task<MetaDto> CriarAsync(CriarMetaDto dto, Guid usuarioId)
    {
        if (dto.FamiliaId.HasValue)
            await ExigirMembroAsync(dto.FamiliaId.Value, usuarioId);
        if (dto.CategoriaId.HasValue)
            await DonoRecursos.ExigirCategoriaAsync(_context, dto.CategoriaId.Value, usuarioId);
        var nome = ValidarNome(dto.Nome);
        var prazo = NormalizarPrazo(dto.DataLimite, permitirPassado: false);

        var meta = new Meta
        {
            Id = Guid.NewGuid(),
            Nome = nome,
            Descricao = string.IsNullOrWhiteSpace(dto.Descricao) ? null : dto.Descricao.Trim(),
            ValorAlvo = dto.ValorAlvo,
            DataLimite = prazo,
            UsuarioId = usuarioId,
            FamiliaId = dto.FamiliaId,
            CategoriaId = dto.CategoriaId,
        };
        _context.Metas.Add(meta);
        await _context.SaveChangesAsync();
        return Montar(meta, [], DateTime.UtcNow);
    }

    /// <summary>Edita nome, alvo e prazo (só quem criou). Prazo já passado continua valendo se não mudou.</summary>
    public async Task<MetaDto> AtualizarAsync(Guid metaId, CriarMetaDto dto, Guid usuarioId)
    {
        var meta = await BuscarPropriaAsync(metaId, usuarioId);
        if (dto.CategoriaId.HasValue)
            await DonoRecursos.ExigirCategoriaAsync(_context, dto.CategoriaId.Value, usuarioId);
        var prazo = NormalizarPrazo(dto.DataLimite, permitirPassado: true);
        if (prazo.HasValue && prazo != meta.DataLimite && prazo.Value < InicioDoMes(DateTime.UtcNow))
            throw new ArgumentException("O prazo não pode ser num mês que já passou.");

        meta.Nome = ValidarNome(dto.Nome);
        meta.Descricao = string.IsNullOrWhiteSpace(dto.Descricao) ? null : dto.Descricao.Trim();
        meta.ValorAlvo = dto.ValorAlvo;
        meta.DataLimite = prazo;
        meta.CategoriaId = dto.CategoriaId;
        meta.AtualizadoEm = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return await ObterAsync(metaId, usuarioId);
    }

    /// <summary>Exclui (soft delete) e solta as reservas: o dinheiro volta a ficar livre nas contas.</summary>
    public async Task ExcluirAsync(Guid metaId, Guid usuarioId)
    {
        var meta = await BuscarPropriaAsync(metaId, usuarioId);
        _context.MetasReservas.RemoveRange(await _context.MetasReservas.Where(r => r.MetaId == metaId).ToListAsync());
        meta.Ativo = false;
        meta.AtualizadoEm = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }

    // ── Ler ──────────────────────────────────────────────────────────────────

    /// <summary>Metas ativas: as pessoais da pessoa e as das famílias dela; <paramref name="soPessoais"/> tira as de família.</summary>
    public async Task<List<MetaDto>> ListarAsync(Guid usuarioId, bool soPessoais = false, DateTime? agora = null)
    {
        var familiaIds = soPessoais ? [] : await _context.MembrosFamilia
            .Where(m => m.UsuarioId == usuarioId && m.Ativo)
            .Select(m => m.FamiliaId)
            .ToListAsync();

        var metas = await _context.Metas
            .Where(m => m.Ativo && (soPessoais
                ? m.UsuarioId == usuarioId && m.FamiliaId == null
                : m.UsuarioId == usuarioId || (m.FamiliaId != null && familiaIds.Contains(m.FamiliaId.Value))))
            .OrderBy(m => m.CriadoEm)
            .ToListAsync();
        var reservas = await ReservasDasMetasAsync(metas.Select(m => m.Id));
        var hoje = agora ?? DateTime.UtcNow;
        return metas.Select(m => Montar(m, reservas.GetValueOrDefault(m.Id, []), hoje)).ToList();
    }

    public async Task<MetaDto> ObterAsync(Guid metaId, Guid usuarioId, DateTime? agora = null)
    {
        var meta = await BuscarComAcessoAsync(metaId, usuarioId);
        var reservas = await ReservasDasMetasAsync([meta.Id]);
        return Montar(meta, reservas.GetValueOrDefault(meta.Id, []), agora ?? DateTime.UtcNow);
    }

    /// <summary>Contas abertas da pessoa: saldo, quanto já está reservado em metas e quanto sobra livre.</summary>
    public async Task<List<ContaLivreDto>> ContasLivresAsync(Guid usuarioId)
    {
        var contas = await _context.Contas.AsNoTracking()
            .Where(c => c.UsuarioIdProprietario == usuarioId && c.EncerradaEm == null)
            .OrderByDescending(c => c.IsCarteira).ThenBy(c => c.Nome)
            .Select(c => new { c.Id, c.Nome, Banco = c.Banco != null ? c.Banco.Nome : null, Cor = c.Banco != null ? c.Banco.Cor : null })
            .ToListAsync();
        var ids = contas.Select(c => c.Id).ToList();
        var saldos = await RegrasFinanceiras.SaldosDasContasAsync(_context, ids, usuarioId);
        var reservado = await ReservadoPorContaAsync(ids);
        return contas.Select(c =>
        {
            var saldo = saldos[c.Id].Saldo;
            var res = reservado.GetValueOrDefault(c.Id);
            return new ContaLivreDto(c.Id, c.Nome, c.Banco, c.Cor, saldo, res, saldo - res);
        }).ToList();
    }

    /// <summary>Σ reservas por conta (meta ativa), pra Bancos e pro "livre".</summary>
    public async Task<Dictionary<Guid, decimal>> ReservadoPorContaAsync(IEnumerable<Guid> contaIds)
    {
        var ids = contaIds.ToList();
        return await _context.MetasReservas
            .Where(r => ids.Contains(r.ContaId) && r.Meta!.Ativo)
            .GroupBy(r => r.ContaId)
            .Select(g => new { g.Key, Total = g.Sum(r => r.Valor) })
            .ToDictionaryAsync(x => x.Key, x => x.Total);
    }

    // ── Guardar / tirar ──────────────────────────────────────────────────────

    /// <summary>Reserva <c>Valor</c> da conta pra meta. Não passa do livre da conta (saldo − já reservado).</summary>
    public async Task<MetaDto> GuardarAsync(Guid metaId, MovimentoMetaDto dto, Guid usuarioId, string? idempotencyKey)
    {
        var chave = ExigirChave(idempotencyKey);
        var meta = await BuscarComAcessoAsync(metaId, usuarioId);
        if (await JaFeitoAsync(usuarioId, OperacaoGuardar, chave, metaId))
            return await ObterAsync(metaId, usuarioId);

        await DonoRecursos.ExigirContaAbertaAsync(_context, dto.ContaId, usuarioId);
        var saldo = (await RegrasFinanceiras.SaldoDaContaAsync(_context, dto.ContaId, usuarioId)).Saldo;
        var reservado = (await ReservadoPorContaAsync([dto.ContaId])).GetValueOrDefault(dto.ContaId);
        var livre = saldo - reservado;
        if (dto.Valor > livre)
            throw new InvalidOperationException(livre > 0
                ? $"Só tem {livre:C} livre nessa conta."
                : "Essa conta não tem dinheiro livre: o saldo já está todo reservado em metas.");

        var reserva = await _context.MetasReservas.FirstOrDefaultAsync(r => r.MetaId == metaId && r.ContaId == dto.ContaId);
        if (reserva is null)
            _context.MetasReservas.Add(new MetaReserva
            {
                Id = Guid.NewGuid(), MetaId = metaId, ContaId = dto.ContaId, UsuarioId = usuarioId, Valor = dto.Valor,
            });
        else
        {
            reserva.Valor += dto.Valor;
            reserva.AtualizadoEm = DateTime.UtcNow;
        }
        meta.AtualizadoEm = DateTime.UtcNow;
        await SalvarComChaveAsync(usuarioId, OperacaoGuardar, chave, metaId);
        return await ObterAsync(metaId, usuarioId);
    }

    /// <summary>Solta <c>Valor</c> da reserva dessa conta (o dinheiro volta a ficar livre). Não passa do reservado.</summary>
    public async Task<MetaDto> TirarAsync(Guid metaId, MovimentoMetaDto dto, Guid usuarioId, string? idempotencyKey)
    {
        var chave = ExigirChave(idempotencyKey);
        var meta = await BuscarComAcessoAsync(metaId, usuarioId);
        if (await JaFeitoAsync(usuarioId, OperacaoTirar, chave, metaId))
            return await ObterAsync(metaId, usuarioId);

        await DonoRecursos.ExigirContaAsync(_context, dto.ContaId, usuarioId);
        var reserva = await _context.MetasReservas.FirstOrDefaultAsync(r => r.MetaId == metaId && r.ContaId == dto.ContaId)
            ?? throw new InvalidOperationException("Essa meta não tem dinheiro guardado nessa conta.");
        if (dto.Valor > reserva.Valor)
            throw new InvalidOperationException($"Nessa conta a meta só tem {reserva.Valor:C} guardado.");

        reserva.Valor -= dto.Valor;
        reserva.AtualizadoEm = DateTime.UtcNow;
        if (reserva.Valor == 0m)
            _context.MetasReservas.Remove(reserva);
        meta.AtualizadoEm = DateTime.UtcNow;
        await SalvarComChaveAsync(usuarioId, OperacaoTirar, chave, metaId);
        return await ObterAsync(metaId, usuarioId);
    }

    // ── Cálculo (estático: testável sem banco) ──────────────────────────────

    /// <summary>Meses até o prazo contando o mês atual (set/2026 → dez/2027 = 16). Null sem prazo.</summary>
    public static int? MesesAte(DateTime? prazo, DateTime hoje) =>
        prazo is null ? null : (prazo.Value.Year - hoje.Year) * 12 + (prazo.Value.Month - hoje.Month) + 1;

    public static (string Situacao, int? Meses, decimal? PorMes) Situacao(decimal alvo, decimal guardado, DateTime? prazo, DateTime criadaEm, DateTime hoje)
    {
        if (guardado >= alvo) return ("concluida", null, null);
        if (prazo is null) return ("sem-prazo", null, null);
        var meses = MesesAte(prazo, hoje)!.Value;
        if (meses < 1) return ("prazo-passou", 0, null);
        var porMes = Math.Ceiling((alvo - guardado) / meses * 100m) / 100m;
        // No ritmo = já guardou pelo menos o que guardaria se fosse igual todo mês desde que criou.
        var total = Math.Max(1, MesesAte(prazo, criadaEm)!.Value);
        var decorridos = Math.Clamp(total - meses, 0, total);
        var esperado = alvo * decorridos / total;
        return (guardado >= esperado ? "no-ritmo" : "atras", meses, porMes);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static MetaDto Montar(Meta m, List<MetaReservaDto> reservas, DateTime hoje)
    {
        var guardado = reservas.Sum(r => r.Valor);
        var (situacao, meses, porMes) = Situacao(m.ValorAlvo, guardado, m.DataLimite, m.CriadoEm, hoje);
        var pct = m.ValorAlvo > 0 ? Math.Min(100m, Math.Round(guardado * 100m / m.ValorAlvo, 2)) : 0m;
        return new MetaDto(
            m.Id, m.Nome, m.Descricao, m.ValorAlvo, guardado, Math.Max(0m, m.ValorAlvo - guardado), pct,
            guardado >= m.ValorAlvo, m.DataLimite, meses, porMes, situacao, reservas,
            m.UsuarioId, m.FamiliaId, m.CategoriaId, m.Ativo, m.CriadoEm, m.AtualizadoEm);
    }

    private async Task<Dictionary<Guid, List<MetaReservaDto>>> ReservasDasMetasAsync(IEnumerable<Guid> metaIds)
    {
        var ids = metaIds.ToList();
        var linhas = await _context.MetasReservas.AsNoTracking()
            .Where(r => ids.Contains(r.MetaId))
            .OrderByDescending(r => r.Valor)
            .Select(r => new
            {
                r.MetaId,
                Dto = new MetaReservaDto(r.ContaId, r.Conta!.Nome, r.Conta.Banco != null ? r.Conta.Banco.Nome : null,
                    r.Conta.Banco != null ? r.Conta.Banco.Cor : null, r.Valor),
            })
            .ToListAsync();
        return linhas.GroupBy(l => l.MetaId).ToDictionary(g => g.Key, g => g.Select(l => l.Dto).ToList());
    }

    private static string ExigirChave(string? chave)
    {
        if (string.IsNullOrWhiteSpace(chave))
            throw new ArgumentException("O header Idempotency-Key é obrigatório.");
        Idempotencia.ExigirTamanho(chave);
        return chave;
    }

    /// <summary>Replay: a chave já foi usada nessa meta → não aplica de novo; noutra meta → 409.</summary>
    private async Task<bool> JaFeitoAsync(Guid usuarioId, string operacao, string chave, Guid metaId)
    {
        var registro = await Idempotencia.BuscarAsync(_context, usuarioId, operacao, chave);
        if (registro is null) return false;
        if (registro.ReferenciaId != metaId)
            throw new InvalidOperationException(Idempotencia.MensagemChaveComOutrosDados);
        return true;
    }

    /// <summary>Grava a operação e a chave no MESMO SaveChanges; corrida com a mesma chave vira replay.</summary>
    private async Task SalvarComChaveAsync(Guid usuarioId, string operacao, string chave, Guid metaId)
    {
        _context.RegistrosIdempotencia.Add(Idempotencia.Novo(usuarioId, operacao, chave, metaId));
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (Idempotencia.EhViolacaoDeUnicidade(ex))
        {
            foreach (var entry in _context.ChangeTracker.Entries().ToList())
                entry.State = EntityState.Detached;
        }
    }

    private static string ValidarNome(string nome)
    {
        nome = (nome ?? string.Empty).Trim();
        if (nome.Length == 0) throw new ArgumentException("Dê um nome pra meta.");
        if (nome.Length > 120) throw new ArgumentException("O nome pode ter no máximo 120 caracteres.");
        return nome;
    }

    private static DateTime InicioDoMes(DateTime d) => new(d.Year, d.Month, 1);

    /// <summary>Prazo é um MÊS: guarda o dia 1 dele. Não aceita mês que já passou (na criação).</summary>
    private static DateTime? NormalizarPrazo(DateTime? prazo, bool permitirPassado)
    {
        if (prazo is null) return null;
        var mes = InicioDoMes(prazo.Value);
        if (!permitirPassado && mes < InicioDoMes(DateTime.UtcNow))
            throw new ArgumentException("O prazo não pode ser num mês que já passou.");
        if (mes.Year > DateTime.UtcNow.Year + 60)
            throw new ArgumentException("Prazo longe demais.");
        return mes;
    }

    private async Task<Meta> BuscarPropriaAsync(Guid metaId, Guid usuarioId)
    {
        var meta = await _context.Metas.FirstOrDefaultAsync(m => m.Id == metaId && m.Ativo)
            ?? throw new KeyNotFoundException("Meta não encontrada.");
        if (meta.UsuarioId != usuarioId)
            throw new ForbiddenAccessException("Você não tem permissão para editar esta meta.");
        return meta;
    }

    private async Task<Meta> BuscarComAcessoAsync(Guid metaId, Guid usuarioId)
    {
        var meta = await _context.Metas.FirstOrDefaultAsync(m => m.Id == metaId && m.Ativo)
            ?? throw new KeyNotFoundException("Meta não encontrada.");
        if (meta.UsuarioId == usuarioId)
            return meta;
        if (meta.FamiliaId.HasValue && await _context.MembrosFamilia
                .AnyAsync(m => m.FamiliaId == meta.FamiliaId && m.UsuarioId == usuarioId && m.Ativo))
            return meta;
        throw new KeyNotFoundException("Meta não encontrada.");
    }

    private async Task ExigirMembroAsync(Guid familiaId, Guid usuarioId)
    {
        if (!await _context.MembrosFamilia.AnyAsync(m => m.FamiliaId == familiaId && m.UsuarioId == usuarioId && m.Ativo))
            throw new KeyNotFoundException("Família não encontrada ou sem permissão.");
    }
}
