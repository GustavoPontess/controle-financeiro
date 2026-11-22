// Ponte segura pro painel de dev (seletor de estados + atalhos da tela). Regra (CONVENCOES.md → "Painel de dev"): toda
// tela com mais de um jeito de ser vista declara os seus estados assim, SEMPRE dentro de `import.meta.env.DEV &&`:
//
//   const estadoDev = useEstadoDev(import.meta.env.DEV ? (e) => { /* põe a tela no estado e */ } : undefined)
//   …
//   {import.meta.env.DEV && <BarraDev atual={vista} grupos={[{ grupo: "Lista", estados: [{ rotulo: "Vazio", para: "/x#vazio" }, …] }]} />}
//
// Atalhos extras da tela (ex.: contas de teste do login) vão em `extras`, no mesmo painel.
//
// Toda tela tem o painel (Gustavo, 2026-11-17): a que não declara estados ganha o painel só com os atalhos gerais
// ("Sem sair por inatividade"), pelo <PainelDevDeTodaTela> do App.tsx, que some quando a tela põe o próprio.
//
// No `npm run build` o DEV vira false: o JSX, a lista de estados e o import dinâmico somem do pacote (a trava
// scripts/conferirDevFora.mjs procura os rótulos no dist e falha se achar).
import { lazy, Suspense, useEffect, useSyncExternalStore } from "react"
import { useLocation } from "react-router-dom"
import type { ExtrasDev, GruposEstadosDev } from "./tipos"

const Barra = import.meta.env.DEV ? lazy(() => import("./BarraEstadosDev")) : null

// Quantas telas abertas têm o próprio painel: com alguma, o painel geral sai (um painel só na tela).
let telasComPainel = 0
const ouvintesPainel = new Set<() => void>()
const assinarPainel = (o: () => void) => { ouvintesPainel.add(o); return () => { ouvintesPainel.delete(o) } }
const lerTelasComPainel = () => telasComPainel

export function BarraDev(props: { grupos: GruposEstadosDev; atual: string; extras?: ExtrasDev }) {
  useEffect(() => {
    if (!import.meta.env.DEV) return
    telasComPainel++; ouvintesPainel.forEach((o) => o())
    return () => { telasComPainel--; ouvintesPainel.forEach((o) => o()) }
  }, [])
  if (!Barra) return null
  return <Suspense fallback={null}><Barra {...props} /></Suspense>
}

/** O painel de dev nas telas que não declaram estados (só os atalhos gerais). Montado uma vez no App.tsx. */
export function PainelDevDeTodaTela() {
  const comPainel = useSyncExternalStore(assinarPainel, lerTelasComPainel, lerTelasComPainel)
  if (!Barra || comPainel > 0) return null
  return <Suspense fallback={null}><Barra grupos={[]} atual="" /></Suspense>
}

/** Lê o #estado do endereço (só em dev) e chama `aplicar` pra tela se pôr nele, sem passar pelo fluxo real. */
export function useEstadoDev(aplicar: ((estado: string) => void) | undefined) {
  const { hash } = useLocation()
  useEffect(() => {
    if (!import.meta.env.DEV || !aplicar || !hash) return
    aplicar(decodeURIComponent(hash.slice(1)))
  }, [hash]) // eslint-disable-line react-hooks/exhaustive-deps
}

// "Sem sair por inatividade" do painel, lido sem importar o módulo de dev (a chave é a mesma de dev/semInatividade.ts,
// montada em partes pra não aparecer no build; no build `import.meta.env.DEV` é false e isto devolve sempre false).
const CHAVE_SEM_INATIVIDADE = ["dev", "semInatividade"].join(":")
const lerSemInatividade = () => { try { return localStorage.getItem(CHAVE_SEM_INATIVIDADE) === "1" } catch { return false } }
const assinarArmazenamento = (o: () => void) => {
  const id = window.setInterval(o, 500)
  return () => window.clearInterval(id)
}
export function useSemInatividadeDev() {
  return useSyncExternalStore(import.meta.env.DEV ? assinarArmazenamento : () => () => {}, import.meta.env.DEV ? lerSemInatividade : () => false)
}
