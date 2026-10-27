// Moldura das telas de acesso (entrar, pedir acesso, senha nova, proteger a conta), IDÊNTICA ao rascunho aprovado
// (hub Pontes Dev, 2026-10-26: fonte/_base-acesso.html): foto + frase à esquerda, painel com o passo à direita.
// Mesmas classes do site.css (não é CSS Module de propósito: os seletores do rascunho dependem uns dos outros).
// A lógica (validação, API, passos) é de cada tela; aqui é só o visual. Cada passo é uma
// <section data-passo="…" className="ativo"> dentro do children.
import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { definirTema } from "../layout/useTema"
import { usarFolhaDoSite } from "./usarFolhaDoSite"
import css from "./Acesso.module.css"

type Moldura = {
  /** Título da aba. */
  titulo: string
  /** Foto do palco (arquivo em /site/fotos/, WebP). No celular o palco some e, com lazy, a foto nem baixa. */
  foto: string
  frase: string
  fraseSuave: string
  lead: string
  benef?: string[]
  children: ReactNode
}

const alternarTema = () => definirTema(document.documentElement.dataset.tema === "escuro" ? "claro" : "escuro")

export default function MolduraAcesso({ titulo, foto, frase, fraseSuave, lead, benef, children }: Moldura) {
  usarFolhaDoSite()
  useEffect(() => { document.title = titulo }, [titulo])

  return (
    <>
      <Icones />
      <div className="acesso">
        <aside className="palco-a">
          <img src={`/site/fotos/${foto}`} alt="" loading="lazy" decoding="async" />
          <div className="palco-txt">
            <Link className="marca" to="/"><img src="/site/estaiada-claro.svg" alt="" />Pontes</Link>
            <div>
              <p className="frase">{frase} <span>{fraseSuave}</span></p>
              <p className="lead">{lead}</p>
              {benef && <ul className="benef">{benef.map((b) => <li key={b}><i>✓</i>{b}</li>)}</ul>}
            </div>
            <span className="rod-palco">Pontes · o dinheiro da casa</span>
          </div>
        </aside>

        <main className="painel-a">
          <div className="topo-a">
            <Link className="marca marca-movel" to="/"><img src="/site/estaiada-laranja.svg" alt="" />Pontes</Link>
            <button type="button" className="tema-bt" data-tema-troca aria-label="Alternar modo claro e escuro" onClick={alternarTema}>
              <svg className="sol" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></svg>
              <svg className="lua" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" /></svg>
            </button>
          </div>
          <div className="miolo">
            <Link className={`voltar-a ${css.voltarSite}`} to="/"><span className="seta-volta">←</span> Voltar ao site</Link>
            {children}
          </div>
        </main>
      </div>
    </>
  )
}

/** "← Voltar…" do topo de um passo. */
export function VoltarA({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className="voltar-a" onClick={onClick}><span className="seta-volta">←</span> {children}</button>
}

/** Seta que anda no hover (o comum.js do rascunho embrulha o → num <span class="seta">). */
export const Seta = () => <span className="seta">→</span>

type CampoA = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  rotulo: string
  erro?: string | null
  /** Campo de senha, com o olho de mostrar/ocultar. */
  senha?: boolean
  /** Campo de código (letra maior, centralizada). */
  codigo?: boolean
  type?: string
}

/** Campo do rascunho (label.campo): rótulo, entrada e, com erro, .com-erro + <span class="erro"> embaixo. */
export function CampoAcesso({ rotulo, erro, senha, codigo, type, ...input }: CampoA) {
  const id = useId()
  const [mostrar, setMostrar] = useState(false)
  const props = {
    ...input,
    "aria-labelledby": `${id}-rot`,
    "aria-invalid": erro ? true : undefined,
    "aria-describedby": erro ? `${id}-erro` : undefined,
  }
  return (
    <label className={`campo${codigo ? " codigo" : ""}${erro ? " com-erro" : ""}`}>
      <span className="rot" id={`${id}-rot`}>{rotulo}</span>
      {senha ? (
        <span className="entrada-senha">
          <input {...props} type={mostrar ? "text" : "password"} />
          <button type="button" className="olho-bt" tabIndex={-1} aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"} onClick={() => setMostrar((v) => !v)}>
            <svg><use href={mostrar ? "#i-olho-fechado" : "#i-olho"} /></svg>
          </button>
        </span>
      ) : <input {...props} type={type ?? "text"} />}
      {erro && <span className="erro" id={`${id}-erro`}>{erro}</span>}
    </label>
  )
}

/** Ícones das telas de acesso (os do rascunho que estas telas usam). */
function Icones() {
  return (
    <svg width="0" height="0" className={css.icones} aria-hidden="true">
      <defs>
        <symbol id="i-olho" viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></symbol>
        <symbol id="i-olho-fechado" viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8M6.6 6.6C4 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.4-.6 4.7-1.4M9.9 9.9a3 3 0 0 0 4.2 4.2" /></symbol>
        <symbol id="i-lixo" viewBox="0 0 24 24"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" /></symbol>
        <symbol id="i-pessoa-mais" viewBox="0 0 24 24"><circle cx="9.5" cy="8" r="3.5" /><path d="M3 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" /></symbol>
        <symbol id="i-celular" viewBox="0 0 24 24"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M11 18.5h2" /></symbol>
        <symbol id="i-chave" viewBox="0 0 24 24"><circle cx="8" cy="15" r="4.5" /><path d="M11.2 11.8 20 3M16.5 6.5l2.5 2.5M14 9l2 2" /></symbol>
        <symbol id="i-escudo" viewBox="0 0 24 24"><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z" /><path d="m8.8 12 2.3 2.3 4.2-4.6" /></symbol>
      </defs>
    </svg>
  )
}
