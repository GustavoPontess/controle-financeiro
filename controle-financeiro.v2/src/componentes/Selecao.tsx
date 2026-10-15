// Seleção do v2 (no lugar do <select> nativo, cuja lista aberta é do sistema e não segue o visual):
// gatilho com a mesma cara dos campos, lista arredondada com sombra, marca no escolhido, teclado
// (↑ ↓ Home End Enter Esc Tab) e busca quando a lista é longa. Abre pra cima se não couber embaixo.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { useCampo } from "./campoContexto"
import g from "./gatilho.module.css"
import styles from "./Selecao.module.css"

export type OpcaoSelecao = { valor: string; rotulo: string }

const BUSCA_A_PARTIR_DE = 9

export default function Selecao({ valor, onChange, opcoes, placeholder = "Escolha…", invalido, desabilitado, tamanho = "md", ariaLabel, id }: {
  valor: string
  onChange: (valor: string) => void
  opcoes: OpcaoSelecao[]
  placeholder?: string
  invalido?: boolean
  desabilitado?: boolean
  /** md = 44px (formulário) · sm = 40px (painel) · xs = 32px (paginação) */
  tamanho?: "md" | "sm" | "xs"
  ariaLabel?: string
  id?: string
}) {
  // Dentro de um Campo: o rótulo aponta pra cá e o erro vem de lá (props explícitas ganham).
  const campo = useCampo()
  const idGatilho = id ?? campo?.id
  const inv = invalido ?? campo?.invalido ?? false
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(0)
  const [busca, setBusca] = useState("")
  const [paraCima, setParaCima] = useState(false)
  const raiz = useRef<HTMLDivElement | null>(null)
  const gatilho = useRef<HTMLButtonElement | null>(null)
  const lista = useRef<HTMLUListElement | null>(null)
  const campoBusca = useRef<HTMLInputElement | null>(null)
  const idLista = useId()
  const comBusca = opcoes.length >= BUSCA_A_PARTIR_DE

  const visiveis = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase("pt-BR")
    return q ? opcoes.filter((o) => o.rotulo.toLocaleLowerCase("pt-BR").includes(q)) : opcoes
  }, [opcoes, busca])
  const escolhida = opcoes.find((o) => o.valor === valor)

  const abrir = () => {
    if (desabilitado) return
    setBusca("")
    setAtivo(Math.max(0, opcoes.findIndex((o) => o.valor === valor)))
    setAberto(true)
  }
  const fechar = (devolverFoco = true) => { setAberto(false); if (devolverFoco) gatilho.current?.focus() }
  const escolher = (o: OpcaoSelecao) => { onChange(o.valor); fechar() }

  // Ao abrir: decide se cabe embaixo e leva o foco pra busca (ou pra lista).
  useLayoutEffect(() => {
    if (!aberto) return
    const r = gatilho.current?.getBoundingClientRect()
    if (r) setParaCima(window.innerHeight - r.bottom < 300 && r.top > window.innerHeight - r.bottom)
    if (comBusca) campoBusca.current?.focus()
    else lista.current?.focus()
  }, [aberto, comBusca])

  // Fecha no clique fora.
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) fechar(false) }
    document.addEventListener("mousedown", fora)
    return () => document.removeEventListener("mousedown", fora)
  }, [aberto])

  // Mantém a opção ativa à vista ao navegar com o teclado.
  useEffect(() => {
    if (!aberto) return
    lista.current?.querySelector<HTMLElement>(`[data-indice="${ativo}"]`)?.scrollIntoView({ block: "nearest" })
  }, [ativo, aberto])

  useEffect(() => { setAtivo(0) }, [busca])

  const teclaNaLista = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((i) => Math.min(visiveis.length - 1, i + 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((i) => Math.max(0, i - 1)) }
    else if (e.key === "Home") { e.preventDefault(); setAtivo(0) }
    else if (e.key === "End") { e.preventDefault(); setAtivo(visiveis.length - 1) }
    else if (e.key === "Enter") { e.preventDefault(); const o = visiveis[ativo]; if (o) escolher(o) }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fechar() }
    else if (e.key === "Tab") fechar(false)
  }
  const teclaNoGatilho = (e: KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); abrir() }
  }

  return (
    <div className={styles.raiz} ref={raiz}>
      <button ref={gatilho} id={idGatilho} type="button" className={g.gatilho} data-tamanho={tamanho} role="combobox"
        aria-haspopup="listbox" aria-expanded={aberto} aria-controls={idLista} aria-label={ariaLabel} aria-invalid={inv || undefined}
        aria-describedby={inv && campo ? campo.erroId : undefined}
        data-invalido={inv ? "true" : undefined} data-vazio={escolhida ? undefined : "true"} disabled={desabilitado}
        onClick={() => (aberto ? fechar() : abrir())} onKeyDown={teclaNoGatilho}>
        <span className={g.texto}>{escolhida?.rotulo ?? placeholder}</span>
        <ChevronDown size={16} strokeWidth={2.25} aria-hidden="true" className={`${g.icone} ${styles.seta}`} data-aberto={aberto ? "true" : undefined} />
      </button>

      {aberto && (
        <div className={`${g.painel} ${styles.painel}`} data-cima={paraCima ? "true" : undefined}>
          {comBusca && (
            <label className={styles.busca}>
              <Search size={14} strokeWidth={2.25} aria-hidden="true" />
              <input ref={campoBusca} placeholder="Buscar" aria-label="Buscar opção" value={busca}
                onChange={(e) => setBusca(e.target.value)} onKeyDown={teclaNaLista} />
            </label>
          )}
          <ul ref={lista} id={idLista} role="listbox" tabIndex={-1} className={styles.lista} onKeyDown={teclaNaLista}
            aria-activedescendant={visiveis[ativo] ? `${idLista}-${ativo}` : undefined}>
            {visiveis.length === 0 && <li className={styles.nada}>Nada encontrado</li>}
            {visiveis.map((o, i) => (
              <li key={o.valor || "__vazio"} id={`${idLista}-${i}`} role="option" aria-selected={o.valor === valor}
                data-indice={i} data-ativo={i === ativo ? "true" : undefined} className={styles.opcao}
                onMouseEnter={() => setAtivo(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(o)}>
                <span className={styles.opcaoTexto}>{o.rotulo}</span>
                {o.valor === valor && <Check size={15} strokeWidth={2.5} aria-hidden="true" className={styles.marca} />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
