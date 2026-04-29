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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Conta>()
            .HasMany(c => c.Transacoes)
            .WithOne(t => t.Conta)
            .HasForeignKey(t => t.ContaId)
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

        // Unique constraints
        modelBuilder.Entity<Usuario>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<CompartilhamentoConta>()
            .HasIndex(c => new { c.ContaId, c.UsuarioId })
            .IsUnique();
    }
}