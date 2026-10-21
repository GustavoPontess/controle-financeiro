namespace ControleFinanceiro.Api.Infrastructure;

/// <summary>
/// "Hoje" do app = o dia no Brasil, nunca o dia UTC (regra única, 2026-10-21). Com o dia UTC, das 21h à meia-noite
/// de Brasília o servidor já estava no dia seguinte: aceitava lançamento efetivado com a data de amanhã, cobrava a
/// conta fixa de amanhã e via vencido o que vence hoje. Carimbo de quando algo aconteceu (CriadoEm, AtualizadoEm,
/// expiração de token) continua em UTC: isso aqui é só pra decidir QUE DIA é.
/// Brasília é UTC−3 fixo: o Brasil não tem horário de verão desde 2019. Não usa TimeZoneInfo (a imagem alpine de
/// produção pode vir sem a base de fusos).
/// </summary>
public static class HorarioBrasil
{
    /// <summary>Fuso de Brasília.</summary>
    public static readonly TimeSpan Fuso = TimeSpan.FromHours(-3);

    /// <summary>A hora de parede em Brasília agora (Kind Unspecified, como as datas do app).</summary>
    public static DateTime Agora() => DeUtc(DateTime.UtcNow);

    /// <summary>Hoje em Brasília.</summary>
    public static DateOnly Hoje() => DateOnly.FromDateTime(Agora());

    /// <summary>Hoje em Brasília à meia-noite, pra quem compara com DateTime.</summary>
    public static DateTime HojeData() => Agora().Date;

    /// <summary>Um instante UTC na hora de parede de Brasília.</summary>
    public static DateTime DeUtc(DateTime utc) => DateTime.SpecifyKind(utc + Fuso, DateTimeKind.Unspecified);

    /// <summary>
    /// O dia MAIS CEDO no Brasil agora (Acre, UTC−5). Só pra checagem que não pode ser mais estrita que o formulário,
    /// que usa o dia local de quem usa (ex.: a fatura mais antiga que ainda aceita parcela). Pra "que dia é hoje",
    /// <see cref="Hoje"/>.
    /// </summary>
    public static DateTime DiaMaisCedo(DateTime utc) => utc.AddHours(-5).Date;
}
