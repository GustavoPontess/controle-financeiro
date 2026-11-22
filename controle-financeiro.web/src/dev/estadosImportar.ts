// Estados do Importar extrato pro painel de dev (só em desenvolvimento; regra em CONVENCOES.md → "Painel de dev").
// Cada estado põe a tela no ponto sem ler arquivo nem chamar a API. Nomes e documentos são inventados.
import type { GruposEstadosDev } from "./tipos"
import type { ExtratoLinha, PreviewImportacao, ResultadoImportacao } from "../types/Importacao"

export const GRUPOS_IMPORTAR: GruposEstadosDev = [
  { grupo: "Começo", estados: [{ rotulo: "Só as contas", para: "/importar#inicio" }, { rotulo: "Conta escolhida", para: "/importar#conta" }] },
  { grupo: "Colunas do CSV", estados: [
    { rotulo: "Reconhecidas (cai na fila)", para: "/importar#colunas" },
    { rotulo: "Colunas abertas", para: "/importar#colunas-abertas" },
    { rotulo: "Tipo em coluna própria", para: "/importar#colunas-tipo" },
    { rotulo: "Colunas não reconhecidas", para: "/importar#colunas-nao-reconhecidas" },
  ] },
  { grupo: "Fila", estados: [
    { rotulo: "Lugares do extrato", para: "/importar#lugares" },
    { rotulo: "Mesmo nome, documentos diferentes", para: "/importar#documentos" },
    { rotulo: "Qual é o nome?", para: "/importar#qual-e-o-nome" },
    { rotulo: "Trocar conta ou arquivos", para: "/importar#trocar" },
  ] },
  { grupo: "Fim", estados: [
    { rotulo: "Importado", para: "/importar#importado" },
    { rotulo: "Já importado antes", para: "/importar#repetido" },
    { rotulo: "Nada novo", para: "/importar#nada-novo" },
  ] },
]

const linha = (data: string, descricao: string, valor: number, tipo: 1 | 2, extra: Partial<ExtratoLinha> = {}): ExtratoLinha => ({
  data: `${data}T00:00:00`, descricao, valor, tipo, fitId: `${data}-${descricao}`, duplicada: false,
  categoriaSugeridaId: null, categoriaSugeridaNome: null, ...extra,
})
const pix = (data: string, nome: string, valor: number, tipo: 1 | 2, cpf: string) => linha(data, `PIX ${tipo === 1 ? "ENVIADO" : "RECEBIDO"} ${nome} CPF ${cpf}`, valor, tipo, {
  estabelecimento: nome, chave: `${tipo === 1 ? "d" : "r"}:${nome.toLowerCase()}`, tipoMovimento: "Pix", documento: `CPF •••.${cpf}-••`, meioSugerido: 5,
  pedacos: [{ texto: `PIX ${tipo === 1 ? "ENVIADO" : "RECEBIDO"} `, parte: "tipo" }, { texto: `${nome} `, parte: "nome" }, { texto: `CPF ${cpf}`, parte: "resto" }],
})
const compra = (data: string, nome: string, valor: number) => linha(data, `COMPRA CARTAO DEB ${nome}`, valor, 1, {
  estabelecimento: nome, chave: `d:${nome.toLowerCase()}`, tipoMovimento: "Débito", meioSugerido: 2,
  pedacos: [{ texto: "COMPRA CARTAO DEB ", parte: "tipo" }, { texto: nome, parte: "nome" }],
})
// Tudo em funções: no nível do módulo, a chamada ficaria no build mesmo sem uso.
const ted = () => linha("2026-11-05", "TED RECEBIDA 341 0412 98765-4 CONSTRUTORA EXEMPLO LTDA", 3200, 2, {
  estabelecimento: "98765-4 CONSTRUTORA EXEMPLO LTDA", chave: "r:98765-4 construtora exemplo ltda", tipoMovimento: "Transferência",
  pedacos: [{ texto: "TED RECEBIDA 341 0412 ", parte: "tipo" }, { texto: "98765-4 CONSTRUTORA EXEMPLO LTDA", parte: "nome" }],
})

const lugares = (): ExtratoLinha[] => [
  ted(),
  compra("2026-11-03", "PADARIA PAO DOURADO", 23.5),
  compra("2026-11-10", "PADARIA PAO DOURADO", 18.9),
  compra("2026-11-12", "MERCADO BOM PRECO", 187.32),
  pix("2026-11-04", "FULANA EXEMPLO", 150, 1, "123.456"),
  linha("2026-11-08", "SAQUE BANCO 24H", 100, 1, { estabelecimento: "SAQUE BANCO 24H", chave: "d:saque banco 24h",
    pedacos: [{ texto: "SAQUE BANCO 24H", parte: "nome" }] }),
  linha("2026-11-15", "Transferência enviada pelo Pix - Conta própria", 500, 1, { natureza: "entre-contas", juntaComConta: "Poupança" }),
]

const previaOfx = (linhas: ExtratoLinha[]): PreviewImportacao => ({ formato: "ofx", total: linhas.length, duplicadas: 0, precisaMapear: false, linhas })

const CSV_COLUNAS = ["Data", "Histórico", "Docto.", "Crédito (R$)", "Débito (R$)", "Saldo (R$)"]
const CSV_AMOSTRA = [
  ["03/11/2026", "PIX RECEBIDO FULANA EXEMPLO", "102233", "1.200,00", "", "3.410,55"],
  ["04/11/2026", "COMPRA CARTAO DEB MERCADO BOM PRECO", "102240", "", "187,32", "3.223,23"],
  ["05/11/2026", "PAGTO BOLETO ENERGIA CIDADE", "102251", "", "245,10", "2.978,13"],
]
const csvLinhas = () => [
  linha("2026-11-03", "PIX RECEBIDO FULANA EXEMPLO", 1200, 2, { estabelecimento: "FULANA EXEMPLO", chave: "r:fulana exemplo", tipoMovimento: "Pix",
    pedacos: [{ texto: "PIX RECEBIDO ", parte: "tipo" }, { texto: "FULANA EXEMPLO", parte: "nome" }] }),
  compra("2026-11-04", "MERCADO BOM PRECO", 187.32),
  linha("2026-11-05", "PAGTO BOLETO ENERGIA CIDADE", 245.1, 1, { estabelecimento: "ENERGIA CIDADE", chave: "d:energia cidade", tipoMovimento: "Boleto",
    pedacos: [{ texto: "PAGTO BOLETO ", parte: "tipo" }, { texto: "ENERGIA CIDADE", parte: "nome" }] }),
]

const TIPO_COLUNAS = ["Data Lançamento", "Histórico", "Descrição", "Valor", "Saldo"]
const TIPO_AMOSTRA = [
  ["06/10/2026", "Recebimento de proventos", "Pagamento De Proventos Empresa Exemplo Ltda", "2.123,01", "0,00"],
  ["06/10/2026", "Pix enviado ", "Fulano de Tal", "-759,23", "1.363,78"],
  ["09/09/2026", "Pix recebido", "Ciclano Prado", "636,22", "636,22"],
]
const tipoLinhas = () => [
  linha("2026-10-06", "Recebimento de proventos Pagamento De Proventos Empresa Exemplo Ltda", 2123.01, 2, { estabelecimento: "Pagamento De Proventos Empresa Exemplo Ltda", chave: "r:pagamento de proventos empresa exemplo ltda",
    pedacos: [{ texto: "Recebimento de proventos ", parte: "tipo" }, { texto: "Pagamento De Proventos Empresa Exemplo Ltda", parte: "nome" }] }),
  linha("2026-10-06", "Pix enviado Fulano de Tal", 759.23, 1, { estabelecimento: "Fulano de Tal", chave: "d:fulano de tal", tipoMovimento: "Pix",
    pedacos: [{ texto: "Pix enviado ", parte: "tipo" }, { texto: "Fulano de Tal", parte: "nome" }] }),
  linha("2026-09-09", "Pix recebido Ciclano Prado", 636.22, 2, { estabelecimento: "Ciclano Prado", chave: "r:ciclano prado", tipoMovimento: "Pix",
    pedacos: [{ texto: "Pix recebido ", parte: "tipo" }, { texto: "Ciclano Prado", parte: "nome" }] }),
]

export type EstadoImportarDev = {
  arquivos: File[]
  previa: PreviewImportacao | null
  nomeAberto?: boolean
  /** As colunas do CSV reconhecido abertas no lugar da fila. */
  colunasAbertas?: boolean
  /** "Trocar conta ou arquivos": o começo sozinho, com a fila guardada. */
  topoAberto?: boolean
  resumo?: { resultado: ResultadoImportacao; de: string; ate: string; entrou: number; saiu: number; semCategoria?: number }
}

// Os arquivos de exemplo têm o conteúdo das linhas da tela: somar outro arquivo relê todos no servidor, e um arquivo
// vazio fazia o servidor recusar a leitura inteira ("Envie um arquivo de extrato.").
const arquivo = (nome: string, conteudo: string) => new File([conteudo], nome)
const csv = (nome: string, colunas: string[], amostra: string[][]) =>
  arquivo(nome, [colunas, ...amostra].map((l) => l.join(";")).join("\n"))
const ofxDe = (nome: string, linhas: ExtratoLinha[]) => arquivo(nome, [
  "OFXHEADER:100", "<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>",
  ...linhas.map((l) => `<STMTTRN><TRNTYPE>${l.tipo === 1 ? "DEBIT" : "CREDIT"}<DTPOSTED>${l.data.slice(0, 10).replaceAll("-", "")}`
    + `<TRNAMT>${l.tipo === 1 ? "-" : ""}${l.valor.toFixed(2)}<FITID>${l.fitId}<MEMO>${l.descricao}</STMTTRN>`),
  "</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>",
].join("\n"))

/** O estado pedido no painel; null se o endereço não é um estado desta tela. */
export function estadoImportar(e: string): EstadoImportarDev | null {
  const ofx = [ofxDe("Extrato-Banco-Exemplo-nov.ofx", lugares())]
  switch (e) {
    case "inicio": return { arquivos: [], previa: null }
    case "conta": return { arquivos: [], previa: null }
    case "colunas": case "colunas-abertas": return { arquivos: [csv("Extrato-Banco-Exemplo.csv", CSV_COLUNAS, CSV_AMOSTRA)], colunasAbertas: e === "colunas-abertas",
      previa: { ...previaOfx(csvLinhas()), formato: "csv", colunas: CSV_COLUNAS, amostra: CSV_AMOSTRA,
        mapeamento: { data: 0, descricao: 1, valor: null, entrada: 3, saida: 4, id: 2, inverterSinal: false, tipo: null },
        motivos: ["pelo nome da coluna", "pelo nome da coluna", "pelo nome da coluna", "pelo nome da coluna", "pelo nome da coluna", "é o saldo"] } }
    case "colunas-tipo": return { arquivos: [csv("Extrato-Banco-Exemplo.csv", TIPO_COLUNAS, TIPO_AMOSTRA)], colunasAbertas: true, previa: { ...previaOfx(tipoLinhas()), formato: "csv", colunas: TIPO_COLUNAS, amostra: TIPO_AMOSTRA,
      mapeamento: { data: 0, descricao: 2, valor: 3, entrada: null, saida: null, id: null, inverterSinal: false, tipo: 1 },
      motivos: ["pelo nome da coluna", "pelo nome da coluna", "pelo nome da coluna", "pelo nome da coluna", "é o saldo"] } }
    case "colunas-nao-reconhecidas": {
      const colunas = ["Dia", "Texto", "X", "Y"]
      const amostra = [["05/11/2026", "Salário", "3500,00", ""], ["06/11/2026", "Aluguel", "", "1800,00"], ["07/11/2026", "Padaria", "", "23,50"]]
      return { arquivos: [csv("Extrato-Banco-Exemplo.csv", colunas, amostra)], previa: { linhas: [], total: 0, duplicadas: 0, formato: "csv", precisaMapear: true, colunas, amostra } }
    }
    case "lugares": return { arquivos: ofx, previa: previaOfx(lugares()) }
    case "documentos": return { arquivos: ofx, previa: previaOfx([pix("2026-11-02", "FULANA EXEMPLO", 80, 1, "123.456"), pix("2026-11-09", "FULANA EXEMPLO", 45, 1, "987.654"), ...lugares().slice(1, 4)]) }
    case "qual-e-o-nome": return { arquivos: ofx, previa: previaOfx(lugares()), nomeAberto: true }
    case "trocar": return { arquivos: ofx, previa: previaOfx(lugares()), topoAberto: true }
    case "importado": return { arquivos: [], previa: null, resumo: { resultado: { importadas: 7 }, de: "2026-11-03", ate: "2026-11-15", entrou: 3200, saiu: 979.72, semCategoria: 3 } }
    case "repetido": return { arquivos: [], previa: null, resumo: { resultado: { importadas: 0, repetido: true }, de: "", ate: "", entrou: 0, saiu: 0 } }
    case "nada-novo": return { arquivos: [], previa: null, resumo: { resultado: { importadas: 0, jaExistiam: 7 }, de: "", ate: "", entrou: 0, saiu: 0 } }
    default: return null
  }
}
