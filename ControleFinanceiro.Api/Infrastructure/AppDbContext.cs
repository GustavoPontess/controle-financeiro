using Microsoft.EntityFrameworkCore;
using ControleFinanceiro.Api.Domain.Entities;

namespace ControleFinanceiro.Api.Infrastructure;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options){}

    public DbSet<Categoria> Categorias => Set<Categoria>();
    public DbSet<Subcategoria> Subcategorias => Set<Subcategoria>();
    public DbSet<Transacao> Transacoes => Set<Transacao>();
    public DbSet<Conta> Contas => Set<Conta>();
    public DbSet<Banco> Bancos => Set<Banco>();
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Relacionamento> Relacionamentos => Set<Relacionamento>();
    public DbSet<CompartilhamentoConta> CompartilhamentosContas => Set<CompartilhamentoConta>();
    public DbSet<Transferencia> Transferencias => Set<Transferencia>();
    public DbSet<Recorrente> Recorrentes => Set<Recorrente>();
    public DbSet<Emprestimo> Emprestimos => Set<Emprestimo>();
    public DbSet<EmprestimoPagamentoSolicitacao> EmprestimoPagamentoSolicitacoes => Set<EmprestimoPagamentoSolicitacao>();
    public DbSet<CartaoCredito> CartoesCredito => Set<CartaoCredito>();
    public DbSet<Fatura> Faturas => Set<Fatura>();

    // ── Issue #1 Parcelamento Flexível (ARQUITETURA_PARCELAMENTO.md) ──
    public DbSet<Parcelamento> Parcelamentos => Set<Parcelamento>();
    public DbSet<ParcelaTransacao> ParcelasTransacao => Set<ParcelaTransacao>();
    public DbSet<FinancialEventLog> FinancialEventLogs => Set<FinancialEventLog>();

    // ── Issue #5 Autenticação Robusta ──
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();

    // ── Issue #10 Orçamento/Metas ──
    public DbSet<Orcamento> Orcamentos => Set<Orcamento>();

    // ── Issue #22 Família + Membros ──
    public DbSet<Familia> Familias => Set<Familia>();
    public DbSet<MembroFamilia> MembrosFamilia => Set<MembroFamilia>();
    public DbSet<ConviteFamilia> ConvitesFamilia => Set<ConviteFamilia>();
    public DbSet<RateioTransacao> RateiosTransacao => Set<RateioTransacao>();
    public DbSet<AcertoContas> AcertosContas => Set<AcertoContas>();
    public DbSet<Notificacao> Notificacoes => Set<Notificacao>();

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

        modelBuilder.Entity<Conta>()
            .HasMany(c => c.Transacoes)
            .WithOne(t => t.Conta)
            .HasForeignKey(t => t.ContaId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Cascade);

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

        // Unique constraints
        modelBuilder.Entity<Usuario>()
            .HasIndex(u => u.Email)
            .IsUnique();

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

        // PasswordResetToken → Usuario (Cascade: tokens somem com o usuário)
        modelBuilder.Entity<PasswordResetToken>()
            .HasOne(prt => prt.Usuario)
            .WithMany()
            .HasForeignKey(prt => prt.UsuarioId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PasswordResetToken>()
            .HasIndex(prt => prt.Token)
            .IsUnique();

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

        // Um usuário pode ter apenas 1 orçamento por (categoria, mês, ano)
        modelBuilder.Entity<Orcamento>()
            .HasIndex(o => new { o.UsuarioId, o.CategoriaId, o.Mes, o.Ano })
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

        // Emprestimo → Transacao (SetNull: a Transacao nunca é hard-deletada — soft delete
        // via Ativo — mas se algum dia for, o empréstimo não some junto, só perde o vínculo).
        modelBuilder.Entity<Emprestimo>()
            .HasOne(e => e.Transacao)
            .WithMany()
            .HasForeignKey(e => e.TransacaoId)
            .OnDelete(DeleteBehavior.SetNull);

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
    }
}