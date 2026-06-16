/**
 * useHideBalance — store global de "ocultar saldo" (privacy toggle).
 *
 * Store externo simples (useSyncExternalStore) + localStorage, sem provider.
 * Arquivo de hook puro (sem componentes) pra não quebrar react-refresh.
 * Consumido por PontesSensitiveValue / PontesHideBalanceToggle (SensitiveValue.tsx).
 */

import { useSyncExternalStore, useCallback } from "react"

const KEY = "pontes:hideBalance"

function readInitial(): boolean {
  try { return localStorage.getItem(KEY) === "1" } catch { return false }
}

let hidden = readInitial()
const listeners = new Set<() => void>()

function emit() { listeners.forEach((l) => l()) }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }
function getSnapshot() { return hidden }

/** Leitura não-reativa do estado global (para formatadores fora de componente). */
export function isBalanceHidden(): boolean { return hidden }

/** Define o estado global de ocultar valores (persiste em localStorage). */
export function setHideBalance(value: boolean): void {
  hidden = value
  try { localStorage.setItem(KEY, value ? "1" : "0") } catch { /* ignore */ }
  emit()
}

/** Hook global: `[hidden, toggle]`. Sincroniza entre todas as instâncias. */
export function useHideBalance(): [boolean, () => void] {
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const toggle = useCallback(() => setHideBalance(!hidden), [])
  return [value, toggle]
}
