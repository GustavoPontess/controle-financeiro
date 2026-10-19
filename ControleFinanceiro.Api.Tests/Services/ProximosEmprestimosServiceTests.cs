using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Topo de Empréstimos (desenho aprovado pelo Gustavo, 2026-10-19): o que vence nos próximos 30 dias, dos dois lados,
/// com o que já venceu e ainda falta, e se o saldo nas contas cobre o que a pessoa devolve. Linguagem de fato.
/// </summary>
public class ProximosEmprestimosServiceTests
{
    private static readonly DateOnly Hoje = new(2026, 10, 19);
    private static DateTime Dia(int mes, int dia) => new(2026, mes, dia, 12, 0, 0, DateTimeKind.Utc);

    private sealed record Cenario(AppDbContext Ctx, Guid U, Guid Outro);

    private static Cenario Build(decimal saldo)
    {
        var ctx = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var u = new Usuario { Id = Guid.NewGuid(), Email = "u@t.com", Nome = "Gustavo", PasswordHash = "x" };
        var outro = new Usuario { Id = Guid.NewGuid(), Email = "p@t.com", Nome = "Pedro", PasswordHash = "x" };
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Nubank", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = u.Id };
        var caixinha = new Conta { Id = Guid.NewGuid(), Nome = "Meta", Tipo = TipoConta.Caixinha, UsuarioIdProprietario = u.Id };
        ctx.Usuarios.AddRange(u, outro);
        ctx.Contas.AddRange(conta, caixinha);
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Salário", Valor = saldo, Tipo = TipoTransacao.Receita, ContaId = conta.Id,
            CriadoPor = u.Id, Data = new DateOnly(2026, 10, 5),
        });
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Guardado", Valor = 5000m, Tipo = TipoTransacao.Receita, ContaId = caixinha.Id,
            CriadoPor = u.Id, Data = new DateOnly(2026, 10, 6), EhTransferencia = true,
        });
        using (ctx.LiberarCaixinha())
            ctx.SaveChanges();
        return new Cenario(ctx, u.Id, outro.Id);
    }

    private static Emprestimo Emprestimo(Cenario c, string pessoa, TipoEmprestimo tipo, decimal total, DateTime? vencimento = null,
        Guid? criadoPor = null)
    {
        var e = new Emprestimo
        {
            Id = Guid.NewGuid(), Descricao = $"Com {pessoa}", Pessoa = pessoa, ValorTotal = total, Tipo = tipo,
            DataInicio = Dia(5, 1), DataVencimento = vencimento, CriadoPor = criadoPor ?? c.U,
        };
        c.Ctx.Emprestimos.Add(e);
        c.Ctx.SaveChanges();
        return e;
    }

    private static void Parcelas(Cenario c, Emprestimo e, decimal valor, params (DateTime Venc, StatusParcelaEmprestimo Status)[] parcelas)
    {
        e.FormaPagamento = FormaPagamentoEmprestimo.Parcelado;
        var n = 1;
        foreach (var (venc, status) in parcelas)
            c.Ctx.Add(new EmprestimoParcela
            {
                Id = Guid.NewGuid(), EmprestimoId = e.Id, Numero = n++, QuantidadeTotal = parcelas.Length, DataVencimento = venc,
                Valor = valor, Status = status,
            });
        c.Ctx.SaveChanges();
    }

    private static Task<DTOs.Emprestimo.ProximosEmprestimosDto> Calcular(Cenario c) =>
        new ProximosEmprestimosService(c.Ctx).CalcularAsync(c.U, Hoje);

    [Fact]
    public async Task DosDoisLados_ComOQueJaVenceu_EOSaldoQueNaoCobre()
    {
        var c = Build(saldo: 380m);
        // Você emprestou ao João em 6x de R$ 300: 5 voltaram, a 6ª vence dia 25.
        var joao = Emprestimo(c, "João", TipoEmprestimo.Emprestei, 1800m);
        Parcelas(c, joao, 300m, (Dia(5, 25), StatusParcelaEmprestimo.Paga), (Dia(6, 25), StatusParcelaEmprestimo.Paga),
            (Dia(7, 25), StatusParcelaEmprestimo.Paga), (Dia(8, 25), StatusParcelaEmprestimo.Paga), (Dia(9, 25), StatusParcelaEmprestimo.Paga),
            (Dia(10, 25), StatusParcelaEmprestimo.Pendente));
        // Marina: à vista, venceu 10/9 e não voltou.
        Emprestimo(c, "Marina", TipoEmprestimo.Emprestei, 400m, Dia(9, 10));
        // Você pegou com a Ana, à vista até 20/10, e com o Itaú em 12x (a 4ª vence 5/11; a 5ª, 5/12, fica de fora dos 30 dias).
        Emprestimo(c, "Ana", TipoEmprestimo.PeguiEmprestado, 100m, Dia(10, 20));
        var itau = Emprestimo(c, "Itaú", TipoEmprestimo.PeguiEmprestado, 5040m);
        Parcelas(c, itau, 420m, (Dia(8, 5), StatusParcelaEmprestimo.Paga), (Dia(9, 5), StatusParcelaEmprestimo.Paga),
            (Dia(10, 5), StatusParcelaEmprestimo.Paga), (Dia(11, 5), StatusParcelaEmprestimo.Pendente), (Dia(12, 5), StatusParcelaEmprestimo.Pendente));
        // Quitado não aparece.
        var quitado = Emprestimo(c, "Bruno", TipoEmprestimo.Emprestei, 50m, Dia(10, 22));
        quitado.Quitado = true;
        c.Ctx.SaveChanges();

        var r = await Calcular(c);

        Assert.Equal(new[] { ("Ana", 100m, false, (int?)null), ("Itaú", 420m, false, (int?)4) },
            r.Devolver.Select(v => (v.Quem, v.Valor, v.Venceu, v.Parcela)));
        Assert.Equal(new[] { ("Marina", 400m, true), ("João", 300m, false) }, r.Voltar.Select(v => (v.Quem, v.Valor, v.Venceu)));
        Assert.Equal(380m, r.SaldoNasContas); // a caixinha da meta não conta
        Assert.Equal("alerta", r.Resposta!.Tom);
        Assert.Equal("Nos próximos 30 dias você devolve R$ 520,00, e o saldo nas contas hoje é R$ 380,00: faltam R$ 140,00. " +
                     "Volta R$ 700,00 pra você, R$ 400,00 disso já venceu.", r.Resposta.Texto.Replace(' ', ' '));
    }

    [Fact]
    public async Task VinculadoComoContraparte_OLadoSeInverte_EONomeEDoCriador()
    {
        var c = Build(saldo: 1000m);
        // Pedro criou "Emprestei" e eu aceitei o vínculo: pra mim é o que eu devolvo, com o nome do Pedro.
        var e = Emprestimo(c, "Gustavo", TipoEmprestimo.Emprestei, 250m, Dia(10, 30), criadoPor: c.Outro);
        e.ContraparteUsuarioId = c.U;
        e.StatusVinculo = StatusVinculoEmprestimo.Vinculado;
        c.Ctx.SaveChanges();

        var r = await Calcular(c);

        var v = Assert.Single(r.Devolver);
        Assert.Equal(("Pedro", 250m), (v.Quem, v.Valor));
        Assert.Empty(r.Voltar);
        Assert.Equal(("positivo", "Nos próximos 30 dias você devolve R$ 250,00, e o saldo nas contas cobre."),
            (r.Resposta!.Tom, r.Resposta.Texto.Replace(' ', ' ')));
    }

    [Fact]
    public async Task NadaVencendo_SemResposta_ConviteNaoAceitoNaoConta()
    {
        var c = Build(saldo: 0m);
        Emprestimo(c, "Longe", TipoEmprestimo.Emprestei, 100m, Dia(12, 30));
        var convite = Emprestimo(c, "Gustavo", TipoEmprestimo.Emprestei, 90m, Dia(10, 25), criadoPor: c.Outro);
        convite.ContraparteUsuarioId = c.U;
        convite.StatusVinculo = StatusVinculoEmprestimo.PendenteAceite;
        c.Ctx.SaveChanges();

        var r = await Calcular(c);

        Assert.Empty(r.Devolver);
        Assert.Empty(r.Voltar);
        Assert.Null(r.Resposta);
    }
}
