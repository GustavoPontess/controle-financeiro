// Uma página do site público, IDÊNTICA ao rascunho aprovado (hub Pontes Dev, 2026-10-26): o HTML vem pronto de
// src/site/paginas/<nome>.html (gerado por scripts/importarSite.py a partir do rascunho), a folha é o site.css (o
// comum.css do rascunho) e os comportamentos são o comum.js portado (comportamentos.ts). Conteúdo estático do próprio
// repositório, sem nada vindo de usuário: por isso pode entrar como HTML.
// Enquanto a página está aberta: fonte Plus Jakarta Sans, classe .js no <html> (o CSS anima os blocos por ela) e tema
// claro quando a pessoa nunca escolheu (decisão do Gustavo); tudo volta ao sair.
import { useEffect, useLayoutEffect, useRef } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../auth/useAuth"
import { definirTema, type Tema } from "../layout/useTema"
import { ligarSite } from "./comportamentos"
import { usarFolhaDoSite } from "./usarFolhaDoSite"
import { BarraDev } from "../dev/BarraDev"
import titulos from "./paginas/titulos.json"
import home from "./paginas/home.html?raw"
import recursos from "./paginas/recursos.html?raw"
import casa from "./paginas/casa.html?raw"
import contadores from "./paginas/contadores.html?raw"
import planos from "./paginas/planos.html?raw"
import seguranca from "./paginas/seguranca.html?raw"
import sobre from "./paginas/sobre.html?raw"

export type NomePagina = keyof typeof titulos
const HTML: Record<NomePagina, string> = { home, recursos, casa, contadores, planos, seguranca, sobre }

export default function PaginaSite({ nome }: { nome: NomePagina }) {
  const { autenticado, carregando } = useAuth()
  // Quem já entrou e abre "/" vai direto pra Visão geral; as outras páginas do site abrem pra todo mundo.
  if (nome === "home" && !carregando && autenticado) return <Navigate to="/dashboard" replace />
  return <Pagina nome={nome} />
}

function Pagina({ nome }: { nome: NomePagina }) {
  const raiz = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { hash } = useLocation()
  usarFolhaDoSite()

  // Título da aba.
  useEffect(() => { document.title = titulos[nome] }, [nome])

  // DEV: na /casa, a barra de estados troca o caso pelo endereço (#casal…); religa a página pra ela abrir nele. Some no build.
  const casoDev = import.meta.env.DEV && nome === "casa" ? hash : ""

  // Liga os comportamentos sobre o HTML desta página (e desliga ao trocar de página).
  useLayoutEffect(() => {
    const el = raiz.current
    if (!el) return
    // O comum.js mexe no DOM (selos, barra presa, cabos da ponte): toda vez que liga, parte do HTML limpo da página.
    el.innerHTML = HTML[nome]
    window.scrollTo(0, 0)
    // O tema vale pelo que está no <html> (a tela pública abre no claro sem escolha salva, mesmo com o sistema escuro).
    const atual = (): Tema => (document.documentElement.dataset.tema === "escuro" ? "escuro" : "claro")
    return ligarSite(el, { tema: atual, alternarTema: () => definirTema(atual() === "escuro" ? "claro" : "escuro") })
  }, [nome, casoDev])

  // Âncora no endereço (#como, #lista-planos…): rola até ela depois de montar. O #casal/#familia/#ape da /casa é do seletor.
  useEffect(() => {
    if (!hash || nome === "casa") return
    document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash, nome])

  // Link interno (/recursos, /entrar…) navega pelo app, sem recarregar a página.
  const aoClicar = (ev: React.MouseEvent) => {
    const a = (ev.target as Element).closest("a")
    const href = a?.getAttribute("href")
    if (!a || !href?.startsWith("/") || a.target || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return
    ev.preventDefault()
    navigate(href)
  }

  return (
    <>
      <div ref={raiz} onClick={aoClicar} />
      {import.meta.env.DEV && nome === "casa" && (
        <BarraDev atual={hash.slice(1) || "casal"} grupos={[{ grupo: "Pra sua casa", estados: [
          { rotulo: "Casal", para: "/casa#casal" },
          { rotulo: "Família com filhos", para: "/casa#familia" },
          { rotulo: "Divide o apê", para: "/casa#ape" },
        ] }]} />
      )}
    </>
  )
}
