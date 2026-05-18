namespace ControleFinanceiro.Api.DTOs.Onboarding;

/// <summary>Checklist do onboarding — tudo computado, exceto `Concluido`.</summary>
public record OnboardingStatusDto(
    bool Concluido,
    bool TemConta,
    bool TemCartao,
    bool TemTransacao,
    bool TemFamilia);
