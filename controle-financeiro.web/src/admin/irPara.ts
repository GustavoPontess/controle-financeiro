// Sai do mini-app de admin pra uma página do app comum (login, Visão geral, Configurações). É outra página, não uma
// rota daqui: troca o endereço inteiro, sem deixar o endereço do admin no histórico.
export function irPara(endereco: string) {
  window.location.replace(endereco)
}
