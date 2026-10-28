namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Espera que dobra do login (<see cref="TentativasLogin"/>). Vira 429 com <c>Retry-After</c>, igual ao limite por IP,
/// e a tela mostra o contador. Mesma resposta com ou sem conta.
/// </summary>
public class MuitasTentativasException : Exception
{
    public int SegundosParaTentar { get; }

    public MuitasTentativasException(int segundosParaTentar)
        : base("Muitas tentativas. Espere o contador pra tentar de novo.") => SegundosParaTentar = segundosParaTentar;
}

/// <summary>Falta (ou não passou) a verificação "não sou robô". Vira 400 com code <c>VERIFICACAO_HUMANA</c>.</summary>
public class VerificacaoHumanaException : Exception
{
    public VerificacaoHumanaException() : base("Confirme que você não é um robô e tente de novo.") { }
}
