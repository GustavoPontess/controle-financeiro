using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.DinheiroDoMes;
using ControleFinanceiro.Api.DTOs.Emprestimo;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// A resposta do topo de Empréstimos (docs/features/respostas/visao.md; desenho aprovado pelo Gustavo em 2026-10-19):
/// o que vence nos próximos <see cref="DiasAFrente"/> dias, dos dois lados, e se o saldo nas contas cobre o que a pessoa
/// devolve. Inclui o que já venceu e ainda não voltou/foi devolvido. Só leitura (não aplica multa nem grava nada).
/// Linguagem de fato, sem cobrança (memória "copy sensível"): "você devolve", "volta pra você", "venceu e ainda não voltou".
/// </summary>
public class ProximosEmprestimosService
{
    public const int DiasAFrente = 30;

    private readonly AppDbContext _context;

    public ProximosEmprestimosService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<ProximosEmprestimosDto> CalcularAsync(Guid usuarioId, DateOnly hoje)
    {
        var ate = hoje.AddDays(DiasAFrente).ToDateTime(TimeOnly.MaxValue);
        var emprestimos = await _context.Emprestimos.AsNoTracking()
            .Include(e => e.Parcelas)
            .Include(e => e.Banco)
            .Where(e => e.Ativo && !e.Quitado && (e.CriadoPor == usuarioId
                || (e.ContraparteUsuarioId == usuarioId && e.StatusVinculo == StatusVinculoEmprestimo.Vinculado)))
            .ToListAsync();
        var idsCriadores = emprestimos.Where(e => e.CriadoPor != usuarioId).Select(e => e.CriadoPor).Distinct().ToList();
        var nomes = await _context.Usuarios.Where(u => idsCriadores.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Nome);

        var devolver = new List<VencimentoEmprestimoDto>();
        var voltar = new List<VencimentoEmprestimoDto>();
        var hojeDia = hoje.ToDateTime(TimeOnly.MinValue);
        foreach (var e in emprestimos)
        {
            // O nome que a pessoa deu ("Itaú", "João"); o do catálogo de bancos é razão social, só reserva.
            var quem = e.CriadoPor == usuarioId ? e.Pessoa : nomes.GetValueOrDefault(e.CriadoPor, e.Pessoa);
            if (string.IsNullOrWhiteSpace(quem)) quem = e.Banco?.Nome ?? "Empréstimo";
            var lado = EmprestouPraMim(e, usuarioId) ? devolver : voltar;
            if (e.FormaPagamento == FormaPagamentoEmprestimo.Parcelado)
            {
                foreach (var p in e.Parcelas.Where(p => p.Status == StatusParcelaEmprestimo.Pendente && p.DataVencimento <= ate))
                {
                    var falta = EmprestimoService.RestanteDaParcela(p);
                    if (falta > 0)
                        lado.Add(new VencimentoEmprestimoDto(e.Id, quem, e.Descricao, p.DataVencimento.Date, falta,
                            p.DataVencimento.Date < hojeDia, p.Numero, p.QuantidadeTotal));
                }
            }
            else if (e.DataVencimento is { } venc && venc <= ate)
            {
                var falta = EmprestimoService.RestanteAVista(e);
                if (falta > 0)
                    lado.Add(new VencimentoEmprestimoDto(e.Id, quem, e.Descricao, venc.Date, falta, venc.Date < hojeDia, null, null));
            }
        }
        devolver = devolver.OrderBy(v => v.Data).ThenBy(v => v.Quem).ToList();
        voltar = voltar.OrderBy(v => v.Data).ThenBy(v => v.Quem).ToList();

        // Saldo nas contas da pessoa (fora caixinha de meta e conta encerrada): o dinheiro que dá pra devolver hoje.
        var contas = await _context.Contas.AsNoTracking()
            .Where(c => c.UsuarioIdProprietario == usuarioId && c.Tipo != TipoConta.Caixinha && c.EncerradaEm == null)
            .Select(c => c.Id).ToListAsync();
        var saldo = (await RegrasFinanceiras.SaldosDasContasAsync(_context, contas, usuarioId)).Values.Sum(m => m.Saldo);

        return new ProximosEmprestimosDto(Responder(devolver, voltar, saldo), devolver, voltar, saldo);
    }

    /// <summary>A pessoa pegou o dinheiro (é ela quem devolve): criou como "Peguei" ou é a contraparte de um "Emprestei".</summary>
    private static bool EmprestouPraMim(Emprestimo e, Guid usuarioId) =>
        e.CriadoPor == usuarioId ? e.Tipo == TipoEmprestimo.PeguiEmprestado : e.Tipo == TipoEmprestimo.Emprestei;

    public static RespostaDto? Responder(List<VencimentoEmprestimoDto> devolver, List<VencimentoEmprestimoDto> voltar, decimal saldo)
    {
        if (devolver.Count == 0 && voltar.Count == 0) return null;
        var partes = new List<string>();
        var tom = "neutro";
        if (devolver.Count > 0)
        {
            var total = devolver.Sum(v => v.Valor);
            if (saldo >= total)
            {
                partes.Add($"Nos próximos 30 dias você devolve {Reais.Formatar(total)}, e o saldo nas contas cobre.");
                tom = devolver.Any(v => v.Venceu) ? "alerta" : "positivo";
            }
            else
            {
                partes.Add($"Nos próximos 30 dias você devolve {Reais.Formatar(total)}, e o saldo nas contas hoje é " +
                           $"{Reais.Formatar(saldo)}: faltam {Reais.Formatar(total - Math.Max(0m, saldo))}.");
                tom = "alerta";
            }
        }
        if (voltar.Count > 0)
        {
            var total = voltar.Sum(v => v.Valor);
            var venceu = voltar.Where(v => v.Venceu).Sum(v => v.Valor);
            partes.Add(venceu > 0
                ? $"Volta {Reais.Formatar(total)} pra você, {Reais.Formatar(venceu)} disso já venceu."
                : $"Volta {Reais.Formatar(total)} pra você.");
        }
        return new RespostaDto(tom, string.Join(" ", partes), []);
    }
}
