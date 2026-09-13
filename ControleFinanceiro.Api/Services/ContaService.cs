using System.Text.RegularExpressions;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services
{
    public class ContaService
    {
        private readonly AppDbContext _context;

        // Só dígitos (agência não tem dígito verificador na maioria dos bancos BR).
        private static readonly Regex AgenciaRegex = new(@"^\d{1,10}$", RegexOptions.Compiled);
        // Dígitos, com dígito verificador opcional separado por hífen (ex: 91205195-5).
        private static readonly Regex NumeroContaRegex = new(@"^\d{1,20}(-\d)?$", RegexOptions.Compiled);

        public ContaService(AppDbContext context)
        {
            _context = context;
        }

        private static void ValidarFormato(Conta conta)
        {
            if (!string.IsNullOrWhiteSpace(conta.Agencia) && !AgenciaRegex.IsMatch(conta.Agencia))
                throw new ArgumentException("Agência deve conter só números (até 10 dígitos).");

            if (!string.IsNullOrWhiteSpace(conta.NumeroConta) && !NumeroContaRegex.IsMatch(conta.NumeroConta))
                throw new ArgumentException("Número da conta deve conter só números, com dígito verificador opcional após um hífen (ex: 91205195-5).");
        }

        public async Task<List<Conta>> ListarAsync(Guid usuarioId)
        {
            return await _context.Contas
                .Where(c => c.UsuarioIdProprietario == usuarioId)
                .Include(c => c.Banco)
                .Include(c => c.Transacoes)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<Conta?> BuscarPorIdAsync(Guid id, Guid usuarioId)
        {
            return await _context.Contas
                .Where(c => c.Id == id && c.UsuarioIdProprietario == usuarioId)
                .Include(c => c.Banco)
                .Include(c => c.Transacoes)
                .FirstOrDefaultAsync();
        }

        public async Task<Conta> CriarAsync(Conta conta, Guid usuarioId, decimal saldoInicial = 0)
        {
            if (string.IsNullOrWhiteSpace(conta.Nome))
                throw new ArgumentException("Nome é obrigatório.");

            if (conta.Nome.Length > 100)
                throw new ArgumentException("Nome deve ter no máximo 100 caracteres.");

            if (saldoInicial < 0)
                throw new ArgumentException("Saldo inicial não pode ser negativo.");

            ValidarFormato(conta);

            conta.Id = Guid.NewGuid();
            conta.UsuarioIdProprietario = usuarioId;
            _context.Contas.Add(conta);

            if (saldoInicial > 0)
            {
                _context.Transacoes.Add(new Transacao
                {
                    Id = Guid.NewGuid(),
                    Descricao = "Saldo Inicial",
                    Valor = saldoInicial,
                    Tipo = TipoTransacao.Receita,
                    ContaId = conta.Id,
                    CategoriaId = null,
                    CriadoPor = usuarioId,
                    Data = DateTime.UtcNow,
                    EhSaldoInicial = true
                });
            }

            await _context.SaveChangesAsync();
            return conta;
        }

        public async Task AtualizarAsync(Guid id, Conta conta, Guid usuarioId)
        {
            var existente = await _context.Contas.FindAsync(id)
                ?? throw new KeyNotFoundException("Conta não encontrada.");

            if (existente.UsuarioIdProprietario != usuarioId)
                throw new ForbiddenAccessException("Você não tem permissão para atualizar esta conta.");

            if (existente.IsCarteira)
                throw new InvalidOperationException("A carteira não pode ser editada.");

            if (string.IsNullOrWhiteSpace(conta.Nome))
                throw new ArgumentException("Nome é obrigatório.");

            ValidarFormato(conta);

            existente.Nome = conta.Nome;
            existente.NumeroConta = conta.NumeroConta;
            existente.Agencia = conta.Agencia;
            existente.Tipo = conta.Tipo;
            existente.TipoCartao = conta.TipoCartao;
            existente.BancoId = conta.BancoId;
            existente.IsCarteira = conta.IsCarteira;

            await _context.SaveChangesAsync();
        }

        public async Task DeletarAsync(Guid id, Guid usuarioId)
        {
            var conta = await _context.Contas.FindAsync(id)
                ?? throw new KeyNotFoundException("Conta não encontrada.");

            if (conta.UsuarioIdProprietario != usuarioId)
                throw new ForbiddenAccessException("Você não tem permissão para deletar esta conta.");

            if (conta.IsCarteira)
                throw new InvalidOperationException("A carteira não pode ser deletada.");

            _context.Contas.Remove(conta);
            await _context.SaveChangesAsync();
        }
    }
}
