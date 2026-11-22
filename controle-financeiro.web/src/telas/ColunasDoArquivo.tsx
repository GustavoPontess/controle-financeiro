// Colunas do arquivo (Importar extrato, CSV; 2026-11-21, desenho aprovado pelo Gustavo em /dev/importar). O começo do
// arquivo como tabela, SEMPRE à vista: cada coluna com a etiqueta do que o app achou que ela é (Data, Descrição,
// Valor, Entrada, Saída, Código, Ignorar) e, embaixo, por quê ("pelo nome da coluna", "pelo conteúdo", "lembrado desta
// conta"). Clicar na etiqueta troca; "Vai ficar assim" mostra na hora como as primeiras linhas vão entrar e "Ler de
// novo" manda pro servidor. Substitui o "Trocar colunas" escondido e o formulário de seleções de antes (o Gustavo não
// enxergava a decisão: "não entendi como ele já define o que é cada coluna sozinho").
import { useState } from "react"
import { ChevronDown, RotateCcw } from "lucide-react"
import Bloco from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import { Dinheiro } from "../componentes/Dinheiro"
import { RodapeFormulario } from "../componentes/Formulario"
import type { MapeamentoCsv } from "../types/Importacao"
import styles from "./ColunasDoArquivo.module.css"

export type Papel = "data" | "tipo" | "descricao" | "valor" | "entrada" | "saida" | "id" | "ignorar"
const PAPEIS: { valor: Papel; rotulo: string }[] = [
  { valor: "data", rotulo: "Data" }, { valor: "tipo", rotulo: "Tipo" }, { valor: "descricao", rotulo: "Descrição" }, { valor: "valor", rotulo: "Valor" },
  { valor: "entrada", rotulo: "Entrada" }, { valor: "saida", rotulo: "Saída" }, { valor: "id", rotulo: "Código" },
  { valor: "ignorar", rotulo: "Ignorar" },
]
// Papéis que só uma coluna pode ter (Ignorar pode em várias).
const UNICOS: Papel[] = ["data", "tipo", "descricao", "valor", "entrada", "saida", "id"]
const rotuloDe = (p: Papel) => PAPEIS.find((x) => x.valor === p)?.rotulo ?? ""

const PARECE_DATA = /^\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}/
const PARECE_VALOR = /^[+-]?\(?\s*(R\$\s*)?[\d.,]+\)?\s*[DC-]?$/i

/** Número como o servidor lê: "1.234,56", "1,234.56", "-50.00", "150,00 D". Null se não for número. */
export function lerValor(bruto: string): number | null {
  let s = bruto.trim().replace(/R\$/i, "").replace(/\s/g, "")
  if (!s) return null
  let negativo = false
  if (/[Dd]$/.test(s)) { negativo = true; s = s.slice(0, -1) } else if (/[Cc]$/.test(s)) s = s.slice(0, -1)
  if (s.endsWith("-")) { negativo = true; s = s.slice(0, -1) }
  if (s.startsWith("(") && s.endsWith(")")) { negativo = true; s = s.slice(1, -1) }
  if (!/^[+-]?[\d.,]+$/.test(s)) return null
  const virgula = s.lastIndexOf(","), ponto = s.lastIndexOf(".")
  if (virgula > ponto) s = s.replace(/\./g, "").replace(",", ".")
  else s = s.replace(/,/g, "")
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return negativo ? -Math.abs(n) : n
}

/** Do mapeamento (do servidor ou o lembrado) pra um papel por coluna. */
function papeisDoMapa(m: MapeamentoCsv, n: number): Papel[] {
  return Array.from({ length: n }, (_, i): Papel =>
    i === m.data ? "data" : i === m.tipo ? "tipo" : i === m.descricao ? "descricao" : i === m.valor ? "valor"
      : i === m.entrada ? "entrada" : i === m.saida ? "saida" : i === m.id ? "id" : "ignorar")
}

/** Sem mapeamento do servidor (arquivo que ele não reconheceu): o palpite pelos exemplos. Data pela cara de data,
 *  a única coluna de número como Valor e o texto mais comprido como Descrição. Duas colunas de número: a pessoa diz. */
function palpite(colunas: string[], amostra: string[][]): Papel[] {
  const p: Papel[] = colunas.map(() => "ignorar")
  const celulas = (i: number) => amostra.map((l) => (l[i] ?? "").trim()).filter(Boolean)
  const data = colunas.findIndex((_, i) => celulas(i).length > 0 && celulas(i).every((c) => PARECE_DATA.test(c)))
  if (data >= 0) p[data] = "data"
  const numeros = colunas.map((_, i) => i).filter((i) => i !== data && celulas(i).length > 0 && celulas(i).every((c) => PARECE_VALOR.test(c)))
  if (numeros.length === 1) p[numeros[0]] = "valor"
  let texto = -1, maior = 0
  colunas.forEach((_, i) => {
    if (i === data || numeros.includes(i)) return
    const cs = celulas(i)
    if (cs.length === 0) return
    const media = cs.reduce((t, c) => t + c.length, 0) / cs.length
    if (media > maior) { maior = media; texto = i }
  })
  if (texto >= 0) p[texto] = "descricao"
  return p
}

/** Os papéis viram o mapeamento que o servidor lê; null se falta Data, Descrição ou o valor. */
export function mapaDosPapeis(papeis: Papel[], inverter: boolean): MapeamentoCsv | null {
  const col = (p: Papel) => { const i = papeis.indexOf(p); return i >= 0 ? i : null }
  const data = col("data"), descricao = col("descricao"), valor = col("valor"), entrada = col("entrada"), saida = col("saida")
  if (data === null || descricao === null) return null
  if (valor === null && (entrada === null || saida === null)) return null
  return valor !== null
    ? { data, descricao, valor, entrada: null, saida: null, id: col("id"), inverterSinal: inverter, tipo: col("tipo") }
    : { data, descricao, valor: null, entrada, saida, id: col("id"), inverterSinal: false, tipo: col("tipo") }
}

export default function ColunasDoArquivo({ colunas, amostra, inicial, motivos, naoReconhecido, lendo, aoLer }: {
  colunas: string[]
  amostra: string[][]
  /** O mapeamento que o servidor usou (ou o lembrado da conta). */
  inicial: MapeamentoCsv | null
  motivos?: string[] | null
  /** O servidor não reconheceu as colunas: a pessoa escolhe e "Continuar" lê. */
  naoReconhecido: boolean
  lendo: boolean
  aoLer: (m: MapeamentoCsv) => void
}) {
  const comeco = () => (inicial ? papeisDoMapa(inicial, colunas.length) : palpite(colunas, amostra))
  const [papeis, setPapeis] = useState<Papel[]>(comeco)
  const [inverter, setInverter] = useState(!!inicial?.inverterSinal)
  const [mudou, setMudou] = useState<boolean[]>(() => colunas.map(() => false))
  const [tentou, setTentou] = useState(false)
  const nome = (i: number) => colunas[i] || `Coluna ${i + 1}`
  const alterado = mudou.some(Boolean) || inverter !== !!inicial?.inverterSinal

  const trocar = (i: number, p: Papel) => {
    setTentou(false)
    setPapeis((v) => v.map((x, j) => (j === i ? p : UNICOS.includes(p) && x === p ? "ignorar" : x)))
    setMudou((v) => v.map((x, j) => x || j === i || (UNICOS.includes(p) && papeis[j] === p)))
  }
  const desfazer = () => { setPapeis(comeco()); setInverter(!!inicial?.inverterSinal); setMudou(colunas.map(() => false)); setTentou(false) }

  const col = (p: Papel) => papeis.indexOf(p)
  const umaColuna = col("valor") >= 0
  const valorDaLinha = (l: string[]): number | null => {
    if (umaColuna) { const v = lerValor(l[col("valor")] ?? ""); return v === null ? null : inverter ? -v : v }
    const e = col("entrada") >= 0 ? lerValor(l[col("entrada")] ?? "") : null
    const s = col("saida") >= 0 ? lerValor(l[col("saida")] ?? "") : null
    if (e) return Math.abs(e)
    if (s) return -Math.abs(s)
    return null
  }
  const mapa = mapaDosPapeis(papeis, inverter)
  const falta = col("data") < 0 ? "Falta a coluna da data" : col("descricao") < 0 ? "Falta a coluna da descrição"
    : !umaColuna && (col("entrada") < 0 || col("saida") < 0) ? "Falta o valor: uma coluna Valor, ou Entrada e Saída" : null

  // Como o servidor lê: o tipo na frente da descrição, sem repetir.
  const descricaoDa = (l: string[]) => {
    const d = (l[col("descricao")] ?? "").trim()
    const t = col("tipo") >= 0 ? (l[col("tipo")] ?? "").trim() : ""
    return !t || d.toLowerCase().startsWith(t.toLowerCase()) ? d : d ? `${t} ${d}` : t
  }

  const ler = () => { if (!mapa) { setTentou(true); return } aoLer(mapa) }

  return (
    <Bloco titulo={naoReconhecido ? "Não reconhecemos as colunas desse arquivo" : "Colunas do arquivo"}>
      <div className={styles.rolagem}>
        <table className={styles.tabela}>
          <thead>
            <tr>
              {colunas.map((c, i) => (
                <th key={i} scope="col" data-ignorada={papeis[i] === "ignorar" || undefined}>
                  {/* A etiqueta é a escolha: um select nativo por cima dela (a lista abre fora da tabela, que rola de lado). */}
                  <label className={styles.papel} data-papel={papeis[i]}>
                    {rotuloDe(papeis[i])}<ChevronDown size={14} strokeWidth={2.25} aria-hidden="true" />
                    <select className={styles.papelSelect} aria-label={`O que é a coluna ${nome(i)}`} value={papeis[i]}
                      disabled={lendo} onChange={(e) => trocar(i, e.target.value as Papel)}>
                      {PAPEIS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
                    </select>
                  </label>
                  <span className={styles.nomeColuna} title={c}>{nome(i)}</span>
                  <span className={styles.motivo}>{mudou[i] ? "você escolheu" : naoReconhecido ? "palpite pelo conteúdo" : motivos?.[i] ?? ""}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {amostra.slice(0, 3).map((l, j) => (
              <tr key={j}>
                {colunas.map((_, i) => {
                  const v = (l[i] ?? "").trim()
                  return <td key={i} data-ignorada={papeis[i] === "ignorar" || undefined}><span title={v}>{v || <span className={styles.vazio}>vazio</span>}</span></td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.assim}>
        <div className={styles.assimTopo}>
          <span className={styles.assimTitulo}>Vai ficar assim</span>
          {umaColuna && (
            <Botao variante="texto" disabled={lendo} onClick={() => setInverter((v) => !v)} icone={<RotateCcw size={14} strokeWidth={2.25} aria-hidden="true" />}>
              Está ao contrário? Inverter
            </Botao>
          )}
        </div>
        <ul className={styles.assimLista} aria-label="Como as primeiras linhas vão ficar">
          {amostra.slice(0, 3).map((l, j) => {
            const v = valorDaLinha(l)
            return (
              <li key={j}>
                <span className={styles.data}>{col("data") >= 0 ? l[col("data")] ?? "" : <span className={styles.mudo}>data?</span>}</span>
                <span className={styles.desc}>{col("descricao") >= 0 ? descricaoDa(l) || "Sem descrição" : <span className={styles.mudo}>descrição?</span>}</span>
                {v === null ? <span className={styles.mudo}>sem valor</span>
                  : <span className={styles.valor}><span className={styles.mudo}>{v < 0 ? "saiu" : "entrou"}</span>
                    <Dinheiro valor={Math.abs(v)} tom={v < 0 ? "negativo" : "positivo"} /></span>}
              </li>
            )
          })}
        </ul>
      </div>
      {tentou && falta && <p className={styles.erro} role="alert">{falta}</p>}

      {(naoReconhecido || alterado) && (
        <RodapeFormulario>
          {!naoReconhecido && <Botao disabled={lendo} onClick={desfazer}>Desfazer</Botao>}
          <Botao variante="primario" disabled={lendo} onClick={ler}>{lendo ? "Lendo…" : naoReconhecido ? "Continuar" : "Ler de novo"}</Botao>
        </RodapeFormulario>
      )}
    </Bloco>
  )
}
