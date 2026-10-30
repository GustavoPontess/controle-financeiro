namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>Onde a solicitação está. Quem mandou vê o status em "Minhas solicitações"; quem muda é o admin.</summary>
public enum StatusSolicitacao
{
    Recebida = 0,
    NoBacklog = 1,
    Feita = 2,
    NaoVamosFazer = 3,
}
