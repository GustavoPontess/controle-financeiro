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
        private readonly FinancialEventLogService _eventLog;

        // Só dígitos (agência não tem dígito verificador na maioria dos bancos BR).
        private static readonly Regex AgenciaRegex = new(@"^\d{1,10}$", RegexOptions.Compiled);
        // Dígitos, com dígito verificador opcional separado por hífen (ex: 91205195-5).
        private static readonly Regex NumeroContaRegex = new(@"^\d{1,20}(-\d)?$", RegexOptions.Compiled);

        public ContaService(AppDbContext context, FinancialEventLogService eventLog)
        {
            _context = context;
            _eventLog = eventLog;
        }

        public const string MensagemCaixinha = Conta.MensagemCaixinha;

        /// <summary>O que a pessoa cria em Bancos. Cartão (3) e Empréstimo (5) são legado com entidade própria;
        /// Caixinha (7) nasce com a meta.</summary>
        private static readonly HashSet<TipoConta> TiposPermitidos =
            [TipoConta.ContaCorrente, TipoConta.ContaPoupanca, TipoConta.Dinheiro, TipoConta.Investimento];

        private static void ValidarFormato(Conta conta)
        {
            if (!TiposPermitidos.Contains(conta.Tipo))
                throw new ArgumentException("Tipo de conta inválido. Use conta corrente, poupança, dinheiro ou investimentos.");

            if (!string.IsNullOrWhiteSpace(conta.Agencia) && !AgenciaRegex.IsMatch(conta.Agencia))
                throw new ArgumentException("Agência deve conter só números (até 10 dígitos).");

            if (!string.IsNullOrWhiteSpace(conta.NumeroConta) && !NumeroContaRegex.IsMatch(conta.NumeroConta))
                throw new ArgumentException("Número da conta deve conter só números, com dígito verificador opcional após um hífen (ex: 91205195-5).");
        }

        // Sem Include(Transacoes): o saldo não é mais somado em memória sobre o histórico inteiro
        // da conta — vem agregado no banco por ObterSaldosAsync (RegrasFinanceiras).
        /// <summary>Contas do usuário. Encerradas ficam fora (listas e seleções), salvo <paramref name="incluirEncerradas"/>.</summary>
        public async Task<List<Conta>> ListarAsync(Guid usuarioId, bool incluirEncerradas = false)
        {
            return await _context.Contas
                .Where(c => c.UsuarioIdProprietario == usuarioId && (incluirEncerradas || c.EncerradaEm == null))
                .Include(c => c.Banco)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<Conta?> BuscarPorIdAsync(Guid id, Guid usuarioId)
        {
            return await _context.Contas
                .Where(c => c.Id == id && c.UsuarioIdProprietario == usuarioId)
                .Include(c => c.Banco)
                .FirstOrDefaultAsync();
        }

        /// <summary>
        /// Saldo real (Ativo + Executado) das contas do usuário, agregado no banco pela regra única
        /// de <see cref="RegrasFinanceiras"/> — o mesmo número do dashboard e da validação de saldo
        /// do pagamento de parcela. Conta sem lançamento volta com saldo zero.
        /// </summary>
        public Task<Dictionary<Guid, RegrasFinanceiras.MovimentoConta>> ObterSaldosAsync(
            IEnumerable<Guid> contaIds, Guid usuarioId) =>
            RegrasFinanceiras.SaldosDasContasAsync(_context, contaIds, usuarioId);

        public async Task<Conta> CriarAsync(Conta conta, Guid usuarioId, decimal saldoInicial = 0, DateTime? dataSaldoInicial = null)
        {
            if (string.IsNullOrWhiteSpace(conta.Nome))
                throw new ArgumentException("Nome é obrigatório.");

            if (conta.Nome.Length > 100)
                throw new ArgumentException("Nome deve ter no máximo 100 caracteres.");

            if (saldoInicial < 0)
                throw new ArgumentException("Saldo inicial não pode ser negativo.");

            // Ponto de partida da conta: início do dia escolhido (default hoje). Carimbar no começo do
            // dia deixa o baseline da reconciliação ANTES dos lançamentos daquele dia e permite saldo
            // inicial retroativo (ex.: "tenho X desde 01/09"). Não pode ser no futuro.
            var dataAbertura = DateOnly.FromDateTime(dataSaldoInicial ?? DateTime.UtcNow);
            if (dataAbertura > DateOnly.FromDateTime(DateTime.UtcNow))
                throw new ArgumentException("A data do saldo inicial não pode ser futura.");

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
                    Data = dataAbertura,
                    Hora = null, // saldo inicial é datado (sem hora)
                    EhSaldoInicial = true
                });
            }

            await _context.SaveChangesAsync();
            return conta;
        }

        /// <summary>
        /// Edita o saldo inicial (ponto de partida) da conta: atualiza a transação <c>EhSaldoInicial</c>
        /// (valor + data) ou cria uma se não existir. Dinheiro → valida dono (UsuarioId), valor &gt; 0 e
        /// data não futura, e registra no <see cref="FinancialEventLog"/> (muda o saldo). Começo do dia.
        /// </summary>
        /// <summary>Saldo inicial vivo (valor e dia) por conta; conta sem ponto de partida não entra no dicionário.</summary>
        public async Task<Dictionary<Guid, (decimal Valor, DateOnly Data)>> ObterSaldosIniciaisAsync(IEnumerable<Guid> contaIds, Guid usuarioId)
        {
            var ids = contaIds.Distinct().ToList();
            if (ids.Count == 0) return new();
            return await _context.Transacoes
                .Where(t => t.ContaId != null && ids.Contains(t.ContaId.Value) && t.EhSaldoInicial && t.Ativo && t.CriadoPor == usuarioId)
                .Select(t => new { ContaId = t.ContaId!.Value, t.Valor, t.Data })
                .ToDictionaryAsync(t => t.ContaId, t => (t.Valor, t.Data));
        }

        /// <summary>
        /// Edita o ponto de partida da conta. Valor zero = a conta começou do zero: o lançamento de saldo inicial
        /// que existir é cancelado (soft delete, com evento) — nunca apagado.
        /// </summary>
        public async Task AtualizarSaldoInicialAsync(Guid contaId, Guid usuarioId, decimal valor, DateOnly? data)
        {
            var conta = await _context.Contas
                .FirstOrDefaultAsync(c => c.Id == contaId && c.UsuarioIdProprietario == usuarioId)
                ?? throw new KeyNotFoundException("Conta não encontrada.");

            if (conta.Tipo == TipoConta.Caixinha)
                throw new InvalidOperationException(MensagemCaixinha);
            if (valor < 0)
                throw new ArgumentException("Saldo inicial não pode ser negativo.");

            var existente = await _context.Transacoes
                .FirstOrDefaultAsync(t => t.ContaId == contaId && t.EhSaldoInicial && t.Ativo);

            var correlationId = Guid.NewGuid();
            if (valor == 0)
            {
                if (existente == null) return; // já começa do zero
                existente.Ativo = false;
                _eventLog.Registrar(
                    usuarioId: usuarioId,
                    tipo: FinancialEventType.TransacaoCancelada,
                    entidade: "Transacao",
                    entidadeId: existente.Id,
                    correlationId: correlationId,
                    origemAcao: "API",
                    valorAntes: existente.Valor,
                    valorDepois: 0m,
                    payload: new { motivo = "saldo_inicial_zerado", contaId });
                await _context.SaveChangesAsync();
                return;
            }

            // Data: a informada, ou mantém a atual, ou hoje se for novo. Nunca futura.
            var dataAbertura = data ?? existente?.Data ?? DateOnly.FromDateTime(DateTime.UtcNow);
            if (dataAbertura > DateOnly.FromDateTime(DateTime.UtcNow))
                throw new ArgumentException("A data do saldo inicial não pode ser futura.");

            if (existente != null)
            {
                var valorAntes = existente.Valor;
                existente.Valor = valor;
                existente.Data = dataAbertura;
                existente.Hora = null;
                _eventLog.Registrar(
                    usuarioId: usuarioId,
                    tipo: FinancialEventType.TransacaoAtualizada,
                    entidade: "Transacao",
                    entidadeId: existente.Id,
                    correlationId: correlationId,
                    origemAcao: "API",
                    valorAntes: valorAntes,
                    valorDepois: valor,
                    payload: new { motivo = "saldo_inicial", contaId });
            }
            else
            {
                var nova = new Transacao
                {
                    Id = Guid.NewGuid(),
                    Descricao = "Saldo Inicial",
                    Valor = valor,
                    Tipo = TipoTransacao.Receita,
                    ContaId = contaId,
                    CategoriaId = null,
                    CriadoPor = usuarioId,
                    Data = dataAbertura,
                    Hora = null, // saldo inicial é datado (sem hora)
                    EhSaldoInicial = true
                };
                _context.Transacoes.Add(nova);
                _eventLog.Registrar(
                    usuarioId: usuarioId,
                    tipo: FinancialEventType.TransacaoCriada,
                    entidade: "Transacao",
                    entidadeId: nova.Id,
                    correlationId: correlationId,
                    origemAcao: "API",
                    valorAntes: 0m,
                    valorDepois: valor,
                    payload: new { motivo = "saldo_inicial", contaId });
            }

            await _context.SaveChangesAsync();
        }

        public async Task AtualizarAsync(Guid id, Conta conta, Guid usuarioId)
        {
            var existente = await _context.Contas.FindAsync(id)
                ?? throw new KeyNotFoundException("Conta não encontrada.");

            if (existente.UsuarioIdProprietario != usuarioId)
                throw new ForbiddenAccessException("Você não tem permissão para atualizar esta conta.");

            if (existente.IsCarteira)
                throw new InvalidOperationException("A carteira não pode ser editada.");
            if (existente.Tipo == TipoConta.Caixinha)
                throw new InvalidOperationException(MensagemCaixinha);

            if (string.IsNullOrWhiteSpace(conta.Nome))
                throw new ArgumentException("Nome é obrigatório.");

            ValidarFormato(conta);

            existente.Nome = conta.Nome;
            existente.NumeroConta = conta.NumeroConta;
            existente.Agencia = conta.Agencia;
            existente.Tipo = conta.Tipo;
            existente.TipoCartao = conta.TipoCartao;
            existente.BancoId = conta.BancoId;
            // IsCarteira é só a conta padrão do cadastro — nunca muda por edição (nem virando "Dinheiro").

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
            if (conta.Tipo == TipoConta.Caixinha)
                throw new InvalidOperationException(MensagemCaixinha);

            // Conta com histórico não sai: o Conta → Transacoes era cascade, e excluir apagava todos os
            // lançamentos dela (inclusive os já cancelados), sem trilha — some do saldo, dos relatórios e
            // da auditoria (P1, achado 2026-09-27). Só a abertura (saldo inicial) não conta como histórico:
            // nasce com a conta e sai junto. Conta fixa que usa a conta (em qualquer situação) também segura.
            var temLancamento = await _context.Transacoes.IgnoreQueryFilters()
                .AnyAsync(t => t.ContaId == id && !t.EhSaldoInicial);
            if (temLancamento)
                throw new InvalidOperationException(
                    "Esta conta tem lançamentos e não pode ser excluída: o histórico dela entra no saldo e nos relatórios. Encerre a conta em vez de excluir.");
            if (await _context.Recorrentes.AnyAsync(r => r.ContaId == id))
                throw new InvalidOperationException(
                    "Uma conta fixa usa esta conta. Troque a conta dela (ou exclua a conta fixa) antes de excluir a conta.");

            var aberturas = await _context.Transacoes.IgnoreQueryFilters().Where(t => t.ContaId == id).ToListAsync();
            _context.Transacoes.RemoveRange(aberturas);
            // Cartão que pagava a fatura por esta conta continua — só perde a conta vinculada.
            var cartoes = await _context.CartoesCredito.Where(c => c.ContaId == id).ToListAsync();
            foreach (var c in cartoes) c.ContaId = null;

            _context.Contas.Remove(conta);
            await _context.SaveChangesAsync();
        }
    }
}
