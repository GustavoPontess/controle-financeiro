using System.Text.RegularExpressions;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.DTOs.Subcategoria;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Issue #83 — CRUD de subcategorias. Multi-tenant manual: toda query filtra por
/// usuarioId (padrão = UsuarioId null, visível a todos, imutável). De outro usuário ou inexistente → 404.
/// Excluir em uso: os lançamentos e contas fixas vão pra outra subcategoria da MESMA categoria ou ficam
/// só com a categoria (<c>moverPara</c> null) — a tela pergunta antes.
/// </summary>
public partial class SubcategoriaService
{
    public const int NomeMax = 120; // docs/REGRAS_CAMPOS.md
    public const string MensagemNomeRepetido = "Já existe uma subcategoria com esse nome nessa categoria.";

    private readonly AppDbContext _context;

    public SubcategoriaService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<Subcategoria>> ListarAsync(Guid usuarioId, Guid? categoriaId = null)
    {
        var query = _context.Subcategorias
            .Where(s => s.UsuarioId == null || s.UsuarioId == usuarioId);

        if (categoriaId.HasValue)
            query = query.Where(s => s.CategoriaId == categoriaId.Value);

        return await query
            .OrderBy(s => s.UsuarioId == null ? 0 : 1) // padrões primeiro
            .ThenBy(s => s.Nome)
            .AsNoTracking()
            .ToListAsync();
    }

    public async Task<Subcategoria?> BuscarPorIdAsync(Guid id, Guid usuarioId)
    {
        return await _context.Subcategorias
            .FirstOrDefaultAsync(s => s.Id == id && (s.UsuarioId == null || s.UsuarioId == usuarioId));
    }

    public async Task<Subcategoria> CriarAsync(Subcategoria sub, Guid usuarioId)
    {
        var nome = ValidarNome(sub.Nome);
        ValidarAparencia(sub.Icone, sub.Cor);

        // Categoria precisa existir e ser acessível ao usuário (padrão ou própria).
        var categoria = await _context.Categorias
            .FirstOrDefaultAsync(c => c.Id == sub.CategoriaId && (c.UsuarioId == null || c.UsuarioId == usuarioId))
            ?? throw new KeyNotFoundException("Categoria não encontrada.");
        await ExigirNomeLivreAsync(nome, categoria.Id, usuarioId, ignorarId: null);

        sub.Id = Guid.NewGuid();
        sub.Nome = nome;
        sub.Icone = Vazio(sub.Icone);
        sub.Cor = Vazio(sub.Cor);
        sub.CategoriaId = categoria.Id;
        sub.UsuarioId = usuarioId;
        sub.Categoria = null;

        _context.Subcategorias.Add(sub);
        await _context.SaveChangesAsync();

        return sub;
    }

    public async Task<Subcategoria> AtualizarAsync(Guid id, Subcategoria dados, Guid usuarioId)
    {
        var sub = await BuscarDoUsuarioParaMudarAsync(id, usuarioId, "editadas");
        var nome = ValidarNome(dados.Nome);
        ValidarAparencia(dados.Icone, dados.Cor);
        await ExigirNomeLivreAsync(nome, sub.CategoriaId, usuarioId, ignorarId: id);

        sub.Nome = nome;
        sub.Icone = Vazio(dados.Icone);
        sub.Cor = Vazio(dados.Cor);

        await _context.SaveChangesAsync();
        return sub;
    }

    /// <summary>Quantos lançamentos (vivos), contas fixas e parcelamentos (vivos) usam a subcategoria.</summary>
    public async Task<UsoSubcategoriaDto> UsoAsync(Guid id, Guid usuarioId)
    {
        if (await BuscarPorIdAsync(id, usuarioId) == null)
            throw new KeyNotFoundException("Subcategoria não encontrada.");
        return new UsoSubcategoriaDto
        {
            Lancamentos = await _context.Transacoes.CountAsync(t => t.SubcategoriaId == id),
            ContasFixas = await _context.Recorrentes.CountAsync(r => r.SubcategoriaId == id && r.ExcluidoEm == null),
            Parcelamentos = await _context.Parcelamentos.CountAsync(p => p.SubcategoriaId == id && p.Ativo),
        };
    }

    /// <summary>
    /// Exclui. Com <paramref name="moverPara"/>, os lançamentos (inclusive os excluídos), as contas fixas e os parcelamentos passam
    /// pra ela — tem que ser da mesma categoria. Sem, ficam só com a categoria (a FK é SetNull).
    /// </summary>
    public async Task DeletarAsync(Guid id, Guid usuarioId, Guid? moverPara = null)
    {
        var sub = await BuscarDoUsuarioParaMudarAsync(id, usuarioId, "removidas");

        if (moverPara is { } destinoId)
        {
            if (destinoId == id)
                throw new ArgumentException("Escolha outra subcategoria pra receber os lançamentos.");
            var destino = await BuscarPorIdAsync(destinoId, usuarioId)
                ?? throw new KeyNotFoundException("Subcategoria de destino não encontrada.");
            if (destino.CategoriaId != sub.CategoriaId)
                throw new ArgumentException("A subcategoria de destino tem que ser da mesma categoria.");

            foreach (var t in await _context.Transacoes.IgnoreQueryFilters().Where(t => t.SubcategoriaId == id).ToListAsync())
                t.SubcategoriaId = destinoId;
            foreach (var r in await _context.Recorrentes.Where(r => r.SubcategoriaId == id).ToListAsync())
                r.SubcategoriaId = destinoId;
            foreach (var p in await _context.Parcelamentos.Where(p => p.SubcategoriaId == id).ToListAsync())
                p.SubcategoriaId = destinoId;
        }

        _context.Subcategorias.Remove(sub);
        await _context.SaveChangesAsync();
    }

    // ── regras ─────────────────────────────────────────────────────────────

    private static string ValidarNome(string? nome)
    {
        var n = nome?.Trim() ?? "";
        if (n.Length == 0)
            throw new ArgumentException("Nome é obrigatório.");
        if (n.Length > NomeMax)
            throw new ArgumentException($"Nome deve ter no máximo {NomeMax} caracteres.");
        return n;
    }

    // Cor "#RRGGBB" e ícone no formato do lucide ("shopping-cart"). Antes ia direto pra coluna: texto maior que
    // ela estourava em 500 e qualquer coisa entrava como "cor".
    private static void ValidarAparencia(string? icone, string? cor)
    {
        if (Vazio(cor) is { } c && !CorHex().IsMatch(c))
            throw new ArgumentException("Cor inválida (use #RRGGBB).");
        if (Vazio(icone) is { } i && !NomeIcone().IsMatch(i))
            throw new ArgumentException("Ícone inválido.");
    }

    private static string? Vazio(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private async Task ExigirNomeLivreAsync(string nome, Guid categoriaId, Guid usuarioId, Guid? ignorarId)
    {
        var chave = nome.ToLower();
        var existe = await _context.Subcategorias.AnyAsync(s =>
            s.CategoriaId == categoriaId && (s.UsuarioId == null || s.UsuarioId == usuarioId)
            && s.Id != ignorarId && s.Nome.ToLower() == chave);
        if (existe)
            throw new InvalidOperationException(MensagemNomeRepetido);
    }

    // Do usuário pra editar/excluir: padrão → 409; de outro usuário ou inexistente → 404 (não revela que existe).
    private async Task<Subcategoria> BuscarDoUsuarioParaMudarAsync(Guid id, Guid usuarioId, string acao)
    {
        var sub = await _context.Subcategorias
            .FirstOrDefaultAsync(s => s.Id == id && (s.UsuarioId == null || s.UsuarioId == usuarioId))
            ?? throw new KeyNotFoundException("Subcategoria não encontrada.");
        if (sub.UsuarioId == null)
            throw new InvalidOperationException($"Subcategorias padrão não podem ser {acao}.");
        return sub;
    }

    [GeneratedRegex("^#[0-9A-Fa-f]{6}$")]
    private static partial Regex CorHex();

    [GeneratedRegex("^[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial Regex NomeIcone();
}
