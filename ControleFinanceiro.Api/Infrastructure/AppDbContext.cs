using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Infrastructure;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options){}

    // ── Trava da caixinha de meta ────────────────────────────────────────────
    // Caixinha (TipoConta.Caixinha) é a conta de uma meta: o saldo dela É o guardado. Só o guardar/resgatar do
    // MetaService põe ou tira lançamento dela; qualquer outro caminho (lançamento avulso, transferência,
    // importação, pagamento, reconciliação, editar/excluir a perna pela tela de transações) e conta fixa ou
    // cartão ligados a ela são recusados AQUI, num lugar só, venha de que endpoint vier.
    private int _caixinhaLiberada;

    /// <summary>Libera lançamento em caixinha enquanto o retorno não for descartado (só o MetaService usa).</summary>
    public IDisposable LiberarCaixinha()
    {
        _caixinhaLiberada++;
        return new Liberacao(this);
    }

    private sealed class Liberacao(AppDbContext ctx) : IDisposable
    {
        private bool _feito;
        public void Dispose()
        {
            if (_feito) return;
            _feito = true;
            ctx._caixinhaLiberada--;
        }
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        BarrarEscritaEmCaixinha(ids => Contas.AsNoTracking().Any(c => ids.Contains(c.Id) && c.Tipo == TipoConta.Caixinha));
        var (entradas, categorias) = TransacoesComCategoriaNova();
        if (entradas.Count > 0)
            MarcarInvestimento(entradas, Categorias.AsNoTracking()
                .Where(c => categorias.Contains(c.Id) && c.Finalidade == Finalidade.Investimento).Select(c => c.Id).ToHashSet());
        foreach (var id in FaturasComTotalMexido())
            TocarFatura(Faturas.Local.FirstOrDefault(f => f.Id == id) ?? Faturas.Find(id));
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        var (entradas, categorias) = TransacoesComCategoriaNova();
        if (entradas.Count > 0)
            MarcarInvestimento(entradas, (await Categorias.AsNoTracking()
                .Where(c => categorias.Contains(c.Id) && c.Finalidade == Finalidade.Investimento).Select(c => c.Id)
                .ToListAsync(cancellationToken)).ToHashSet());
        var ids = ContasTocadasPorEscrita();
        if (ids.Count > 0 && await Contas.AsNoTracking().AnyAsync(c => ids.Contains(c.Id) && c.Tipo == TipoConta.Caixinha, cancellationToken))
            throw new InvalidOperationException(Conta.MensagemCaixinha);
        BarrarCaixinhaNova(ids);
        foreach (var id in FaturasComTotalMexido())
            TocarFatura(Faturas.Local.FirstOrDefault(f => f.Id == id) ?? await Faturas.FindAsync([id], cancellationToken));
        return await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    // ── Compra e parcela "tocam" a fatura (write skew, P2, 2026-11-01) ─────────────────────────
    // Lançar, mudar ou tirar compra/parcela de uma fatura não alterava a linha da Fatura, e o xmin (concorrência
    // otimista) só confere UPDATE/DELETE da própria linha (doc do EF): um pagamento simultâneo validava o restante
    // contra um total velho e podia pagar a mais ou marcar "Pago" o que não foi. Conflito materializado na linha da
    // fatura: todo SaveChanges que muda o que compõe o total (RegrasFinanceiras.CompoeTotalFatura) grava a fatura
    // também (UPDATE ... WHERE xmin = @lido), e quem salvar por último com a fatura velha leva 409 e recarrega.

    /// <summary>Faturas cujo total muda neste SaveChanges (a de antes também, quando a compra troca de fatura).</summary>
    private HashSet<Guid> FaturasComTotalMexido()
    {
        var ids = new HashSet<Guid>();
        foreach (var e in ChangeTracker.Entries<Transacao>())
            if (e.State is EntityState.Added or EntityState.Deleted
                || (e.State == EntityState.Modified && (e.Property(t => t.Valor).IsModified || e.Property(t => t.FaturaId).IsModified
                    || e.Property(t => t.Ativo).IsModified || e.Property(t => t.UsadoComoCredito).IsModified)))
            {
                if (e.Entity.FaturaId is { } atual) ids.Add(atual);
                if (e.State != EntityState.Added && e.Property(t => t.FaturaId).OriginalValue is { } antes) ids.Add(antes);
            }
        foreach (var e in ChangeTracker.Entries<ParcelaTransacao>())
            if (e.State is EntityState.Added or EntityState.Deleted
                || (e.State == EntityState.Modified && (e.Property(p => p.Status).IsModified || e.Property(p => p.Valor).IsModified
                    || e.Property(p => p.ValorComJuros).IsModified || e.Property(p => p.FaturaId).IsModified)))
            {
                ids.Add(e.Entity.FaturaId);
                if (e.State != EntityState.Added) ids.Add(e.Property(p => p.FaturaId).OriginalValue);
            }
        return ids;
    }

    /// <summary>Faz a fatura entrar no UPDATE (mesmo valor), pra o xmin conferir e mudar. Nova ou excluída, não precisa.</summary>
    private void TocarFatura(Fatura? fatura)
    {
        if (fatura is null) return;
        var entrada = Entry(fatura);
        if (entrada.State == EntityState.Unchanged)
            entrada.Property(f => f.ValorPago).IsModified = true;
    }

    private void BarrarEscritaEmCaixinha(Func<List<Guid>, bool> haCaixinhaNoBanco)
    {
        var ids = ContasTocadasPorEscrita();
        if (ids.Count > 0 && haCaixinhaNoBanco(ids))
            throw new InvalidOperationException(Conta.MensagemCaixinha);
        BarrarCaixinhaNova(ids);
    }

    /// <summary>Lançamento novo ou que trocou de categoria (o <c>EhInvestimento</c> segue a categoria) e as categorias deles.</summary>
    private (List<EntityEntry<Transacao>> Entradas, List<Guid> Categorias) TransacoesComCategoriaNova()
    {
        var entradas = ChangeTracker.Entries<Transacao>()
            .Where(e => e.State == EntityState.Added || (e.State == EntityState.Modified && e.Property(t => t.CategoriaId).IsModified))
            .ToList();
        return (entradas, entradas.Where(e => e.Entity.CategoriaId.HasValue).Select(e => e.Entity.CategoriaId!.Value).Distinct().ToList());
    }

    /// <summary>Marca <c>EhInvestimento</c> pela categoria (as do banco e as criadas neste mesmo SaveChanges).</summary>
    private void MarcarInvestimento(List<EntityEntry<Transacao>> entradas, HashSet<Guid> deInvestimento)
    {
        foreach (var c in ChangeTracker.Entries<Categoria>())
            if (c.State == EntityState.Added && c.Entity.Finalidade == Finalidade.Investimento)
                deInvestimento.Add(c.Entity.Id);
        foreach (var e in entradas)
            e.Entity.EhInvestimento = e.Entity.CategoriaId is { } id && deInvestimento.Contains(id);
    }

    /// <summary>Caixinha criada no mesmo SaveChanges (ainda não está no banco) também conta.</summary>
    private void BarrarCaixinhaNova(List<Guid> ids)
    {
        if (ids.Count == 0) return;
        if (ChangeTracker.Entries<Conta>().Any(e => e.State == EntityState.Added && e.Entity.Tipo == TipoConta.Caixinha && ids.Contains(e.Entity.Id)))
            throw new InvalidOperationException(Conta.MensagemCaixinha);
    }

    /// <summary>
    /// Contas referenciadas por escrita nova ou alterada que a caixinha não aceita: lançamento (salvo liberado
    /// pelo MetaService), conta fixa e cartão (nunca).
    /// </summary>
    private List<Guid> ContasTocadasPorEscrita()
    {
        var ids = new HashSet<Guid>();
        if (_caixinhaLiberada == 0)
            foreach (var e in ChangeTracker.Entries<Transacao>())
                if (e.State is EntityState.Added or EntityState.Modified && e.Entity.ContaId is { } id)
                {
                    ids.Add(id);
                    // Mudou de conta: a de antes (a caixinha) também perde o lançamento.
                    if (e.State == EntityState.Modified && e.Property(t => t.ContaId).OriginalValue is { } antes)
                        ids.Add(antes);
                }
        foreach (var e in ChangeTracker.Entries<Recorrente>())
            if (e.State is EntityState.Added or EntityState.Modified && e.Entity.ContaId is { } id)
                ids.Add(id);
        foreach (var e in ChangeTracker.Entries<CartaoCredito>())
            if (e.State is EntityState.Added or EntityState.Modified && e.Entity.ContaId is { } id)
                ids.Add(id);
        return ids.ToList();
    }

    public DbSet<Categoria> Categorias => Set<Categoria>();
    public DbSet<Subcategoria> Subcategorias => Set<Subcategoria>();
    public DbSet<Transacao> Transacoes => Set<Transacao>();
    public DbSet<Conta> Contas => Set<Conta>();
    public DbSet<Banco> Bancos => Set<Banco>();
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<AdminAuditLog> AdminAuditLogs => Set<AdminAuditLog>();
    public DbSet<RegistroAcesso> RegistrosAcesso => Set<RegistroAcesso>();
    public DbSet<NotificacaoAdmin> NotificacoesAdmin => Set<NotificacaoAdmin>();
    public DbSet<EmailOtp> EmailOtps => Set<EmailOtp>();
    public DbSet<Relacionamento> Relacionamentos => Set<Relacionamento>();
    public DbSet<CompartilhamentoConta> CompartilhamentosContas => Set<CompartilhamentoConta>();
    public DbSet<Transferencia> Transferencias => Set<Transferencia>();
    public DbSet<Recorrente> Recorrentes => Set<Recorrente>();
    public DbSet<Emprestimo> Emprestimos => Set<Emprestimo>();
    public DbSet<EmprestimoPagamentoSolicitacao> EmprestimoPagamentoSolicitacoes => Set<EmprestimoPagamentoSolicitacao>();
    public DbSet<EmprestimoParcela> EmprestimoParcelas => Set<EmprestimoParcela>();
    public DbSet<EmprestimoConsolidacaoProposta> EmprestimoConsolidacaoPropostas => Set<EmprestimoConsolidacaoProposta>();
    public DbSet<EmprestimoConsolidacaoItem> EmprestimoConsolidacaoItens => Set<EmprestimoConsolidacaoItem>();
    public DbSet<CartaoCredito> CartoesCredito => Set<CartaoCredito>();
    public DbSet<Fatura> Faturas => Set<Fatura>();

    // ── Issue #1 Parcelamento Flexível (ARQUITETURA_PARCELAMENTO.md) ──
    public DbSet<Parcelamento> Parcelamentos => Set<Parcelamento>();
    public DbSet<ParcelaTransacao> ParcelasTransacao => Set<ParcelaTransacao>();
    public DbSet<FinancialEventLog> FinancialEventLogs => Set<FinancialEventLog>();
    public DbSet<RegistroIdempotencia> RegistrosIdempotencia => Set<RegistroIdempotencia>();
    public DbSet<ModeloImportacao> ModelosImportacao => Set<ModeloImportacao>();
    public DbSet<PadraoNomeImportacao> PadroesNomeImportacao => Set<PadraoNomeImportacao>();
    public DbSet<ImportacaoExtrato> ImportacoesExtrato => Set<ImportacaoExtrato>();
    public DbSet<SugestaoContaFixaDispensada> SugestoesContaFixaDispensadas => Set<SugestaoContaFixaDispensada>();
    public DbSet<RegraCategoria> RegrasCategoria => Set<RegraCategoria>();
    public DbSet<RendaPrevista> RendasPrevistas => Set<RendaPrevista>();
    public DbSet<FotoPerfil> FotosPerfil => Set<FotoPerfil>();
    public DbSet<AnexoTransacao> AnexosTransacao => Set<AnexoTransacao>();
    public DbSet<ReconciliacaoSaldo> ReconciliacoesSaldo => Set<ReconciliacaoSaldo>();

    // ── Issue #5 Autenticação Robusta ──
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<TokenCadastro> TokensCadastro => Set<TokenCadastro>();
    public DbSet<TentativaLogin> TentativasLogin => Set<TentativaLogin>();
    public DbSet<MfaBackupCode> MfaBackupCodes => Set<MfaBackupCode>();
    public DbSet<MfaLoginChallenge> MfaLoginChallenges => Set<MfaLoginChallenge>();
    public DbSet<TrustedDevice> TrustedDevices => Set<TrustedDevice>();
    public DbSet<ContaLembrada> ContasLembradas => Set<ContaLembrada>();

    // ── Issue #10 Orçamento/Metas ──
    public DbSet<Orcamento> Orcamentos => Set<Orcamento>();

    // ── Issue #22 Família + Membros ──
    public DbSet<Familia> Familias => Set<Familia>();
    public DbSet<MembroFamilia> MembrosFamilia => Set<MembroFamilia>();
    public DbSet<ConviteFamilia> ConvitesFamilia => Set<ConviteFamilia>();
    public DbSet<RateioTransacao> RateiosTransacao => Set<RateioTransacao>();
    public DbSet<AcertoContas> AcertosContas => Set<AcertoContas>();
    public DbSet<Notificacao> Notificacoes => Set<Notificacao>();

    // ── Solicitações do beta (algo errado / melhoria, apontando na tela) ──
    public DbSet<Solicitacao> Solicitacoes => Set<Solicitacao>();
    public DbSet<SolicitacaoAnexo> SolicitacoesAnexo => Set<SolicitacaoAnexo>();

    // ── Issue #24 Dependentes ──
    public DbSet<Dependente> Dependentes => Set<Dependente>();

    // ── Issue #86 Metas ──
    public DbSet<Meta> Metas => Set<Meta>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Recorrente>().ToTable("Assinaturas");

        modelBuilder.Entity<CartaoCredito>()
            .HasMany(c => c.Transacoes)
            .WithOne(t => t.CartaoCredito)
            .HasForeignKey(t => t.CartaoCreditoId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<CartaoCredito>()
            .HasMany(c => c.Faturas)
            .WithOne(f => f.CartaoCredito)
            .HasForeignKey(f => f.CartaoCreditoId)
            .OnDelete(DeleteBehavior.Restrict);

        // Fatura ↔ Transacao (relação principal: transações que ENTRARAM na fatura)
        modelBuilder.Entity<Fatura>()
            .HasMany(f => f.Transacoes)
            .WithOne(t => t.Fatura)
            .HasForeignKey(t => t.FaturaId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // Fatura ↔ Transacao (relação especial: pagamento de fatura aponta pra fatura quitada)
        // Sem coleção do lado da Fatura — relação one-way navegável apenas a partir da Transacao.
        modelBuilder.Entity<Transacao>()
            .HasOne(t => t.FaturaPaga)
            .WithMany()
            .HasForeignKey(t => t.FaturaPagaId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Restrict);

        // Soft delete de Transacao: filtro global exclui canceladas (Ativo=false) de TODA
        // query e navegação (saldo, listagem, dashboard, relatório, totais de fatura, etc.)
        // automaticamente. Para ver canceladas (auditoria), usar .IgnoreQueryFilters().
        modelBuilder.Entity<Transacao>().HasQueryFilter(t => t.Ativo);

        // Restrict (era Cascade): apagar uma conta apagava o histórico financeiro dela no banco. A regra
        // de quando uma conta pode sair mora no ContaService.DeletarAsync; aqui é a 2ª camada.
        modelBuilder.Entity<Conta>()
            .HasMany(c => c.Transacoes)
            .WithOne(t => t.Conta)
            .HasForeignKey(t => t.ContaId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Banco>()
            .HasMany(b => b.Contas)
            .WithOne(c => c.Banco)
            .HasForeignKey(c => c.BancoId)
            .OnDelete(DeleteBehavior.SetNull);

        // Usuario relationships
        modelBuilder.Entity<Usuario>()
            .HasMany(u => u.Contas)
            .WithOne(c => c.UsuarioProprietario)
            .HasForeignKey(c => c.UsuarioIdProprietario)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Usuario>()
            .HasMany(u => u.CompartilhamentosContas)
            .WithOne(c => c.Usuario)
            .HasForeignKey(c => c.UsuarioId)
            .OnDelete(DeleteBehavior.Cascade);

        // Relacionamento relationships
        modelBuilder.Entity<Relacionamento>()
            .HasOne(r => r.Usuario1)
            .WithOne(u => u.Relacionamento)
            .HasForeignKey<Relacionamento>(r => r.UsuarioId1)
            .OnDelete(DeleteBehavior.Cascade);

        // CompartilhamentoConta relationships
        modelBuilder.Entity<CompartilhamentoConta>()
            .HasOne(c => c.Conta)
            .WithMany(c => c.CompartilhamentosContas)
            .HasForeignKey(c => c.ContaId)
            .OnDelete(DeleteBehavior.Cascade);

        // Transferencia relationships
        modelBuilder.Entity<Transferencia>()
            .HasOne(t => t.ContaOrigem)
            .WithMany()
            .HasForeignKey(t => t.ContaOrigemId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Transferencia>()
            .HasOne(t => t.ContaDestino)
            .WithMany()
            .HasForeignKey(t => t.ContaDestinoId)
            .OnDelete(DeleteBehavior.Restrict);

        // ── Issue #1 Parcelamento Flexível ──

        // CartaoCredito → Parcelamento (Restrict: não dá pra deletar cartão com parcelamentos)
        modelBuilder.Entity<CartaoCredito>()
            .HasMany(c => c.Parcelamentos)
            .WithOne(p => p.CartaoCredito)
            .HasForeignKey(p => p.CartaoCreditoId)
            .OnDelete(DeleteBehavior.Restrict);

        // Parcelamento → ParcelaTransacao (Cascade: parcelas seguem o parcelamento;
        // soft delete é a norma — hard delete só ocorre em correção administrativa)
        modelBuilder.Entity<Parcelamento>()
            .HasMany(p => p.Parcelas)
            .WithOne(pt => pt.Parcelamento)
            .HasForeignKey(pt => pt.ParcelamentoId)
            .OnDelete(DeleteBehavior.Cascade);

        // Fatura → ParcelaTransacao (Restrict: parcela não pode ficar órfã da fatura)
        modelBuilder.Entity<Fatura>()
            .HasMany(f => f.ParcelasTransacao)
            .WithOne(pt => pt.Fatura)
            .HasForeignKey(pt => pt.FaturaId)
            .OnDelete(DeleteBehavior.Restrict);

        // Transacao → Parcelamento (SetNull: se Parcelamento for hard-deletado um dia,
        // transações executadas viram órfãs em vez de sumirem)
        modelBuilder.Entity<Transacao>()
            .HasOne(t => t.Parcelamento)
            .WithMany()
            .HasForeignKey(t => t.ParcelamentoId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // Transacao → ParcelaTransacao (SetNull: idem)
        modelBuilder.Entity<Transacao>()
            .HasOne(t => t.ParcelaTransacao)
            .WithMany()
            .HasForeignKey(t => t.ParcelaTransacaoId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // Recorrente → CartaoCredito (SetNull: cartão pode sair, recorrente sobrevive)
        modelBuilder.Entity<Recorrente>()
            .HasOne(r => r.CartaoCredito)
            .WithMany()
            .HasForeignKey(r => r.CartaoCreditoId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // FinancialEventLog: índices úteis pra audit/debug e idempotência
        modelBuilder.Entity<FinancialEventLog>()
            .HasIndex(e => new { e.CriadoPor, e.CriadoEm });
        modelBuilder.Entity<FinancialEventLog>()
            .HasIndex(e => e.CorrelationId);
        modelBuilder.Entity<FinancialEventLog>()
            .HasIndex(e => new { e.EntidadeAfetada, e.EntidadeId });

        // Fatura: concorrência otimista via xmin. O Npgsql mapeia `uint` + IsRowVersion() pra coluna
        // de sistema xmin (não cria coluna): o UPDATE sai com `WHERE xmin = @original` e, se outra
        // operação alterou a fatura no meio, afeta 0 linhas → DbUpdateConcurrencyException (→ 409).
        modelBuilder.Entity<Fatura>()
            .Property(f => f.Versao)
            .IsRowVersion();

        // Recorrente (conta fixa): mesma concorrência otimista da Fatura (xmin).
        modelBuilder.Entity<Recorrente>()
            .Property(r => r.Versao)
            .IsRowVersion();

        // Conta fixa: no máximo UMA ocorrência VIVA por período (competência). É o que segura a cobrança
        // dobrada quando duas requisições geram ao mesmo tempo (a segunda estoura 23505) — a checagem em
        // memória do gerador sozinha não vê o que a outra ainda não gravou. Parcial: cancelada não conta, e
        // ocorrência antiga sem competência (de antes da coluna) não entra.
        modelBuilder.Entity<Transacao>()
            .HasIndex(t => new { t.RecorrenteOrigemId, t.Competencia })
            .IsUnique()
            .HasFilter("\"Ativo\" AND \"Competencia\" IS NOT NULL")
            .HasDatabaseName("UX_Transacoes_Recorrente_Competencia");

        // Ocorrências de uma conta fixa (o gerador lê todas as dela; o índice acima é parcial e não serve).
        modelBuilder.Entity<Transacao>()
            .HasIndex(t => new { t.RecorrenteOrigemId, t.Data })
            .HasDatabaseName("IX_Transacoes_RecorrenteOrigemId_Data");

        // RegistroIdempotencia: o índice ÚNICO é o que torna a idempotência atômica — a segunda
        // requisição concorrente com a mesma chave estoura aqui (23505) em vez de pagar de novo.
        modelBuilder.Entity<RegistroIdempotencia>()
            .HasIndex(r => new { r.UsuarioId, r.Operacao, r.Chave })
            .IsUnique();

        // ModeloImportacao: um por conta e cabeçalho; some com a conta e com o usuário (só índices de coluna).
        modelBuilder.Entity<ModeloImportacao>()
            .HasIndex(m => new { m.UsuarioId, m.ContaId, m.Assinatura })
            .IsUnique();
        modelBuilder.Entity<ModeloImportacao>()
            .HasOne<Conta>()
            .WithMany()
            .HasForeignKey(m => m.ContaId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<ModeloImportacao>()
            .HasOne<Usuario>()
            .WithMany()
            .HasForeignKey(m => m.UsuarioId)
            .OnDelete(DeleteBehavior.Cascade);

        // PadraoNomeImportacao: o nome que a pessoa ensinou (só a forma da descrição). Um por começo; some com a pessoa.
        modelBuilder.Entity<PadraoNomeImportacao>()
            .HasIndex(p => new { p.UsuarioId, p.Antes })
            .IsUnique();
        modelBuilder.Entity<PadraoNomeImportacao>()
            .HasOne<Usuario>()
            .WithMany()
            .HasForeignKey(p => p.UsuarioId)
            .OnDelete(DeleteBehavior.Cascade);

        // SugestaoContaFixaDispensada: "não é conta fixa", uma por cartão e lugar; some com o cartão e com a pessoa.
        modelBuilder.Entity<SugestaoContaFixaDispensada>()
            .HasIndex(s => new { s.UsuarioId, s.CartaoCreditoId, s.Chave })
            .IsUnique();
        modelBuilder.Entity<SugestaoContaFixaDispensada>()
            .HasOne<CartaoCredito>()
            .WithMany()
            .HasForeignKey(s => s.CartaoCreditoId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<SugestaoContaFixaDispensada>()
            .HasOne<Usuario>()
            .WithMany()
            .HasForeignKey(s => s.UsuarioId)
            .OnDelete(DeleteBehavior.Cascade);

        // ImportacaoExtrato: o registro de cada importação confirmada; a lista é da pessoa, da mais nova pra mais
        // antiga. Some com a conta e com o usuário (é só o registro; os lançamentos são da conta).
        modelBuilder.Entity<ImportacaoExtrato>()
            .HasIndex(i => new { i.UsuarioId, i.CriadoEm });
        modelBuilder.Entity<ImportacaoExtrato>()
            .HasOne<Conta>()
            .WithMany()
            .HasForeignKey(i => i.ContaId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<ImportacaoExtrato>()
            .HasOne<Usuario>()
            .WithMany()
            .HasForeignKey(i => i.UsuarioId)
            .OnDelete(DeleteBehavior.Cascade);

        // RegraCategoria: uma por pessoa e estabelecimento; some com a pessoa. Excluir categoria move as regras
        // (CategoriaService); o cascade aqui só garante que nenhuma fica apontando pro nada.
        modelBuilder.Entity<RegraCategoria>()
            .HasIndex(r => new { r.UsuarioId, r.Chave })
            .IsUnique();
        // Sugestão coletiva: a prévia busca pelas chaves do extrato só entre as regras compartilháveis.
        modelBuilder.Entity<RegraCategoria>()
            .HasIndex(r => r.Chave)
            .HasFilter("\"Compartilhavel\"");
        modelBuilder.Entity<RegraCategoria>()
            .HasOne<Usuario>()
            .WithMany()
            .HasForeignKey(r => r.UsuarioId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<RegraCategoria>()
            .HasOne<Categoria>()
            .WithMany()
            .HasForeignKey(r => r.CategoriaId)
            .OnDelete(DeleteBehavior.Cascade);

        // Meta → Conta-caixinha (1:1). Restrict: a caixinha tem lançamentos (as transferências); a meta se exclui
        // por soft delete e a caixinha é encerrada, nunca apagada.
        modelBuilder.Entity<Meta>()
            .HasOne(m => m.Conta).WithMany().HasForeignKey(m => m.ContaId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Meta>().HasIndex(m => m.ContaId).IsUnique().HasFilter("\"ContaId\" IS NOT NULL");
        modelBuilder.Entity<Meta>().Property(m => m.Icone).HasMaxLength(30);

        // FotoPerfil → Usuario (1:1, chave = UsuarioId, Cascade: dado pessoal, some com a pessoa).
        modelBuilder.Entity<FotoPerfil>().HasKey(f => f.UsuarioId);
        modelBuilder.Entity<FotoPerfil>()
            .HasOne(f => f.Usuario)
            .WithOne()
            .HasForeignKey<FotoPerfil>(f => f.UsuarioId)
            .OnDelete(DeleteBehavior.Cascade);

        // AnexoTransacao → Transacao e → Usuario (Cascade nos dois: dado pessoal, some com o lançamento e com a pessoa).
        modelBuilder.Entity<AnexoTransacao>()
            .HasOne(a => a.Transacao).WithMany().HasForeignKey(a => a.TransacaoId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<AnexoTransacao>()
            .HasOne<Usuario>().WithMany().HasForeignKey(a => a.UsuarioId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<AnexoTransacao>().HasIndex(a => new { a.TransacaoId, a.CriadoEm });
        modelBuilder.Entity<AnexoTransacao>().HasIndex(a => a.UsuarioId);

        // RendaPrevista → Usuario (Cascade: dado pessoal, some com a pessoa). Uma linha por mês.
        modelBuilder.Entity<RendaPrevista>()
            .HasIndex(r => new { r.UsuarioId, r.Ano, r.Mes })
            .IsUnique();
        modelBuilder.Entity<RendaPrevista>()
            .Property(r => r.VariavelEsperada)
            .HasPrecision(18, 2);
        modelBuilder.Entity<RendaPrevista>()
            .Property(r => r.FixaEsperada)
            .HasPrecision(18, 2);
        modelBuilder.Entity<RendaPrevista>()
            .HasOne<Usuario>()
            .WithMany()
            .HasForeignKey(r => r.UsuarioId)
            .OnDelete(DeleteBehavior.Cascade);

        // RegistroIdempotencia → Usuario (Cascade: chaves somem com o usuário na purga LGPD).
        modelBuilder.Entity<RegistroIdempotencia>()
            .HasOne<Usuario>()
            .WithMany()
            .HasForeignKey(r => r.UsuarioId)
            .OnDelete(DeleteBehavior.Cascade);

        // ReconciliacaoSaldo → Conta (Cascade: o marco morre com a conta). O lançamento de ajuste é
        // uma Transacao normal (FK opcional, SetNull pra não arrastar). Índice por dono+conta+data
        // pra listar e consultar o último marco ≤ D.
        modelBuilder.Entity<ReconciliacaoSaldo>()
            .HasOne(r => r.Conta)
            .WithMany()
            .HasForeignKey(r => r.ContaId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<ReconciliacaoSaldo>()
            .HasOne(r => r.AjusteTransacao)
            .WithMany()
            .HasForeignKey(r => r.AjusteTransacaoId)
            .OnDelete(DeleteBehavior.SetNull);
        modelBuilder.Entity<ReconciliacaoSaldo>()
            .HasIndex(r => new { r.UsuarioId, r.ContaId, r.DataHora });

        // Unique constraints
        modelBuilder.Entity<Usuario>()
            .HasIndex(u => u.Email)
            .IsUnique();

        // AdminAuditLog — append-only, listado por mais recente. Sem FK pro Usuario (auditoria
        // sobrevive à exclusão do usuário; vínculo é só o Guid solto).
        modelBuilder.Entity<AdminAuditLog>()
            .HasIndex(a => a.CriadoEm);

        // RegistroAcesso — retenção Marco Civil Art. 15. Sem FK pro Usuario (sobrevive à purga LGPD
        // da conta; vínculo é só o Guid solto). Índice em CriadoEm pra a purga de retenção vencida;
        // em UsuarioId pra consulta por titular (ordem judicial).
        modelBuilder.Entity<RegistroAcesso>()
            .HasIndex(r => r.CriadoEm);
        modelBuilder.Entity<RegistroAcesso>()
            .HasIndex(r => r.UsuarioId);

        // NotificacaoAdmin — stream do painel admin (separado do financeiro), listado por mais recente.
        modelBuilder.Entity<NotificacaoAdmin>()
            .HasIndex(n => n.CriadoEm);

        // EmailOtp — código de reserva por e-mail; consultado por (usuário, finalidade).
        modelBuilder.Entity<EmailOtp>()
            .HasIndex(o => new { o.UsuarioId, o.Finalidade });

        modelBuilder.Entity<CompartilhamentoConta>()
            .HasIndex(c => new { c.ContaId, c.UsuarioId })
            .IsUnique();

        // ── Issue #5 Autenticação Robusta ──

        // RefreshToken → Usuario (Cascade: tokens somem com o usuário)
        modelBuilder.Entity<RefreshToken>()
            .HasOne(rt => rt.Usuario)
            .WithMany()
            .HasForeignKey(rt => rt.UsuarioId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<RefreshToken>()
            .HasIndex(rt => rt.Token)
            .IsUnique();

        // Fase 2 multi-conta: índice na família p/ reuse-detection (revogar a família toda de uma
        // vez) e listagem de sessões ativas por usuário. Limita o tamanho dos campos de exibição.
        modelBuilder.Entity<RefreshToken>()
            .HasIndex(rt => rt.FamiliaId);
        modelBuilder.Entity<RefreshToken>()
            .HasIndex(rt => new { rt.UsuarioId, rt.Revogado });
        modelBuilder.Entity<RefreshToken>()
            .Property(rt => rt.DispositivoInfo)
            .HasMaxLength(256);
        modelBuilder.Entity<RefreshToken>()
            .Property(rt => rt.IpCriacao)
            .HasMaxLength(64);

        // PasswordResetToken → Usuario (Cascade: tokens somem com o usuário)
        modelBuilder.Entity<PasswordResetToken>()
            .HasOne(prt => prt.Usuario)
            .WithMany()
            .HasForeignKey(prt => prt.UsuarioId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PasswordResetToken>()
            .HasIndex(prt => prt.Token)
            .IsUnique();

        // TokenCadastro → Usuario (Cascade: o link do "pedido recebido" some com o pedido)
        modelBuilder.Entity<TokenCadastro>()
            .HasOne(t => t.Usuario)
            .WithMany()
            .HasForeignKey(t => t.UsuarioId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<TokenCadastro>().HasIndex(t => t.TokenHash).IsUnique();
        modelBuilder.Entity<TokenCadastro>().Property(t => t.TokenHash).HasMaxLength(128);

        // Senhas erradas por e-mail digitado (sem FK: vale também pra e-mail que não tem conta)
        modelBuilder.Entity<TentativaLogin>().HasIndex(t => t.ChaveEmail).IsUnique();
        modelBuilder.Entity<TentativaLogin>().Property(t => t.ChaveEmail).HasMaxLength(64);

        // MfaBackupCode → Usuario (Cascade: códigos somem com o usuário)
        modelBuilder.Entity<MfaBackupCode>()
            .HasOne(c => c.Usuario)
            .WithMany(u => u.MfaBackupCodes)
            .HasForeignKey(c => c.UsuarioId)
            .OnDelete(DeleteBehavior.Cascade);

        // MfaLoginChallenge → Usuario (Cascade)
        modelBuilder.Entity<MfaLoginChallenge>()
            .HasOne(c => c.Usuario)
            .WithMany()
            .HasForeignKey(c => c.UsuarioId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<MfaLoginChallenge>()
            .HasIndex(c => c.TokenHash)
            .IsUnique();

        // TrustedDevice → Usuario (Cascade: devices confiáveis somem com o usuário; a purga LGPD
        // também os remove explicitamente na marcação pra exclusão). Hash único; índice por
        // (UsuarioId, Revogado) pra listar/revogar em massa. Campos de exibição limitados.
        modelBuilder.Entity<TrustedDevice>()
            .HasOne(d => d.Usuario)
            .WithMany()
            .HasForeignKey(d => d.UsuarioId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<TrustedDevice>()
            .HasIndex(d => d.TokenHash)
            .IsUnique();
        modelBuilder.Entity<TrustedDevice>()
            .HasIndex(d => new { d.UsuarioId, d.Revogado });
        modelBuilder.Entity<TrustedDevice>()
            .Property(d => d.DispositivoInfo)
            .HasMaxLength(256);
        modelBuilder.Entity<TrustedDevice>()
            .Property(d => d.IpCriacao)
            .HasMaxLength(64);

        // ContaLembrada → Usuario (Cascade). Índice único por (DeviceHash, UsuarioId): 1 linha por
        // conta por navegador; DeviceHash entra no índice pra listar/remover por navegador.
        modelBuilder.Entity<ContaLembrada>()
            .HasOne(c => c.Usuario)
            .WithMany()
            .HasForeignKey(c => c.UsuarioId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<ContaLembrada>()
            .HasIndex(c => new { c.DeviceHash, c.UsuarioId })
            .IsUnique();
        modelBuilder.Entity<ContaLembrada>()
            .Property(c => c.DeviceHash)
            .HasMaxLength(64);

        // ── Issue #10 Orçamento/Metas ──

        // Orcamento → Usuario (Cascade: orçamentos somem com o usuário)
        modelBuilder.Entity<Orcamento>()
            .HasOne(o => o.Usuario)
            .WithMany()
            .HasForeignKey(o => o.UsuarioId)
            .OnDelete(DeleteBehavior.Cascade);

        // Orcamento → Categoria (SetNull: categoria pode ser deletada, orçamento vira "geral")
        modelBuilder.Entity<Orcamento>()
            .HasOne(o => o.Categoria)
            .WithMany()
            .HasForeignKey(o => o.CategoriaId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // Orcamento → Subcategoria (Cascade: o planejado de uma subcategoria some com ela)
        modelBuilder.Entity<Orcamento>()
            .HasOne(o => o.Subcategoria)
            .WithMany()
            .HasForeignKey(o => o.SubcategoriaId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Cascade);

        // Um usuário pode ter apenas 1 orçamento por (categoria, subcategoria, mês, ano)
        modelBuilder.Entity<Orcamento>()
            .HasIndex(o => new { o.UsuarioId, o.CategoriaId, o.SubcategoriaId, o.Mes, o.Ano })
            .IsUnique();

        // ── Issue #22 Família + Membros ──

        // Familia → CriadoPor (Restrict: não deletar usuário que criou família)
        modelBuilder.Entity<Familia>()
            .HasOne(f => f.CriadoPor)
            .WithMany()
            .HasForeignKey(f => f.CriadoPorUsuarioId)
            .OnDelete(DeleteBehavior.Restrict);

        // Familia → Membros / Convites (Cascade: somem com a família)
        modelBuilder.Entity<Familia>()
            .HasMany(f => f.Membros)
            .WithOne(m => m.Familia)
            .HasForeignKey(m => m.FamiliaId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Familia>()
            .HasMany(f => f.Convites)
            .WithOne(c => c.Familia)
            .HasForeignKey(c => c.FamiliaId)
            .OnDelete(DeleteBehavior.Cascade);

        // MembroFamilia → Usuario (Restrict: não deletar usuário que é membro)
        modelBuilder.Entity<MembroFamilia>()
            .HasOne(m => m.Usuario)
            .WithMany()
            .HasForeignKey(m => m.UsuarioId)
            .OnDelete(DeleteBehavior.Restrict);

        // Unicidade (FamiliaId, UsuarioId) entre membros ativos é validada no
        // service — soft delete permite reentrada, o que um índice único impediria.
        modelBuilder.Entity<MembroFamilia>()
            .HasIndex(m => new { m.FamiliaId, m.UsuarioId });

        // ConviteFamilia → CriadoPor (Restrict)
        modelBuilder.Entity<ConviteFamilia>()
            .HasOne(c => c.CriadoPor)
            .WithMany()
            .HasForeignKey(c => c.CriadoPorUsuarioId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ConviteFamilia>()
            .HasIndex(c => c.Token)
            .IsUnique();

        modelBuilder.Entity<ConviteFamilia>()
            .HasIndex(c => new { c.FamiliaId, c.EmailConvidado });

        // ── Issue #23 Despesa Compartilhada ──

        // Transacao → Familia (SetNull: transação compartilhada volta a pessoal
        // se a família for removida)
        modelBuilder.Entity<Transacao>()
            .HasOne(t => t.Familia)
            .WithMany()
            .HasForeignKey(t => t.FamiliaId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Transacao>()
            .HasIndex(t => t.FamiliaId);

        // ── Issue #24 Dependentes ──

        // Dependente → Familia (Cascade: dependentes somem com a família)
        modelBuilder.Entity<Dependente>()
            .HasOne(d => d.Familia)
            .WithMany()
            .HasForeignKey(d => d.FamiliaId)
            .OnDelete(DeleteBehavior.Cascade);

        // Transacao → Dependente (SetNull: a despesa sobrevive se o dependente
        // for removido — só perde a atribuição)
        modelBuilder.Entity<Transacao>()
            .HasOne(t => t.Dependente)
            .WithMany()
            .HasForeignKey(t => t.DependenteId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Transacao>()
            .HasIndex(t => t.DependenteId);

        // ── Issue #25 Modos de rateio ──

        // RateioTransacao → Transacao (Cascade: somem com a despesa)
        modelBuilder.Entity<RateioTransacao>()
            .HasOne(r => r.Transacao)
            .WithMany(t => t.Rateios)
            .HasForeignKey(r => r.TransacaoId)
            .OnDelete(DeleteBehavior.Cascade);

        // RateioTransacao → Usuario (Restrict: não deletar usuário com rateios)
        modelBuilder.Entity<RateioTransacao>()
            .HasOne(r => r.Usuario)
            .WithMany()
            .HasForeignKey(r => r.UsuarioId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<RateioTransacao>()
            .HasIndex(r => r.TransacaoId);

        modelBuilder.Entity<RateioTransacao>()
            .Property(r => r.Percentual)
            .HasPrecision(5, 2);

        // ── Issue #26 Acerto de contas ──

        // AcertoContas → Familia (Cascade: somem com a família)
        modelBuilder.Entity<AcertoContas>()
            .HasOne(a => a.Familia)
            .WithMany()
            .HasForeignKey(a => a.FamiliaId)
            .OnDelete(DeleteBehavior.Cascade);

        // AcertoContas → De/Para Usuario (Restrict: não deletar usuário com acertos)
        modelBuilder.Entity<AcertoContas>()
            .HasOne(a => a.DeUsuario)
            .WithMany()
            .HasForeignKey(a => a.DeUsuarioId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<AcertoContas>()
            .HasOne(a => a.ParaUsuario)
            .WithMany()
            .HasForeignKey(a => a.ParaUsuarioId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<AcertoContas>()
            .HasIndex(a => new { a.FamiliaId, a.Ano, a.Mes });

        // Lançamentos do acerto nas contas (SetNull: a purga LGPD apaga transações da pessoa e o acerto fica).
        modelBuilder.Entity<AcertoContas>()
            .HasOne(a => a.TransacaoSaida)
            .WithMany()
            .HasForeignKey(a => a.TransacaoSaidaId)
            .OnDelete(DeleteBehavior.SetNull);
        modelBuilder.Entity<AcertoContas>()
            .HasOne(a => a.TransacaoEntrada)
            .WithMany()
            .HasForeignKey(a => a.TransacaoEntradaId)
            .OnDelete(DeleteBehavior.SetNull);

        // Confirmar e lançar mexem na mesma linha: concorrência otimista via xmin (como Fatura).
        modelBuilder.Entity<AcertoContas>()
            .Property(a => a.Versao)
            .IsRowVersion();

        // ── Empréstimo compartilhado (docs/features/emprestimo-compartilhado/spec.md) ──

        // Emprestimo → ContraparteUsuario (Restrict: não deletar usuário com vínculo ativo)
        modelBuilder.Entity<Emprestimo>()
            .HasOne(e => e.ContraparteUsuario)
            .WithMany()
            .HasForeignKey(e => e.ContraparteUsuarioId)
            .OnDelete(DeleteBehavior.Restrict);

        // Default true no banco — sem isso o EF usa o default do CLR (false) na coluna,
        // o que soft-deletaria todo empréstimo existente ao aplicar a migration.
        modelBuilder.Entity<Emprestimo>()
            .Property(e => e.Ativo)
            .HasDefaultValue(true);

        modelBuilder.Entity<Emprestimo>()
            .HasIndex(e => e.ConviteTokenHash);

        // Índice do filtro principal de multi-tenancy + ordenação da listagem. Sem ele, o
        // `CriadoPor == usuarioId OR ContraparteUsuarioId == usuarioId` cai em seq scan O(N)
        // (Contraparte já tem índice, CriadoPor não tinha). Com este, o Postgres faz BitmapOr
        // dos dois índices → O(K) (K = empréstimos do usuário). Colunas de ordenação
        // (Quitado, DataVencimento, DataInicio) cobrem o ORDER BY da ListarAsync no caso comum.
        modelBuilder.Entity<Emprestimo>()
            .HasIndex(e => new { e.CriadoPor, e.Quitado, e.DataVencimento, e.DataInicio });

        // Emprestimo → Transacao (SetNull: a Transacao nunca é hard-deletada — soft delete
        // via Ativo — mas se algum dia for, o empréstimo não some junto, só perde o vínculo).
        modelBuilder.Entity<Emprestimo>()
            .HasOne(e => e.Transacao)
            .WithMany()
            .HasForeignKey(e => e.TransacaoId)
            .OnDelete(DeleteBehavior.SetNull);

        // Emprestimo → Banco (SetNull: banco é catálogo global; se um dia sumir, o empréstimo não
        // some junto, só perde o vínculo). Empréstimo bancário (Open Finance Fase 1).
        modelBuilder.Entity<Emprestimo>()
            .HasOne(e => e.Banco)
            .WithMany()
            .HasForeignKey(e => e.BancoId)
            .OnDelete(DeleteBehavior.SetNull);

        // Default Manual no banco — sem isso o EF usaria o default do CLR (0, valor inválido do enum)
        // na coluna das linhas já existentes.
        modelBuilder.Entity<Emprestimo>()
            .Property(e => e.Origem)
            .HasDefaultValue(OrigemEmprestimo.Manual);

        // Pagamento com comprovante + aprovação (docs/features/emprestimo-compartilhado/pagamento-aprovacao.md)
        modelBuilder.Entity<EmprestimoPagamentoSolicitacao>()
            .HasOne(s => s.Emprestimo)
            .WithMany()
            .HasForeignKey(s => s.EmprestimoId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<EmprestimoPagamentoSolicitacao>()
            .HasOne(s => s.TransacaoComprovante)
            .WithMany()
            .HasForeignKey(s => s.TransacaoComprovanteId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<EmprestimoPagamentoSolicitacao>()
            .HasOne(s => s.TransacaoRecebimento)
            .WithMany()
            .HasForeignKey(s => s.TransacaoRecebimentoId)
            .OnDelete(DeleteBehavior.Restrict);

        // Forma de pagamento + parcelas (docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md)
        modelBuilder.Entity<Emprestimo>()
            .Property(e => e.TaxaJuroMensal)
            .HasPrecision(5, 2);

        modelBuilder.Entity<Emprestimo>()
            .Property(e => e.PercentualMultaAtraso)
            .HasPrecision(5, 2);

        modelBuilder.Entity<EmprestimoParcela>()
            .HasOne(p => p.Emprestimo)
            .WithMany(e => e.Parcelas)
            .HasForeignKey(p => p.EmprestimoId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<EmprestimoParcela>()
            .HasOne(p => p.SolicitacaoPagamento)
            .WithMany()
            .HasForeignKey(p => p.SolicitacaoPagamentoId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<EmprestimoParcela>()
            .HasIndex(p => new { p.EmprestimoId, p.Numero });

        modelBuilder.Entity<EmprestimoPagamentoSolicitacao>()
            .HasOne(s => s.Parcela)
            .WithMany()
            .HasForeignKey(s => s.ParcelaId)
            .OnDelete(DeleteBehavior.Restrict);

        // Unificar/consolidar (docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md)
        modelBuilder.Entity<Emprestimo>()
            .HasOne(e => e.ConsolidadoNoEmprestimo)
            .WithMany()
            .HasForeignKey(e => e.ConsolidadoNoEmprestimoId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<EmprestimoConsolidacaoProposta>()
            .HasOne(p => p.CredorUsuario)
            .WithMany()
            .HasForeignKey(p => p.CredorUsuarioId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<EmprestimoConsolidacaoProposta>()
            .HasOne(p => p.DevedorUsuario)
            .WithMany()
            .HasForeignKey(p => p.DevedorUsuarioId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<EmprestimoConsolidacaoProposta>()
            .HasOne(p => p.EmprestimoConsolidado)
            .WithMany()
            .HasForeignKey(p => p.EmprestimoConsolidadoId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<EmprestimoConsolidacaoProposta>()
            .Property(p => p.TaxaJuroMensal)
            .HasPrecision(5, 2);

        modelBuilder.Entity<EmprestimoConsolidacaoProposta>()
            .Property(p => p.PercentualMultaAtraso)
            .HasPrecision(5, 2);

        modelBuilder.Entity<EmprestimoConsolidacaoItem>()
            .HasOne(i => i.Proposta)
            .WithMany(p => p.Itens)
            .HasForeignKey(i => i.PropostaId)
            .OnDelete(DeleteBehavior.Cascade);

        // Restrict (não Cascade): apagar o item de consolidação não pode arrastar o Emprestimo
        // original — soft delete é o único jeito de "sumir" um empréstimo (CLAUDE.md).
        modelBuilder.Entity<EmprestimoConsolidacaoItem>()
            .HasOne(i => i.EmprestimoOriginal)
            .WithMany()
            .HasForeignKey(i => i.EmprestimoOriginalId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<EmprestimoConsolidacaoItem>()
            .HasIndex(i => new { i.PropostaId, i.EmprestimoOriginalId })
            .IsUnique();

        // ── Issue #86 Metas ──

        // Meta → Usuario (Cascade: metas somem com o usuário)
        modelBuilder.Entity<Meta>()
            .HasOne(m => m.Usuario)
            .WithMany()
            .HasForeignKey(m => m.UsuarioId)
            .OnDelete(DeleteBehavior.Cascade);

        // Meta → Familia (SetNull: meta vira individual se a família for dissolvida)
        modelBuilder.Entity<Meta>()
            .HasOne(m => m.Familia)
            .WithMany()
            .HasForeignKey(m => m.FamiliaId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // Meta → Categoria (SetNull: meta sobrevive sem categoria)
        modelBuilder.Entity<Meta>()
            .HasOne(m => m.Categoria)
            .WithMany()
            .HasForeignKey(m => m.CategoriaId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Meta>()
            .HasIndex(m => m.UsuarioId);

        modelBuilder.Entity<Meta>()
            .HasIndex(m => m.FamiliaId);

        // ── Issue #27 Importação de extrato ──

        // Índice para deduplicar reimportações de OFX pelo FITID.
        modelBuilder.Entity<Transacao>()
            .HasIndex(t => t.ImportacaoFitId);

        // ── Issue #30 Notificações ──

        // Notificacao → Usuario (Cascade: somem com o usuário)
        modelBuilder.Entity<Notificacao>()
            .HasOne(n => n.Usuario)
            .WithMany()
            .HasForeignKey(n => n.UsuarioId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Notificacao>()
            .HasIndex(n => new { n.UsuarioId, n.Lida });

        // Solicitação é da pessoa: sai junto na purga (cascade). Admin lista por status e data.
        modelBuilder.Entity<Solicitacao>()
            .HasOne(x => x.Usuario)
            .WithMany()
            .HasForeignKey(x => x.UsuarioId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Solicitacao>().HasIndex(x => new { x.UsuarioId, x.CriadoEm });
        modelBuilder.Entity<Solicitacao>().HasIndex(x => new { x.Status, x.CriadoEm });
        modelBuilder.Entity<SolicitacaoAnexo>()
            .HasOne(x => x.Solicitacao)
            .WithMany(s => s.Anexos)
            .HasForeignKey(x => x.SolicitacaoId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<SolicitacaoAnexo>().HasIndex(x => new { x.SolicitacaoId, x.Ordem });

        // Aviso de uma vez só (alerta de limite): a segunda tentativa estoura o índice e é ignorada.
        modelBuilder.Entity<Notificacao>()
            .HasIndex(n => new { n.UsuarioId, n.Chave })
            .IsUnique()
            .HasFilter("\"Chave\" IS NOT NULL");

        // ── Issue #83 Subcategorias ──

        // Subcategoria → Categoria (Cascade: subcategorias somem com a categoria)
        modelBuilder.Entity<Subcategoria>()
            .HasOne(s => s.Categoria)
            .WithMany()
            .HasForeignKey(s => s.CategoriaId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Subcategoria>()
            .HasIndex(s => new { s.UsuarioId, s.CategoriaId });

        // Transacao → Subcategoria (SetNull: a transação sobrevive se a
        // subcategoria for removida — só perde a granularidade)
        modelBuilder.Entity<Transacao>()
            .HasOne(t => t.Subcategoria)
            .WithMany()
            .HasForeignKey(t => t.SubcategoriaId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // Parcelamento → Subcategoria (SetNull: mesma regra da transação)
        modelBuilder.Entity<Parcelamento>()
            .HasOne(p => p.Subcategoria)
            .WithMany()
            .HasForeignKey(p => p.SubcategoriaId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // Recorrente (conta fixa) → Subcategoria (SetNull: mesma regra da transação)
        modelBuilder.Entity<Recorrente>()
            .HasOne(r => r.Subcategoria)
            .WithMany()
            .HasForeignKey(r => r.SubcategoriaId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // Conta e cartão da casa → Familia (SetNull: a família some, a conta/o cartão continua da pessoa)
        modelBuilder.Entity<Conta>()
            .HasOne(c => c.Familia)
            .WithMany()
            .HasForeignKey(c => c.FamiliaId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);
        modelBuilder.Entity<CartaoCredito>()
            .HasOne(c => c.Familia)
            .WithMany()
            .HasForeignKey(c => c.FamiliaId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // Conta fixa da casa → Familia (SetNull: a família some, a conta fixa continua da pessoa)
        modelBuilder.Entity<Recorrente>()
            .HasOne(r => r.Familia)
            .WithMany()
            .HasForeignKey(r => r.FamiliaId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);
    }
}