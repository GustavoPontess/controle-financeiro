using System.Text.RegularExpressions;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.DTOs.Solicitacao;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Solicitações do beta (selo Beta): a pessoa conta o que está errado ou o que podia melhorar, com título, descrição e,
/// se quiser, anexos da tela (prints e blocos apontados, de várias telas). O admin lista, prioriza e muda o status
/// (com auditoria). O texto de cada bloco apontado chega mascarado do front e é mascarado de novo aqui (duas camadas),
/// a não ser que a pessoa tenha escolhido mostrar os valores naquele anexo.
/// </summary>
public partial class SolicitacaoService
{
    /// <summary>Teto por pessoa em 24 h (o limite curto fica na política "solicitacoes" do Program).</summary>
    public const int MaximoPorDia = 20;
    /// <summary>Anexos por solicitação.</summary>
    public const int MaximoDeAnexos = 5;
    /// <summary>Os anexos somem esse tanto de dias depois que a solicitação fecha (Feita / Não vamos fazer).</summary>
    public const int DiasDoPrintDepoisDeFechar = 30;

    private readonly AppDbContext _context;
    private readonly AdminAuditService _auditoria;
    private readonly NotificacaoService _notificacoes;

    public SolicitacaoService(AppDbContext context, AdminAuditService auditoria, NotificacaoService notificacoes)
    {
        _context = context;
        _auditoria = auditoria;
        _notificacoes = notificacoes;
    }

    public async Task<MinhaSolicitacaoDto> CriarAsync(Guid usuarioId, CriarSolicitacaoDto dto)
    {
        if (!Enum.IsDefined(typeof(TipoSolicitacao), dto.Tipo))
            throw new ArgumentException("Escolha se é algo errado ou uma melhoria.");
        var titulo = (dto.Titulo ?? "").Trim();
        if (titulo.Length == 0)
            throw new ArgumentException("Dê um título pra solicitação.");
        if (titulo.Length > 100)
            throw new ArgumentException("O título passa de 100 caracteres.");
        var descricao = string.IsNullOrWhiteSpace(dto.Descricao) ? null : dto.Descricao.Trim();
        if (descricao?.Length > 2000)
            throw new ArgumentException("A descrição passa de 2000 caracteres.");
        var tela = Tela(dto.Tela);
        var anexos = dto.Anexos ?? [];
        if (anexos.Count > MaximoDeAnexos)
            throw new ArgumentException($"Dá pra mandar até {MaximoDeAnexos} anexos.");

        var desde = DateTime.UtcNow.AddHours(-24);
        if (await _context.Solicitacoes.CountAsync(s => s.UsuarioId == usuarioId && s.CriadoEm >= desde) >= MaximoPorDia)
            throw new InvalidOperationException($"Você já mandou {MaximoPorDia} solicitações nas últimas 24 horas. Tente de novo amanhã.");

        var s = new Solicitacao
        {
            Id = Guid.NewGuid(),
            UsuarioId = usuarioId,
            Tipo = (TipoSolicitacao)dto.Tipo,
            Titulo = titulo,
            Descricao = descricao,
            Tela = tela,
            Janela = JanelaValida(dto.Janela),
            CriadoEm = DateTime.UtcNow,
        };
        var ordem = 0;
        foreach (var a in anexos)
        {
            if (!Enum.IsDefined(typeof(TipoAnexoSolicitacao), a.Tipo))
                throw new ArgumentException("Anexo inválido.");
            var (dados, largura, altura) = PrintDaTela.DoBase64(a.ImagemBase64 ?? "");
            s.Anexos.Add(new SolicitacaoAnexo
            {
                Id = Guid.NewGuid(),
                SolicitacaoId = s.Id,
                Ordem = ++ordem,
                Tipo = (TipoAnexoSolicitacao)a.Tipo,
                Tela = Tela(a.Tela),
                Bloco = Curto(a.Bloco, 120),
                TextoDoBloco = Curto(a.MostrarValores ? a.TextoDoBloco : Mascarar(a.TextoDoBloco), 500),
                MostrarValores = a.MostrarValores,
                Dados = dados,
                Largura = largura,
                Altura = altura,
                CriadoEm = DateTime.UtcNow,
            });
        }
        s.MostrarValores = s.Anexos.Any(a => a.MostrarValores);
        _context.Solicitacoes.Add(s);
        await _context.SaveChangesAsync();
        return Minha(s, s.Anexos.Count);
    }

    public async Task<List<MinhaSolicitacaoDto>> ListarMinhasAsync(Guid usuarioId) =>
        (await _context.Solicitacoes.AsNoTracking()
            .Where(s => s.UsuarioId == usuarioId)
            .OrderByDescending(s => s.CriadoEm)
            .Take(100)
            .Select(s => new { S = s, Anexos = s.Anexos.Count })
            .ToListAsync())
        .Select(x => Minha(x.S, x.Anexos)).ToList();

    /// <summary>Lista do admin: filtro por status e página no banco, mais recentes primeiro (sem as imagens).</summary>
    public async Task<PagedResult<SolicitacaoAdminDto>> ListarAsync(StatusSolicitacao? status, int page = 1, int pageSize = 25)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var q = _context.Solicitacoes.AsNoTracking().AsQueryable();
        if (status is { } st) q = q.Where(s => s.Status == st);
        var total = await q.CountAsync();
        var itens = await q
            .OrderByDescending(s => s.CriadoEm)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(s => new SolicitacaoAdminDto(
                s.Id, (int)s.Tipo, s.Titulo, s.Descricao, s.Tela, s.Janela, (int)s.Status, s.Prioridade, s.NotaAdmin,
                s.Usuario != null ? s.Usuario.Nome : "", s.Usuario != null ? s.Usuario.Email : "", s.CriadoEm, s.AtualizadoEm,
                s.MostrarValores,
                s.Anexos.OrderBy(a => a.Ordem)
                    .Select(a => new AnexoAdminDto(a.Id, (int)a.Tipo, a.Tela, a.Bloco, a.TextoDoBloco, a.MostrarValores)).ToList()))
            .ToListAsync();
        return new PagedResult<SolicitacaoAdminDto> { Items = itens, Total = total, Page = page, PageSize = pageSize };
    }

    /// <summary>Triagem do admin: status, prioridade e nota, gravados junto com a auditoria.</summary>
    public async Task<SolicitacaoAdminDto> AtualizarAsync(Guid id, AtualizarSolicitacaoDto dto, Guid adminId, string adminEmail)
    {
        if (!Enum.IsDefined(typeof(StatusSolicitacao), dto.Status))
            throw new ArgumentException("Status inválido.");
        if (dto.Prioridade is < 0 or > 3)
            throw new ArgumentException("Prioridade vai de P0 a P3.");
        var s = await _context.Solicitacoes.Include(x => x.Usuario).FirstOrDefaultAsync(x => x.Id == id)
                ?? throw new KeyNotFoundException("Solicitação não encontrada.");

        var statusAntes = s.Status;
        s.Status = (StatusSolicitacao)dto.Status;
        s.Prioridade = dto.Prioridade;
        s.NotaAdmin = Curto(dto.NotaAdmin, 1000);
        s.AtualizadoEm = DateTime.UtcNow;
        var prioridade = s.Prioridade is { } p ? "P" + p : "-";
        _auditoria.Registrar(adminId, adminEmail, AcaoAdmin.AtualizarSolicitacao, "Solicitacao", s.Id, s.Titulo,
            "status=" + s.Status + "; prioridade=" + prioridade);
        await _context.SaveChangesAsync();
        if (s.Status != statusAntes && AvisoDoStatus(s.Status, s.Titulo) is { } aviso)
            await _notificacoes.CriarUmaVezAsync(s.UsuarioId, $"solicitacao:{s.Id}:{(int)s.Status}",
                TipoNotificacao.SolicitacaoAtualizada, aviso.Titulo, aviso.Mensagem);
        var anexos = await _context.SolicitacoesAnexo.AsNoTracking()
            .Where(a => a.SolicitacaoId == s.Id).OrderBy(a => a.Ordem)
            .Select(a => new AnexoAdminDto(a.Id, (int)a.Tipo, a.Tela, a.Bloco, a.TextoDoBloco, a.MostrarValores))
            .ToListAsync();
        return new SolicitacaoAdminDto(s.Id, (int)s.Tipo, s.Titulo, s.Descricao, s.Tela, s.Janela, (int)s.Status, s.Prioridade,
            s.NotaAdmin, s.Usuario?.Nome ?? "", s.Usuario?.Email ?? "", s.CriadoEm, s.AtualizadoEm, s.MostrarValores, anexos);
    }

    /// <summary>A imagem de um anexo (WebP redesenhado) pro admin; null se não existe nessa solicitação.</summary>
    public Task<SolicitacaoAnexo?> ObterAnexoAsync(Guid solicitacaoId, Guid anexoId) =>
        _context.SolicitacoesAnexo.AsNoTracking().FirstOrDefaultAsync(a => a.Id == anexoId && a.SolicitacaoId == solicitacaoId);

    /// <summary>Apaga os anexos das solicitações fechadas há mais de <see cref="DiasDoPrintDepoisDeFechar"/> dias.</summary>
    public async Task<int> PurgarPrintsVencidosAsync()
    {
        var limite = DateTime.UtcNow.AddDays(-DiasDoPrintDepoisDeFechar);
        var vencidos = await _context.SolicitacoesAnexo
            .Where(a => a.Solicitacao != null
                && (a.Solicitacao.Status == StatusSolicitacao.Feita || a.Solicitacao.Status == StatusSolicitacao.NaoVamosFazer)
                && a.Solicitacao.AtualizadoEm != null && a.Solicitacao.AtualizadoEm < limite)
            .ToListAsync();
        _context.SolicitacoesAnexo.RemoveRange(vencidos);
        await _context.SaveChangesAsync();
        return vencidos.Count;
    }

    /// <summary>
    /// O que a pessoa recebe no sino quando o status muda (a lista é só do Admin, então é por aqui que ela sabe). Volta pra
    /// "Recebida" não avisa. A nota do admin nunca vai junto.
    /// </summary>
    public static (string Titulo, string Mensagem)? AvisoDoStatus(StatusSolicitacao status, string titulo) => status switch
    {
        StatusSolicitacao.NoBacklog => ("Sua solicitação entrou na fila", $"\"{titulo}\" está na nossa lista pra fazer."),
        StatusSolicitacao.Feita => ("Sua solicitação foi feita", $"\"{titulo}\" já está no app. Obrigado por mandar."),
        StatusSolicitacao.NaoVamosFazer => ("Sobre a sua solicitação", $"Por agora não vamos fazer \"{titulo}\". Obrigado por mandar."),
        _ => null,
    };

    /// <summary>Esconde valores: "R$ 1.234,56" e números com 5+ dígitos (conta, cartão, documento) viram "••••".</summary>
    public static string? Mascarar(string? texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return null;
        var t = Reais().Replace(texto, "R$ ••••");
        t = NumeroLongo().Replace(t, "••••");
        return t.Trim();
    }

    private static MinhaSolicitacaoDto Minha(Solicitacao s, int anexos) =>
        new(s.Id, (int)s.Tipo, s.Titulo, s.Descricao, s.Tela, (int)s.Status, anexos, s.CriadoEm);

    /// <summary>Só o caminho da tela (sem query nem domínio), começando por "/".</summary>
    private static string Tela(string? tela)
    {
        var t = (tela ?? "").Trim();
        var corte = t.IndexOfAny(['?', '#']);
        if (corte >= 0) t = t[..corte];
        if (t.Length == 0 || t.Length > 200 || !CaminhoValido().IsMatch(t))
            throw new ArgumentException("Tela inválida.");
        return t;
    }

    private static string? JanelaValida(string? janela)
    {
        var j = (janela ?? "").Trim();
        return JanelaFormato().IsMatch(j) ? j : null;
    }

    private static string? Curto(string? texto, int max)
    {
        if (string.IsNullOrWhiteSpace(texto)) return null;
        var t = texto.Trim();
        return t.Length <= max ? t : t[..max];
    }

    [GeneratedRegex(@"R\$\s*-?\s*[\d.,]+")]
    private static partial Regex Reais();
    [GeneratedRegex(@"\d[\d.,\-/]{3,}\d")]
    private static partial Regex NumeroLongo();
    [GeneratedRegex(@"^/[A-Za-z0-9/_\-]*$")]
    private static partial Regex CaminhoValido();
    [GeneratedRegex(@"^\d{2,5}x\d{2,5}$")]
    private static partial Regex JanelaFormato();
}
