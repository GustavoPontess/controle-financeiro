// Ponte segura pra barra de estados de dev. Regra (CONVENCOES.md → "Barra de estados (dev)"): toda tela com mais de um
// jeito de ser vista declara os seus estados assim, SEMPRE dentro de `import.meta.env.DEV &&`:
//
//   const estadoDev = useEstadoDev(import.meta.env.DEV ? (e) => { /* põe a tela no estado e */ } : undefined)
//   …
//   {import.meta.env.DEV && <BarraDev atual={vista} grupos={[[{ rotulo: "Vazio", para: "/x#vazio" }, …]]} />}
//
// No `npm run build` o DEV vira false: o JSX, a lista de estados e o import dinâmico somem do pacote (a trava
// scripts/conferirDevFora.mjs procura os rótulos no dist e falha se achar).
import { lazy, Suspense, useEffect } from "react"
import { useLocation } from "react-router-dom"
import type { GruposEstadosDev } from "./tipos"

const Barra = import.meta.env.DEV ? lazy(() => import("./BarraEstadosDev")) : null

export function BarraDev(props: { grupos: GruposEstadosDev; atual: string }) {
  if (!Barra) return null
  return <Suspense fallback={null}><Barra {...props} /></Suspense>
}

/** Lê o #estado do endereço (só em dev) e chama `aplicar` pra tela se pôr nele, sem passar pelo fluxo real. */
export function useEstadoDev(aplicar: ((estado: string) => void) | undefined) {
  const { hash } = useLocation()
  useEffect(() => {
    if (!import.meta.env.DEV || !aplicar || !hash) return
    aplicar(decodeURIComponent(hash.slice(1)))
  }, [hash]) // eslint-disable-line react-hooks/exhaustive-deps
}
