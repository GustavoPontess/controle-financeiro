// "Qual parte é o nome?" (Importar extrato, 2026-11-21). A descrição do banco em palavras; a pessoa marca as que são o
// nome (sempre seguidas). Com "Usar nas próximas", o servidor guarda só a FORMA do que vem antes e depois (número,
// data, documento, palavra), nunca as palavras, e relê a prévia; sem, só renomeia. Abre DENTRO da tela, sem janela por
// cima (Gustavo, 2026-11-21: "não gosto de popup"); quem usa decide quando mostrar.
import { useMemo, useState } from "react"
import Botao from "../componentes/Botao"
import Marcar from "../componentes/Marcar"
import { RodapeFormulario } from "../componentes/Formulario"
import { mensagemDeErro } from "../api/cliente"
import type { PedacoDescricao } from "../types/Importacao"
import styles from "./MarcarNome.module.css"

type Palavra = { texto: string; ini: number; fim: number }

function palavrasDe(descricao: string): Palavra[] {
  return [...descricao.matchAll(/\S+/g)].map((m) => ({ texto: m[0], ini: m.index!, fim: m.index! + m[0].length }))
}

/** As palavras que o app já tinha lido como o nome (pelos pedaços), como intervalo [ini, fim]; null se nenhuma. */
function intervaloInicial(palavras: Palavra[], pedacos?: PedacoDescricao[]): [number, number] | null {
  if (!pedacos?.length) return null
  let pos = 0
  const nomes: [number, number][] = []
  for (const p of pedacos) {
    if (p.parte === "nome") nomes.push([pos, pos + p.texto.length])
    pos += p.texto.length
  }
  const marcadas = palavras.map((w, i) => (nomes.some(([a, b]) => w.ini < b && w.fim > a) ? i : -1)).filter((i) => i >= 0)
  return marcadas.length ? [marcadas[0], marcadas[marcadas.length - 1]] : null
}

export default function MarcarNome({ descricao, pedacos, onFechar, aoSalvar }: {
  descricao: string
  pedacos?: PedacoDescricao[]
  onFechar: () => void
  /** `lembrar`: guardar o padrão e reler. Lança erro pra mostrar aqui. */
  aoSalvar: (nome: string, lembrar: boolean) => Promise<void>
}) {
  const palavras = useMemo(() => palavrasDe(descricao), [descricao])
  const [faixa, setFaixa] = useState<[number, number] | null>(() => intervaloInicial(palavras, pedacos))
  const [lembrar, setLembrar] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  // O nome é uma faixa seguida: clicar fora estende até ali, na ponta tira a ponta, no meio recomeça naquela palavra.
  const alternar = (i: number) => {
    setErro(null)
    setFaixa((f) => {
      if (!f) return [i, i]
      const [a, b] = f
      if (i < a) return [i, b]
      if (i > b) return [a, i]
      if (a === b) return null
      if (i === a) return [a + 1, b]
      if (i === b) return [a, b - 1]
      return [i, i]
    })
  }
  const nome = faixa ? palavras.slice(faixa[0], faixa[1] + 1).map((w) => w.texto).join(" ") : ""

  const salvar = async () => {
    if (!faixa) { setErro("Escolha ao menos uma palavra"); return }
    if (lembrar && faixa[0] === 0) { setErro("O começo da descrição não serve de modelo. Desmarque Usar nas próximas"); return }
    setSalvando(true)
    try {
      await aoSalvar(nome, lembrar)
      onFechar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className={styles.emLinha} aria-label="Qual parte é o nome?">
      <p className={styles.frase}>Clique nas palavras que são o nome de quem pagou ou recebeu.</p>
      <div className={styles.palavras} role="group" aria-label="Palavras da descrição">
        {palavras.map((w, i) => (
          <button key={i} type="button" className={styles.palavra} disabled={salvando}
            aria-pressed={!!faixa && i >= faixa[0] && i <= faixa[1]} onClick={() => alternar(i)}>{w.texto}</button>
        ))}
      </div>
      <div className={styles.resultado}>
        <span className={styles.rotulo}>Nome</span>
        <strong>{nome || "Escolha ao menos uma palavra"}</strong>
      </div>
      {erro && <p className={styles.erro} role="alert">{erro}</p>}
      <RodapeFormulario>
        <span className={styles.marcar}>
          <Marcar marcado={lembrar} desabilitado={salvando} onChange={setLembrar}>Usar nas próximas descrições parecidas</Marcar>
        </span>
        <Botao disabled={salvando} onClick={onFechar}>Cancelar</Botao>
        <Botao variante="primario" disabled={salvando} onClick={() => { void salvar() }}>{salvando ? "Salvando…" : "Salvar nome"}</Botao>
      </RodapeFormulario>
    </section>
  )
}
