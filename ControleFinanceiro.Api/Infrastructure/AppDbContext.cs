using Microsoft.EntityFrameworkCore;
using ControleFinanceiro.Api.Domain.Entities;

namespace ControleFinanceiro.Api.Infrastructure;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options){}

    public DbSet<Categoria> Categorias => Set<Categoria>();
    public DbSet<Transacao> Transacoes => Set<Transacao>();
    public DbSet<Conta> Contas => Set<Conta>();
    public DbSet<Banco> Bancos => Set<Banco>();
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Relacionamento> Relacionamentos => Set<Relacionamento>();
    public DbSet<CompartilhamentoConta> CompartilhamentosContas => Set<CompartilhamentoConta>();
    public DbSet<Transferencia> Transferencias => Set<Transferencia>();
    public DbSet<Recorrente> Recorrentes => Set<Recorrente>();
    public DbSet<Emprestimo> Emprestimos => Set<Emprestimo>();
    public DbSet<CartaoCredito> CartoesCredito => Set<CartaoCredito>();
    public DbSet<Fatura> Faturas => Set<Fatura>();

    // ── Issue #1 Parcelamento Flexível (ARQUITETURA_PARCELAMENTO.md) ──
    public DbSet<Parcelamento> Parcelamentos => Set<Parcelamento>();
    public DbSet<ParcelaTransacao> ParcelasTransacao => Set<ParcelaTransacao>();
    public DbSet<FinancialEventLog> FinancialEventLogs => Set<FinancialEventLog>();

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
    }
}