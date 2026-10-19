// Espaço de trabalho do v2: Pessoal ou uma família (modelo Notion/Slack, decisão do Gustavo em 2026-10-18).
// A URL diz qual (/familias/:id/... é o espaço daquela família; o resto é pessoal). Aqui mora só o que o
// seletor do menu precisa (as famílias da pessoa e quantos convites esperam) e o mês que as páginas da
// família estão olhando (trocar em Visão geral vale em Despesas e Entre vocês).
import { useEffect, useSyncExternalStore } from "react"
import { getConvitesPendentes, getFamilias } from "../services/familiaService"
import type { Familia } from "../types/Familia"
import { periodoDeHoje, type Periodo } from "../componentes/NavegadorMes"

type Espacos = { familias: Familia[]; convites: number; carregado: boolean }
let espacos: Espacos = { familias: [], convites: 0, carregado: false }
const ouvintes = new Set<() => void>()
const assinar = (l: () => void) => { ouvintes.add(l); return () => { ouvintes.delete(l) } }
const ler = () => espacos

/** Pede de novo as famílias e os convites (nova família, convite aceito, família dissolvida). */
export async function recarregarEspacos(): Promise<void> {
  try {
    const [familias, convites] = await Promise.all([getFamilias(), getConvitesPendentes().catch(() => [])])
    espacos = { familias, convites: convites.length, carregado: true }
  } catch {
    espacos = { ...espacos, carregado: true }
  }
  ouvintes.forEach((l) => l())
}

/** As famílias da CONTA ativa, pro menu: carrega ao montar, ao trocar de conta e a cada troca de tela
 *  dentro de /familias (é onde família nasce, convite se aceita e família se dissolve). */
export function useEspacos(pathname: string, usuarioId?: string): Espacos {
  const chave = `${usuarioId ?? ""}:${pathname.startsWith("/familias") ? pathname : "pessoal"}`
  useEffect(() => { void recarregarEspacos() }, [chave])
  return useSyncExternalStore(assinar, ler, ler)
}

/** Id da família que a rota aponta (/familias/<id>...), ou null no espaço pessoal.
 *  "/familias" (lista e convites) e "/familias/nova" não são espaço de família. */
export function familiaDaRota(pathname: string): string | null {
  const m = /^\/familias\/([^/]+)/.exec(pathname)
  return m && m[1] !== "nova" ? m[1] : null
}

let periodo: Periodo = periodoDeHoje()
const ouvintesPeriodo = new Set<() => void>()
const assinarPeriodo = (l: () => void) => { ouvintesPeriodo.add(l); return () => { ouvintesPeriodo.delete(l) } }
const lerPeriodo = () => periodo
const definirPeriodo = (p: Periodo) => { periodo = p; ouvintesPeriodo.forEach((l) => l()) }

/** O mês que as páginas da família olham: um só pro espaço inteiro. */
export function usePeriodoFamilia(): [Periodo, (p: Periodo) => void] {
  return [useSyncExternalStore(assinarPeriodo, lerPeriodo, lerPeriodo), definirPeriodo]
}
