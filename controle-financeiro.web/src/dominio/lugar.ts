// O nome do lugar como o banco manda costuma vir TODO EM MAIÚSCULAS ("MERCADO BOM PRECO"). Na tela ele aparece
// legível ("Mercado Bom Preco"). É só o que se mostra: o que fica gravado no lançamento não muda. Código com número e
// sigla curta ficam como vieram (CPF e CNPJ também: o grupo separado por documento leva o documento no nome); nome que
// já tem minúscula é respeitado.
const LIGACOES = new Set(["de", "da", "do", "das", "dos", "e"])
const SIGLAS = new Set(["cpf", "cnpj"])

export function nomeLegivel(nome: string): string {
  if (nome !== nome.toLocaleUpperCase("pt-BR")) return nome
  return nome.split(" ").map((p, i) => {
    const m = p.toLocaleLowerCase("pt-BR")
    if (i > 0 && LIGACOES.has(m)) return m
    if (/\d/.test(p) || p.length <= 2 || SIGLAS.has(m)) return p
    return m.replace(/\p{L}/u, (c) => c.toLocaleUpperCase("pt-BR"))
  }).join(" ")
}
