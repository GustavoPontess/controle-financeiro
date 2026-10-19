using ControleFinanceiro.Api.DTOs.DinheiroDoMes;

namespace ControleFinanceiro.Api.DTOs.Transacao;

/// <summary>
/// Aviso antes de salvar uma compra: a frase curta (<c>Texto</c>), as contas que ficam sem dinheiro (<c>Itens</c>, uma
/// por linha, da mais perto pra mais longe) e o dado de hoje que explica (<c>Detalhe</c>: saldo da conta ou limite
/// disponível do cartão). Tom "alerta" (falta pra conta que vem) ou "negativo" (a compra nem cabe no limite).
/// </summary>
public record AvisoDeCompraDto(string Tom, string Texto, string Detalhe, List<AindaVemDto> Itens);
