// Planilha do v2: linhas abertas, tudo visível na própria linha (sem ficha que abre ao clicar; pedido do Gustavo
// 2026-10-21, "esse estilo de dropdown em tudo tá ficando feio"). Cabeçalho com o nome das colunas; cada linha é
// nome + valores + barra + ação. No celular o cabeçalho some e cada valor mostra o rótulo da coluna em cima.
// `colunas` = as colunas de valor (ex.: ["Planejado", "Gasto", "Sobra"]); a barra e a ação são opcionais.
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type ReactNode } from "react"
import EntradaValor from "./EntradaValor"
import Selecao, { type OpcaoSelecao } from "./Selecao"
import { parseMoney } from "../utils/money"
import styles from "./Planilha.module.css"

/** As colunas opcionais da planilha: a linha sempre ocupa as duas (vazias quando não têm nada), senão desalinha. */
const Colunas = createContext({ barra: false, acao: false, valores: 0 })

export function Planilha({ rotulo, rotuloNome, colunas, barra, acao, larguraAcao, semCabecalho, children }: {
  rotulo: string
  /** Sem a linha dos nomes das colunas (tabela só com o rodapé). */
  semCabecalho?: boolean
  /** Nome da primeira coluna (ex.: "Categoria"). */
  rotuloNome?: string
  colunas: string[]
  /** Tem coluna de barra (progresso). */
  barra?: boolean
  /** Tem coluna de ação no fim (botão pequeno). */
  acao?: boolean
  /** Largura da coluna de ação quando ela leva botões com texto (padrão: 32px, um botão de ícone). No celular
   *  a ação larga vai pra última linha do cartão. */
  larguraAcao?: string
  children: ReactNode
}) {
  // Tela larga: colunas de valor com folga. Tela estreita (até 1200px, o laptop com o menu aberto): as colunas de valor
  // ficam no mínimo e o nome fica com o resto, pra categoria não sumir atrás das reticências.
  const colAcao = acao ? (larguraAcao ?? "32px") : null
  const molde = ["minmax(0, 1fr)", ...colunas.map(() => "128px"), barra ? "140px" : null, colAcao].filter(Boolean).join(" ")
  const moldeEstreito = ["minmax(0, 1fr)", ...colunas.map(() => "88px"), barra ? "72px" : null, colAcao].filter(Boolean).join(" ")
  return (
    <div className={styles.planilha} data-acao-larga={larguraAcao ? "true" : undefined}
      style={{ "--planilha-colunas": molde, "--planilha-colunas-estreita": moldeEstreito } as CSSProperties}>
      {!semCabecalho && <div className={styles.cabecalho} aria-hidden="true">
        <span>{rotuloNome}</span>
        {colunas.map((c) => <span key={c} className={styles.valor}>{c}</span>)}
        {barra && <span />}
        {acao && <span className={styles.acaoVazia} />}
      </div>}
      <Colunas.Provider value={{ barra: !!barra, acao: !!acao, valores: colunas.length }}>
        <ul className={styles.linhas} aria-label={rotulo}>{children}</ul>
      </Colunas.Provider>
    </div>
  )
}

/** A última linha da planilha, com o botão de planejar (pedido do Gustavo 2026-10-22: o botão no fim, não em cima). */
export function LinhaBotaoPlanilha({ children }: { children: ReactNode }) {
  return <li className={styles.rodape}>{children}</li>
}

/** Separador com rótulo dentro da planilha (ex.: "Sem planejado"). */
export function GrupoPlanilha({ rotulo }: { rotulo: string }) {
  return <li className={styles.grupo} role="presentation">{rotulo}</li>
}

export function LinhaPlanilha({ marca, nome, detalhe, children, barra, acao }: {
  marca?: ReactNode
  nome: ReactNode
  /** Linha pequena embaixo do nome (situação, o que ainda vem). */
  detalhe?: ReactNode
  /** As células de valor (`CelulaPlanilha`), na ordem das colunas. */
  children: ReactNode
  barra?: ReactNode
  acao?: ReactNode
}) {
  const colunas = useContext(Colunas)
  return (
    <li className={styles.linha}>
      <span className={styles.nomeCelula}>
        {marca}
        <span className={styles.texto}>
          <span className={styles.nome}>{nome}</span>
          {detalhe && <span className={styles.detalhe}>{detalhe}</span>}
        </span>
      </span>
      {children}
      {colunas.barra && <span className={styles.barra}>{barra}</span>}
      {colunas.acao && <span className={styles.acao}>{acao}</span>}
    </li>
  )
}

/** Um valor da linha. `rotulo` = o nome da coluna (aparece em cima do valor no celular). */
export function CelulaPlanilha({ rotulo, children, tom }: { rotulo: string; children?: ReactNode; tom?: "negativo" | "positivo" | "mudo" }) {
  return <span className={styles.valor} data-rotulo={rotulo} data-tom={tom}>{children}</span>
}

/**
 * A linha de planejar, aberta no fim da tabela ("Planejar categoria"; pedido do Gustavo 2026-10-22: nada de outra
 * tela, nem botão de salvar/cancelar). Abre com o foco na categoria; escolheu, o foco vai pro valor. Enter salva.
 * Saiu da linha (clicou fora, Tab): com categoria e valor, salva; sem, a linha some. Esc também some.
 */
export function LinhaNovaPlanilha({ opcoes, rotuloCategoria = "Categoria", rotuloValor, ocupado, aoSalvar, aoCancelar }: {
  opcoes: OpcaoSelecao[]
  rotuloCategoria?: string
  /** Nome acessível do campo de valor ("Planejado", "Esperado"). */
  rotuloValor: string
  ocupado?: boolean
  aoSalvar: (id: string, valor: number) => void
  aoCancelar: () => void
}) {
  const colunas = useContext(Colunas)
  const linha = useRef<HTMLLIElement>(null)
  const [id, setId] = useState("")
  const [valor, setValor] = useState("")
  // Abriu: a linha aparece na tela (mesmo com a tabela comprida) e o foco vai pra escolha da categoria.
  useEffect(() => {
    linha.current?.scrollIntoView?.({ block: "nearest" })
    linha.current?.querySelector<HTMLElement>("button, input")?.focus()
  }, [])
  const pronto = !!id && parseMoney(valor) > 0
  const fechar = () => { if (ocupado) return; if (pronto) aoSalvar(id, parseMoney(valor)); else aoCancelar() }
  const tecla = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); aoCancelar() }
    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); if (pronto) aoSalvar(id, parseMoney(valor)) }
  }
  // O foco saiu da linha inteira (não só trocou de campo dentro dela): Tab, ou clique em outro campo.
  const saiu = (e: FocusEvent<HTMLLIElement>) => { if (!linha.current?.contains(e.relatedTarget as Node | null)) fechar() }
  // Clique fora em algo que não recebe foco (texto, fundo) não dispara blur: escuta o mouse na página também.
  const fecharRef = useRef(fechar)
  fecharRef.current = fechar
  useEffect(() => {
    const fora = (e: MouseEvent) => { if (!linha.current?.contains(e.target as Node)) fecharRef.current() }
    document.addEventListener("mousedown", fora)
    return () => document.removeEventListener("mousedown", fora)
  }, [])
  return (
    <li ref={linha} className={styles.linha} data-nova="true" onKeyDown={tecla} onBlur={saiu} aria-label="Nova linha" aria-busy={ocupado || undefined}>
      <span className={styles.nomeCelula}>
        <span className={styles.campoNome}>
          <Selecao tamanho="sm" valor={id} opcoes={opcoes} ariaLabel={rotuloCategoria}
            placeholder={opcoes.length === 0 ? "Todas já têm planejado" : "Escolha a categoria"} desabilitado={opcoes.length === 0}
            onChange={(x) => { setId(x); setTimeout(() => linha.current?.querySelector<HTMLInputElement>("input")?.focus(), 0) }} />
        </span>
      </span>
      <span className={styles.valor}>
        <span className={styles.campoValor}>
          <EntradaValor compacto tamanho="sm" valor={valor} rotulo={rotuloValor} onChange={setValor} />
        </span>
      </span>
      {Array.from({ length: Math.max(0, colunas.valores - 1) }, (_, i) => <span key={i} />)}
      {colunas.barra && <span />}
      {colunas.acao && <span />}
    </li>
  )
}
