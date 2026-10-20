using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Admin;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Ferramentas LGPD do admin (Módulo C — spec `docs/features/admin/spec.md` §5). Exportar dados
/// (direito de acesso), e exclusão em 2 estágios: <b>marcar → carência → purgar</b> (padrão SOC 2/
/// GDPR; só soft delete permanente NÃO é conforme). Toda ação é auditada. Admin nunca age sobre a
/// própria conta (§0.6).
///
/// <para><b>Purga física (irreversível):</b> a maioria das entidades financeiras referencia o dono
/// por Guid solto (<c>CriadoPor</c>/<c>UsuarioId</c> SEM FK) — só <c>Conta</c> tem FK→Usuario. Logo,
/// apagar o <c>Usuario</c> NÃO cascateia cartão/transação de cartão: eles virariam órfãos (dado
/// pessoal remanescente = viola LGPD). Por isso a purga deleta explicitamente, em ordem child→parent
/// (respeitando os FKs Restrict), tudo do usuário. Contas COMPARTILHADAS / vínculos com outro usuário
/// (família, empréstimo, rateio, acerto, relacionamento) fazem a purga RECUSAR — apagar quebraria dado
/// de terceiro. <c>FinancialEventLog</c> é anonimizado (retido por obrigação, perde o vínculo pessoal);
/// <c>AdminAuditLog</c> é preservado (sem FK, sobrevive à conta).</para>
/// </summary>
public class AdminLgpdService
{
    /// <summary>Janela de carência do soft delete: convenção de mercado (SOC 2/GDPR), NÃO obrigação
    /// legal — a LGPD não fixa prazo pra eliminar (Art. 15-16). Ver spec §5 e `docs/CONFORMIDADE_BR.md`.</summary>
    public const int JanelaCarenciaDias = 30;

    private readonly AppDbContext _context;
    private readonly AdminAuditService _audit;
    private readonly NotificacaoAdminService _notificacaoAdmin;

    public AdminLgpdService(AppDbContext context, AdminAuditService audit, NotificacaoAdminService notificacaoAdmin)
    {
        _context = context;
        _audit = audit;
        _notificacaoAdmin = notificacaoAdmin;
    }

    // ── Exportar (direito de acesso/portabilidade) ────────────────────────────────────────

    /// <summary>Monta o pacote de dados pessoais do usuário (só dele — nunca dados de terceiros).
    /// Ação auditada. Inclui transações canceladas (soft-deleted) — é o dado da pessoa.</summary>
    public async Task<ExportacaoUsuarioDto> ExportarAsync(Guid usuarioId, Guid adminId, string adminEmail)
    {
        var dto = await MontarExportacaoAsync(usuarioId);
        _audit.Registrar(adminId, adminEmail, AcaoAdmin.ExportarDados, "Usuario", usuarioId, dto.Perfil.Email);
        await _context.SaveChangesAsync();
        return dto;
    }

    /// <summary>Monta o pacote de dados pessoais SEM auditar/salvar — reutilizável pelo autoatendimento
    /// do titular (`MinhaContaService`), que audita como ação própria.</summary>
    public async Task<ExportacaoUsuarioDto> MontarExportacaoAsync(Guid usuarioId)
    {
        var u = await BuscarOuFalharAsync(usuarioId);
        var foto = await _context.FotosPerfil.AsNoTracking().FirstOrDefaultAsync(f => f.UsuarioId == usuarioId);
        // Guardado de cada meta = saldo da caixinha dela (regra única de saldo).
        var metas = await _context.Metas.AsNoTracking().Where(m => m.UsuarioId == usuarioId).ToListAsync();
        var caixinhas = await RegrasFinanceiras.SaldosDasContasAsync(_context, metas.Where(m => m.ContaId.HasValue).Select(m => m.ContaId!.Value), usuarioId);

        return new ExportacaoUsuarioDto
        {
            GeradoEm = DateTime.UtcNow,
            Perfil = new PerfilExportadoDto
            {
                Id = u.Id,
                Email = u.Email,
                Nome = u.Nome,
                DataNascimento = u.DataNascimento,
                FotoPerfil = foto is null ? null : $"data:{foto.TipoConteudo};base64,{Convert.ToBase64String(foto.Dados)}",
                Status = u.Status,
                MfaAtivo = u.MfaAtivo,
                OnboardingConcluido = u.OnboardingConcluido,
                CriadoEm = u.CriadoEm,
                UltimoAcessoEm = u.UltimoAcessoEm,
            },
            Contas = await _context.Contas
                .Where(c => c.UsuarioIdProprietario == usuarioId)
                .Select(c => new ContaExportadaDto
                {
                    Id = c.Id,
                    Nome = c.Nome,
                    Tipo = c.Tipo.ToString(),
                    Banco = c.Banco != null ? c.Banco.Nome : null,
                })
                .ToListAsync(),
            Cartoes = await _context.CartoesCredito
                .Where(c => c.CriadoPor == usuarioId)
                .Select(c => new CartaoExportadoDto
                {
                    Id = c.Id,
                    Nome = c.Nome,
                    UltimosDigitos = c.UltimosDigitos,
                    LimiteTotal = c.LimiteTotal,
                })
                .ToListAsync(),
            // ToDateTime não traduz pro SQL — projeta Data+Hora crus e monta o DateTime em memória.
            Transacoes = (await _context.Transacoes
                .IgnoreQueryFilters()
                .Where(t => t.CriadoPor == usuarioId)
                .OrderByDescending(t => t.Data)
                .ThenByDescending(t => t.Hora)
                .Select(t => new
                {
                    t.Id,
                    t.Descricao,
                    t.Valor,
                    t.Tipo,
                    t.Data,
                    t.Hora,
                    Categoria = t.Categoria != null ? t.Categoria.Descricao : null,
                })
                .ToListAsync())
                .Select(t => new TransacaoExportadaDto
                {
                    Id = t.Id,
                    Descricao = t.Descricao,
                    Valor = t.Valor,
                    Tipo = t.Tipo.ToString(),
                    Data = t.Data.ToDateTime(t.Hora ?? TimeOnly.MinValue),
                    Categoria = t.Categoria,
                })
                .ToList(),
            Metas = metas
                .Select(m => new MetaExportadaDto
                {
                    Id = m.Id, Nome = m.Nome, ValorAlvo = m.ValorAlvo, DataLimite = m.DataLimite,
                    ConcluidaEm = m.ConcluidaEm, ValorJuntado = m.ValorJuntado,
                    Guardado = m.ContaId.HasValue && caixinhas.TryGetValue(m.ContaId.Value, out var s) ? s.Saldo : 0m,
                })
                .ToList(),
            Orcamentos = await _context.Orcamentos
                .Where(o => o.UsuarioId == usuarioId)
                .Select(o => new OrcamentoExportadoDto { Id = o.Id, Mes = o.Mes, Ano = o.Ano, Valor = o.ValorLimite })
                .ToListAsync(),
        };
    }

    // ── Exclusão em 2 estágios ────────────────────────────────────────────────────────────

    /// <summary>Estágio 1 — marca a conta pra exclusão (soft): <see cref="StatusUsuario.MarcadoParaExclusao"/>
    /// + carimba <c>MarcadoExclusaoEm</c>, derruba as sessões (refresh tokens) e para o login. Reversível
    /// na janela (<see cref="CancelarExclusaoAsync"/>). Só sobre conta usável (Ativo/Bloqueado) — o estado
    /// anterior é sempre "usável", então cancelar volta pra Ativo com segurança. Admin não marca a si (§0.6).</summary>
    public async Task<UsuarioAdminDto> MarcarExclusaoAsync(Guid usuarioId, Guid adminId, string adminEmail)
    {
        if (usuarioId == adminId)
            throw new ForbiddenAccessException("Você não pode marcar a própria conta para exclusão.");

        var u = await BuscarOuFalharAsync(usuarioId);
        if (u.Status != StatusUsuario.Ativo && u.Status != StatusUsuario.Bloqueado)
            throw new InvalidOperationException("Só é possível marcar para exclusão uma conta ativa ou bloqueada.");

        u.Status = StatusUsuario.MarcadoParaExclusao;
        u.MarcadoExclusaoEm = DateTime.UtcNow;
        u.AtualizadoEm = DateTime.UtcNow;

        // Derruba as sessões — a conta para de logar imediatamente.
        var tokens = await _context.RefreshTokens.Where(t => t.UsuarioId == usuarioId).ToListAsync();
        _context.RefreshTokens.RemoveRange(tokens);

        // Esquece os dispositivos confiáveis da conta (não deixa device pular MFA numa conta em exclusão).
        var devices = await _context.TrustedDevices.Where(d => d.UsuarioId == usuarioId).ToListAsync();
        _context.TrustedDevices.RemoveRange(devices);

        // Tira a conta de qualquer chooser (roster) onde ela apareça neste ou noutro navegador.
        var rosters = await _context.ContasLembradas.Where(c => c.UsuarioId == usuarioId).ToListAsync();
        _context.ContasLembradas.RemoveRange(rosters);

        _audit.Registrar(adminId, adminEmail, AcaoAdmin.MarcarExclusao, "Usuario", u.Id, u.Email);
        await _context.SaveChangesAsync();
        return UsuarioAdminDto.De(u);
    }

    /// <summary>Desfaz o estágio 1 na janela de carência → volta pra <see cref="StatusUsuario.Ativo"/> e
    /// limpa <c>MarcadoExclusaoEm</c>. Só sobre quem está marcado (409 caso contrário).</summary>
    public async Task<UsuarioAdminDto> CancelarExclusaoAsync(Guid usuarioId, Guid adminId, string adminEmail)
    {
        var u = await BuscarOuFalharAsync(usuarioId);
        if (u.Status != StatusUsuario.MarcadoParaExclusao)
            throw new InvalidOperationException("Esta conta não está marcada para exclusão.");

        u.Status = StatusUsuario.Ativo;
        u.MarcadoExclusaoEm = null;
        u.AtualizadoEm = DateTime.UtcNow;

        _audit.Registrar(adminId, adminEmail, AcaoAdmin.CancelarExclusao, "Usuario", u.Id, u.Email);
        await _context.SaveChangesAsync();
        return UsuarioAdminDto.De(u);
    }

    /// <summary>Vínculos com OUTROS usuários que impedem a purga física (apagar quebraria dado de
    /// terceiro). Lista vazia = conta "limpa", pode purgar. Cobre todos os FKs Restrict→Usuario + as
    /// relações inerentemente entre duas pessoas.</summary>
    public async Task<List<string>> DetectarVinculosAsync(Guid usuarioId)
    {
        var v = new List<string>();

        if (await _context.Relacionamentos.AnyAsync(r => r.UsuarioId1 == usuarioId || r.UsuarioId2 == usuarioId))
            v.Add("relacionamento com outro usuário");
        // Família (membro, criador, convite, rateio, acerto) NÃO trava mais: a purga desvincula e a família fica só com
        // os números, em nome de um "Membro que saiu" (FamiliaAoExcluirConta; passo 7, decisão do Gustavo 2026-10-19).
        if (await _context.Emprestimos.AnyAsync(e => e.ContraparteUsuarioId == usuarioId))
            v.Add("contraparte em empréstimo");
        if (await _context.EmprestimoConsolidacaoPropostas.AnyAsync(p => p.CredorUsuarioId == usuarioId || p.DevedorUsuarioId == usuarioId))
            v.Add("parte em proposta de consolidação de empréstimo");
        if (await _context.CompartilhamentosContas.AnyAsync(cc => cc.Conta!.UsuarioIdProprietario == usuarioId && cc.UsuarioId != usuarioId))
            v.Add("dono de conta compartilhada com outro usuário");

        return v;
    }

    /// <summary>Estágio 2 — purga física (IRREVERSÍVEL). Exige: não ser a própria conta; estar
    /// <see cref="StatusUsuario.MarcadoParaExclusao"/> (2 estágios obrigatório); confirmação por e-mail;
    /// e nenhum vínculo com terceiro (senão RECUSA — não quebra dado de outro). Apaga todo o grafo do
    /// usuário em ordem, anonimiza <c>FinancialEventLog</c>, preserva a auditoria.</summary>
    public async Task PurgarAsync(Guid usuarioId, Guid adminId, string adminEmail, string emailConfirmacao)
    {
        if (usuarioId == adminId)
            throw new ForbiddenAccessException("Você não pode purgar a própria conta.");

        var u = await BuscarOuFalharAsync(usuarioId);

        if (u.Status != StatusUsuario.MarcadoParaExclusao)
            throw new InvalidOperationException("Só é possível purgar uma conta marcada para exclusão. Marque para exclusão primeiro (respeita a carência).");

        if (!string.Equals(emailConfirmacao?.Trim(), u.Email, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("A confirmação não confere com o e-mail da conta.");

        var vinculos = await DetectarVinculosAsync(usuarioId);
        if (vinculos.Count > 0)
            throw new InvalidOperationException(
                "Não é possível purgar: a conta tem vínculos com outros usuários (" + string.Join(", ", vinculos) +
                "). Purgar apagaria dados de terceiros. Resolva os vínculos antes (remover da família, quitar/desfazer empréstimos e acertos, etc.).");

        await PurgarFisicoAsync(u, adminId, adminEmail);
    }

    /// <summary>Job de carência: purga automaticamente as contas marcadas cuja janela venceu
    /// (<see cref="JanelaCarenciaDias"/>) e que NÃO têm vínculo com terceiro. Contas com vínculo são
    /// PULADAS (continuam marcadas; o admin resolve na mão). Roda como "sistema" — sem confirmação por
    /// e-mail, porque a carência já é a salvaguarda. Cada conta é purgada em sua própria transação
    /// (uma falha não derruba as demais). Retorna quantas foram purgadas.</summary>
    public async Task<int> PurgarExpiradasAsync()
    {
        var limite = DateTime.UtcNow.AddDays(-JanelaCarenciaDias);
        var expiradas = await _context.Usuarios
            .Where(u => u.Status == StatusUsuario.MarcadoParaExclusao
                        && u.MarcadoExclusaoEm != null && u.MarcadoExclusaoEm <= limite)
            .ToListAsync();

        var purgadas = 0;
        var comVinculo = 0;
        foreach (var u in expiradas)
        {
            var vinculos = await DetectarVinculosAsync(u.Id);
            if (vinculos.Count > 0) { comVinculo++; continue; } // entangled — não purga automático; admin resolve
            await PurgarFisicoAsync(u, Guid.Empty, "sistema:job-purga");
            purgadas++;
        }

        // Notifica o painel admin sobre o que o job fez (stream de admin, best-effort).
        if (purgadas > 0)
            await _notificacaoAdmin.CriarAsync(
                TipoNotificacaoAdmin.ExclusaoLgpd,
                "Purga automática de contas (LGPD)",
                $"{purgadas} conta(s) com carência vencida foram purgadas automaticamente.",
                "/admin/lgpd");
        if (comVinculo > 0)
            await _notificacaoAdmin.CriarAsync(
                TipoNotificacaoAdmin.ExclusaoLgpd,
                "Contas pendentes de purga (vínculo)",
                $"{comVinculo} conta(s) com carência vencida NÃO puderam ser purgadas por terem vínculo com outro usuário. Resolver manualmente.",
                "/admin/lgpd");

        return purgadas;
    }

    /// <summary>Deleção física ordenada, atômica (uma transação). Ordem child→parent por causa dos FKs
    /// Restrict; entidades com Guid solto (sem FK) são deletadas explicitamente pra não virarem órfãs.</summary>
    private async Task PurgarFisicoAsync(Usuario u, Guid adminId, string adminEmail)
    {
        var id = u.Id;
        var email = u.Email;

        await using var tx = await _context.Database.BeginTransactionAsync();

        // Anonimiza o event log financeiro: retido por obrigação (LGPD Art. 16, I), perde o vínculo
        // com pessoa identificável (Guid do dono → vazio). Sem FK, não bloqueia; só deixaria órfão.
        var logs = await _context.FinancialEventLogs.Where(e => e.CriadoPor == id).ToListAsync();
        foreach (var l in logs) l.CriadoPor = Guid.Empty;
        await _context.SaveChangesAsync();

        // Família: só os números das despesas divididas e do dinheiro entre eles ficam, em nome de "Membro que saiu"
        // (sai do CriadoPor da pessoa, então o passo 2 não apaga). O resto da pessoa vai embora abaixo.
        await FamiliaAoExcluirConta.DesvincularAsync(_context, id);
        await _context.SaveChangesAsync();

        var contaIds = await _context.Contas.Where(c => c.UsuarioIdProprietario == id).Select(c => c.Id).ToListAsync();
        var cartaoIds = await _context.CartoesCredito.Where(c => c.CriadoPor == id).Select(c => c.Id).ToListAsync();

        // 1. Transferências (Restrict em Conta) das contas do usuário.
        if (contaIds.Count > 0)
        {
            var transfs = await _context.Transferencias
                .Where(t => contaIds.Contains(t.ContaOrigemId) || contaIds.Contains(t.ContaDestinoId))
                .ToListAsync();
            _context.Transferencias.RemoveRange(transfs);
            await _context.SaveChangesAsync();
        }

        // 2. Transações do usuário (inclui canceladas). Some antes das Faturas (Transacao.FaturaPagaId é Restrict).
        var transacoes = await _context.Transacoes.IgnoreQueryFilters().Where(t => t.CriadoPor == id).ToListAsync();
        _context.Transacoes.RemoveRange(transacoes);
        await _context.SaveChangesAsync();

        // 3-6. Grafo do cartão (ordem: ParcelaTransacao → Fatura → Parcelamento → Cartão).
        if (cartaoIds.Count > 0)
        {
            var parcelamentoIds = await _context.Parcelamentos
                .Where(p => cartaoIds.Contains(p.CartaoCreditoId)).Select(p => p.Id).ToListAsync();
            if (parcelamentoIds.Count > 0)
            {
                var parcelas = await _context.ParcelasTransacao
                    .Where(pt => parcelamentoIds.Contains(pt.ParcelamentoId)).ToListAsync();
                _context.ParcelasTransacao.RemoveRange(parcelas);
                await _context.SaveChangesAsync();
            }

            var faturas = await _context.Faturas.Where(f => cartaoIds.Contains(f.CartaoCreditoId)).ToListAsync();
            _context.Faturas.RemoveRange(faturas);
            await _context.SaveChangesAsync();

            var parcelamentos = await _context.Parcelamentos.Where(p => cartaoIds.Contains(p.CartaoCreditoId)).ToListAsync();
            _context.Parcelamentos.RemoveRange(parcelamentos);
            await _context.SaveChangesAsync();

            var cartoes = await _context.CartoesCredito.Where(c => c.CriadoPor == id).ToListAsync();
            _context.CartoesCredito.RemoveRange(cartoes);
            await _context.SaveChangesAsync();
        }

        // 7. Recorrentes e subcategorias do usuário (Guid solto).
        var recorrentes = await _context.Recorrentes.Where(r => r.CriadoPor == id).ToListAsync();
        _context.Recorrentes.RemoveRange(recorrentes);
        var subcats = await _context.Subcategorias.Where(s => s.UsuarioId == id).ToListAsync();
        _context.Subcategorias.RemoveRange(subcats);
        await _context.SaveChangesAsync();

        // 7b. Foto de perfil (o cascade do banco também apaga; explícito pra não depender dele).
        _context.FotosPerfil.RemoveRange(await _context.FotosPerfil.Where(f => f.UsuarioId == id).ToListAsync());

        // 8. Usuário — o cascade cuida do resto (Conta+Compartilhamento, Orcamento, Meta, Notificacao,
        //    RefreshToken, PasswordResetToken, MfaBackupCode, MfaLoginChallenge, Relacionamento próprio,
        //    RegistroIdempotencia).
        var usuario = await _context.Usuarios.FirstAsync(x => x.Id == id);
        _context.Usuarios.Remove(usuario);

        // Auditoria da purga: gravada na mesma transação. AdminAuditLog não tem FK pro Usuario →
        // o log sobrevive à conta apagada (snapshot do e-mail preservado).
        _audit.Registrar(adminId, adminEmail, AcaoAdmin.PurgarUsuario, "Usuario", id, email, "Purga física (LGPD) concluída.");
        await _context.SaveChangesAsync();

        await tx.CommitAsync();
    }

    private async Task<Usuario> BuscarOuFalharAsync(Guid usuarioId)
        => await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId)
           ?? throw new KeyNotFoundException("Usuário não encontrado.");
}
