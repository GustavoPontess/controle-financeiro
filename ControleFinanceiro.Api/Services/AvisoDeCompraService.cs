using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.DinheiroDoMes;
using ControleFinanceiro.Api.DTOs.Transacao;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// "Se fizer essa compra, falta pra conta X" (decisão do Gustavo, 2026-10-19; docs/features/respostas/visao.md):
/// antes de salvar uma compra, o formulário pergunta aqui se ela tira o dinheiro das contas fixas que vêm nos
/// próximos <see cref="DiasAFrente"/> dias. No cartão olha o LIMITE (e as cobranças de conta fixa que não passaram
/// por falta dele, que o app tenta de novo); na conta, o SALDO (com o que ainda entra previsto antes de cada uma).
/// Só avisa, não trava (a trava do limite é <see cref="RegrasFinanceiras.ExigirLimiteDisponivelAsync"/>). A conta e
/// as frases moram aqui; o front só mostra: a frase curta, as contas uma por linha e o saldo/limite de hoje.
/// </summary>
public class AvisoDeCompraService
{
    public const int DiasAFrente = 30;

    private readonly AppDbContext _context;

    public AvisoDeCompraService(AppDbContext context)
    {
        _context = context;
    }

    private sealed record Previsto(Guid TransacaoId, Guid? ContaFixaId, string Descricao, DateOnly Data, Guid? CategoriaId,
        decimal Valor, bool Entra);

    /// <summary>O aviso ou null quando a compra não aperta nada.</summary>
    public async Task<AvisoDeCompraDto?> AvisarAsync(Guid usuarioId, decimal valor, Guid? contaId, Guid? cartaoId, DateOnly hoje)
    {
        if (valor <= 0) return null;
        if (contaId.HasValue == cartaoId.HasValue)
            throw new ArgumentException("Informe uma conta ou um cartão de crédito.");
        var ate = hoje.AddDays(DiasAFrente);

        if (cartaoId is { } idCartao)
        {
            await DonoRecursos.ExigirCartaoAsync(_context, idCartao, usuarioId);
            var cartao = await _context.CartoesCredito.AsNoTracking().FirstAsync(c => c.Id == idCartao);
            var disponivel = RegrasFinanceiras.LimiteDisponivel(cartao.LimiteTotal ?? 0m,
                await RegrasFinanceiras.LimiteUsadoDoCartaoAsync(_context, idCartao, usuarioId));
            var limiteHoje = $"Limite disponível hoje: {Reais.Formatar(disponivel)}.";
            if (disponivel < valor)
                return new AvisoDeCompraDto("negativo", $"Não cabe no limite do cartão {cartao.Nome}.", limiteHoje, []);

            // Contas fixas do cartão que ainda vão cobrar (inclusive a que não passou por falta de limite).
            var vem = await _context.Transacoes.AsNoTracking()
                .Where(t => t.CartaoCreditoId == idCartao && t.ContaId == null && t.Ativo && t.Tipo == TipoTransacao.Despesa
                            && t.StatusTransacao == StatusTransacao.Previsao && t.RecorrenteOrigemId != null && t.Data <= ate)
                .Where(t => _context.Recorrentes.Any(r => r.Id == t.RecorrenteOrigemId
                                                          && r.Ativo && r.CanceladoEm == null && r.ExcluidoEm == null))
                .OrderBy(t => t.Data).ThenBy(t => t.Descricao)
                .Select(t => new Previsto(t.Id, t.RecorrenteOrigemId, t.Descricao, t.Data, t.CategoriaId, t.Valor, false))
                .ToListAsync();
            var faltam = Faltam(disponivel - valor, vem);
            return faltam.Count == 0 ? null
                : new AvisoDeCompraDto("alerta", $"Se fizer essa compra, falta limite no cartão {cartao.Nome} pra:", limiteHoje, Itens(faltam));
        }

        var idConta = contaId!.Value;
        await DonoRecursos.ExigirContaAsync(_context, idConta, usuarioId);
        var conta = await _context.Contas.AsNoTracking().FirstAsync(c => c.Id == idConta);
        var saldo = (await RegrasFinanceiras.SaldoDaContaAsync(_context, idConta, usuarioId)).Saldo;
        // O que está previsto na conta daqui pra frente (contas fixas e o que ainda entra), na ordem dos dias;
        // no mesmo dia, o que entra vem antes do que sai.
        var previstos = await _context.Transacoes.AsNoTracking()
            .Where(t => t.ContaId == idConta && t.Ativo && t.StatusTransacao == StatusTransacao.Previsao
                        && t.Data >= hoje && t.Data <= ate)
            .Where(RegrasFinanceiras.EntraNoResultado)
            .Select(t => new Previsto(t.Id, t.RecorrenteOrigemId, t.Descricao, t.Data, t.CategoriaId, t.Valor, t.Tipo == TipoTransacao.Receita))
            .ToListAsync();
        var naOrdem = previstos.OrderBy(p => p.Data).ThenByDescending(p => p.Entra).ThenBy(p => p.Descricao).ToList();
        var semSaldo = Faltam(saldo - valor, naOrdem);
        return semSaldo.Count == 0 ? null
            : new AvisoDeCompraDto("alerta", $"Se fizer essa compra, falta saldo na conta {conta.Nome} pra:",
                $"Saldo da conta hoje: {Reais.Formatar(saldo)}.", Itens(semSaldo));
    }

    // Anda pelos dias: o que entra soma; o que sai e cabe desconta; o que não cabe vai pra lista (e não desconta).
    private static List<Previsto> Faltam(decimal sobra, IEnumerable<Previsto> previstos)
    {
        var faltam = new List<Previsto>();
        foreach (var p in previstos)
        {
            if (p.Entra) sobra += p.Valor;
            else if (sobra >= p.Valor) sobra -= p.Valor;
            else faltam.Add(p);
        }
        return faltam;
    }

    private static List<AindaVemDto> Itens(List<Previsto> faltam) =>
        faltam.Select(p => new AindaVemDto(p.TransacaoId, p.ContaFixaId, p.Descricao, p.Data, p.CategoriaId, "", p.Valor)).ToList();
}
