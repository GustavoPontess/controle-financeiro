// Painel de dev, SÓ EM DESENVOLVIMENTO (regra do Gustavo, 2026-10-26): um cartão pequeno no canto com o seletor
// de estados da tela (passo de fluxo, vazio x com dados, erro…, sem login nem API) e os atalhos extras dela (ex.:
// contas de teste do login). Nunca importar direto: a tela usa <BarraDev> (BarraDev.tsx), que só carrega este
// arquivo com import.meta.env.DEV; no build ele some. Pra não tampar a tela: arrasta pelo topo (duplo clique volta
// pro canto) e recolhe numa pílula. Posição e "recolhido" ficam no navegador (localStorage), em todas as telas.
import { useEffect, useRef, useState, type PointerEvent as EventoPonteiro } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ChevronDown, GripVertical } from "lucide-react"
import type { ExtrasDev, GruposEstadosDev } from "./tipos"
import { definirSemInatividade, useSemInatividade } from "./semInatividade"
import css from "./BarraEstadosDev.module.css"

type Lembrado = { pos: { x: number; y: number } | null; escondida: boolean }
const CHAVE = "dev:barraEstados"
const ler = (): Lembrado => {
  try { return { pos: null, escondida: false, ...JSON.parse(localStorage.getItem(CHAVE) ?? "{}") } } catch { return { pos: null, escondida: false } }
}
const gravar = (v: Lembrado) => { try { localStorage.setItem(CHAVE, JSON.stringify(v)) } catch { /* sem armazenamento */ } }
/** Mantém o painel inteiro dentro da janela. */
const dentro = (x: number, y: number, el: HTMLElement) => ({
  x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - el.offsetWidth - 8)),
  y: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - el.offsetHeight - 8)),
})

/** `para` = rota + #estado (o mesmo endereço que a tela lê no useEstadoDev). */
export default function BarraEstadosDev({ grupos, atual, extras }: { grupos: GruposEstadosDev; atual: string; extras?: ExtrasDev }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [{ pos, escondida }, setLembrado] = useState(ler)
  const mudar = (v: Partial<Lembrado>) => setLembrado((a) => { const n = { ...a, ...v }; gravar(n); return n })
  const painel = useRef<HTMLDivElement>(null)
  const semInat = useSemInatividade()

  const ativo = (para: string) => {
    const [caminho, estado] = para.split("#")
    return caminho.split("?")[0] === pathname && estado === atual
  }
  const estadoAtivo = grupos.flatMap((g) => g.estados).find((e) => ativo(e.para))

  // Mudou o tamanho (janela, recolher/abrir, contas que chegaram depois): puxa o painel de volta pra dentro.
  useEffect(() => {
    const el = painel.current
    if (!el) return
    const ajustar = () => setLembrado((a) => {
      if (!a.pos) return a
      const p = dentro(a.pos.x, a.pos.y, el)
      return p.x === a.pos.x && p.y === a.pos.y ? a : { ...a, pos: p }
    })
    ajustar()
    const obs = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(ajustar)
    obs?.observe(el)
    window.addEventListener("resize", ajustar)
    return () => { obs?.disconnect(); window.removeEventListener("resize", ajustar) }
  }, [escondida])

  // Arrastar pelo topo (os botões dele continuam clicáveis).
  const arrastar = (ev: EventoPonteiro<HTMLElement>) => {
    const el = painel.current
    if (!el || ev.button !== 0 || (ev.target as Element).closest("button, select")) return
    ev.preventDefault()
    const r = el.getBoundingClientRect(), dx = ev.clientX - r.left, dy = ev.clientY - r.top
    const mover = (e: PointerEvent) => setLembrado((a) => ({ ...a, pos: dentro(e.clientX - dx, e.clientY - dy, el) }))
    const soltar = () => {
      window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", soltar)
      setLembrado((a) => { gravar(a); return a })
    }
    window.addEventListener("pointermove", mover); window.addEventListener("pointerup", soltar)
  }

  // Posição arrastada: valor de tempo de execução (por isso inline).
  const onde = pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined
  const alca = <GripVertical size={14} strokeWidth={2.2} aria-hidden="true" className={css.alca} />

  if (escondida) {
    return (
      <div ref={painel} className={`${css.painel} ${css.pilula}`} style={onde} onPointerDown={arrastar} onDoubleClick={() => mudar({ pos: null })}
        title="Arrastar (duplo clique volta pro canto)">
        {alca}
        <button type="button" className={css.abrir} onClick={() => mudar({ escondida: false })} aria-label="Abrir o painel de dev">
          <b>DEV</b>{estadoAtivo && <span>{estadoAtivo.rotulo}</span>}
        </button>
      </div>
    )
  }
  return (
    <div ref={painel} className={css.painel} style={onde} role="region" aria-label="Painel de dev (só em desenvolvimento)">
      <div className={css.topo} onPointerDown={arrastar} onDoubleClick={() => mudar({ pos: null })} title="Arrastar (duplo clique volta pro canto)">
        {alca}<b>DEV</b>
        <button type="button" className={css.recolher} onClick={() => mudar({ escondida: true })} aria-label="Recolher o painel de dev" title="Recolher">
          <ChevronDown size={16} strokeWidth={2.4} />
        </button>
      </div>
      {grupos.length > 0 && <label className={css.rotulo}>
        Estado da tela
        <select className={css.seletor} value={estadoAtivo?.para ?? ""} onChange={(e) => navigate(e.target.value)}>
          {!estadoAtivo && <option value="" disabled>Escolha…</option>}
          {grupos.map((g) => (
            <optgroup key={g.grupo} label={g.grupo}>
              {g.estados.map((e) => <option key={e.para} value={e.para}>{e.rotulo}</option>)}
            </optgroup>
          ))}
        </select>
      </label>}
      {extras && extras.itens.length > 0 && (
        <label className={css.rotulo}>
          {extras.titulo}
          {/* Escolher faz a ação e o seletor volta pro "Escolha…" (pra dá pra escolher a mesma de novo). */}
          <select className={css.seletor} value="" onChange={(e) => extras.itens[Number(e.target.value)]?.aoClicar()}>
            <option value="" disabled>Escolha…</option>
            {extras.itens.map((i, n) => (
              <option key={i.rotulo + (i.detalhe ?? "")} value={n} title={i.dica}>{i.rotulo}{i.detalhe ? ` · ${i.detalhe}` : ""}</option>
            ))}
          </select>
        </label>
      )}
      <label className={css.chave} title="Login já com Manter-me conectado e a sessão aberta não cai por ficar parado">
        <input type="checkbox" checked={semInat} onChange={(e) => definirSemInatividade(e.target.checked)} />
        Sem sair por inatividade
      </label>
    </div>
  )
}
