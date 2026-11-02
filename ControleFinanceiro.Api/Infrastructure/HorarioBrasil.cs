namespace ControleFinanceiro.Api.Infrastructure;

/// <summary>
/// "Hoje" do app = o dia no fuso da PESSOA, nunca o dia UTC (regra única, 2026-10-21; fuso da conta, 2026-11-02).
/// Com o dia UTC, das 21h à meia-noite de Brasília o servidor já estava no dia seguinte: aceitava lançamento efetivado
/// com a data de amanhã, cobrava a conta fixa de amanhã e via vencido o que vence hoje. Carimbo de quando algo
/// aconteceu (CriadoEm, AtualizadoEm, expiração de token) continua em UTC: isso aqui é só pra decidir QUE DIA é.
/// O fuso é o da conta (<c>Usuario.FusoHorario</c>, nome IANA, ex. "America/Rio_Branco"), preenchido sozinho pelo
/// aparelho; o <see cref="FusoDaPessoaMiddleware"/> põe o da pessoa logada em cada requisição (<see cref="UsarFuso"/>).
/// Sem fuso (conta antiga, job sem pessoa, fuso desconhecido) vale Brasília, UTC−3 fixo (o Brasil não tem horário de
/// verão desde 2019), sem depender da base de fusos do sistema.
/// </summary>
public static class HorarioBrasil
{
    /// <summary>Fuso de Brasília (o padrão de quem ainda não tem fuso na conta).</summary>
    public static readonly TimeSpan Fuso = TimeSpan.FromHours(-3);

    // Relógio de onde sai "agora" (regra de hora, 2026-11-01): em produção, o do sistema; teste fixa com
    // FixarParaTeste() pra não depender do dia em que roda (a virada do dia/mês em UTC, às 21h de Brasília, quebrava
    // teste). AsyncLocal: cada teste, e o que ele chama mesmo depois de await, vê o próprio relógio, sem vazar pros
    // testes que rodam em paralelo.
    private static readonly AsyncLocal<TimeProvider?> RelogioDoTeste = new();

    // O fuso da pessoa desta requisição (ou do pedaço de job que trata dela). AsyncLocal pelo mesmo motivo: vale pro
    // que ela chama, também depois de await, e não vaza pra requisição ao lado.
    private static readonly AsyncLocal<TimeZoneInfo?> FusoDaPessoa = new();

    /// <summary>O relógio do app (o do sistema, ou o fixado pelo teste).</summary>
    public static TimeProvider Relogio => RelogioDoTeste.Value ?? TimeProvider.System;

    /// <summary>
    /// Só pra teste: "agora" vira este instante UTC até o Dispose (<c>using var _ = HorarioBrasil.FixarParaTeste(...)</c>).
    /// Muda o que <see cref="Agora"/>, <see cref="Hoje"/> e <see cref="HojeData"/> respondem; carimbos (CriadoEm) seguem
    /// o relógio de verdade.
    /// </summary>
    public static IDisposable FixarParaTeste(DateTime agoraUtc)
    {
        var anterior = RelogioDoTeste.Value;
        RelogioDoTeste.Value = new RelogioFixo(DateTime.SpecifyKind(agoraUtc, DateTimeKind.Utc));
        return new Restaurar(() => RelogioDoTeste.Value = anterior);
    }

    /// <summary>
    /// "Hoje" passa a ser o do fuso <paramref name="iana"/> até o Dispose (<c>using var _ = HorarioBrasil.UsarFuso(f)</c>).
    /// Fuso vazio ou desconhecido = Brasília. Quem usa: o middleware (pessoa logada) e o teste.
    /// </summary>
    public static IDisposable UsarFuso(string? iana)
    {
        var anterior = FusoDaPessoa.Value;
        FusoDaPessoa.Value = Resolver(iana);
        return new Restaurar(() => FusoDaPessoa.Value = anterior);
    }

    /// <summary>O fuso pelo nome IANA ("America/Manaus"); null se vazio ou se o sistema não conhece.</summary>
    public static TimeZoneInfo? Resolver(string? iana) =>
        !string.IsNullOrWhiteSpace(iana) && TimeZoneInfo.TryFindSystemTimeZoneById(iana.Trim(), out var tz) ? tz : null;

    private sealed class RelogioFixo(DateTime agoraUtc) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(agoraUtc, TimeSpan.Zero);
    }

    private sealed class Restaurar(Action acao) : IDisposable
    {
        public void Dispose() => acao();
    }

    /// <summary>A hora de parede da pessoa agora (Kind Unspecified, como as datas do app).</summary>
    public static DateTime Agora() => DeUtc(Relogio.GetUtcNow().UtcDateTime);

    /// <summary>Hoje no fuso da pessoa.</summary>
    public static DateOnly Hoje() => DateOnly.FromDateTime(Agora());

    /// <summary>Hoje no fuso da pessoa à meia-noite, pra quem compara com DateTime.</summary>
    public static DateTime HojeData() => Agora().Date;

    /// <summary>Um instante UTC na hora de parede da pessoa (Brasília sem fuso na conta).</summary>
    public static DateTime DeUtc(DateTime utc) => FusoDaPessoa.Value is { } tz
        ? DateTime.SpecifyKind(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), tz), DateTimeKind.Unspecified)
        : DateTime.SpecifyKind(utc + Fuso, DateTimeKind.Unspecified);

    /// <summary>
    /// O "hoje" que um job diário das <paramref name="horaLocal"/> veria agora no <paramref name="fuso"/> (2026-11-02). Os
    /// jobs de fatura e de conta fixa rodam de hora em hora e tratam cada pessoa no horário local dela, como se rodassem
    /// uma vez por dia na casa dela: antes da hora do job, ainda é o dia de ontem pra ele. Ex.: o fechamento (23h) às 22h
    /// do dia 10 vê o dia 9; às 23h, o dia 10. Fuso vazio ou desconhecido = Brasília.
    /// </summary>
    public static DateTime HojeDoJob(string? fuso, TimeSpan horaLocal)
    {
        using var _ = UsarFuso(fuso);
        return Agora().Add(TimeSpan.FromDays(1) - horaLocal).Date.AddDays(-1);
    }

    /// <summary>
    /// O dia MAIS CEDO no Brasil agora (Acre, UTC−5). Só pra checagem que não pode ser mais estrita que o formulário,
    /// que usa o dia local de quem usa (ex.: a fatura mais antiga que ainda aceita parcela). Pra "que dia é hoje",
    /// <see cref="Hoje"/>.
    /// </summary>
    public static DateTime DiaMaisCedo(DateTime utc) => utc.AddHours(-5).Date;
}
