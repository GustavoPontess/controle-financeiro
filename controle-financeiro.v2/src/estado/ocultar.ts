// "Olho": esconder valores. Mesma chave de localStorage do app atual — o que você esconde lá fica escondido aqui.
import { useSyncExternalStore, useCallback } from "react"

const CHAVE = "pontes:hideBalance"
let oculto = (() => { try { return localStorage.getItem(CHAVE) === "1" } catch { return false } })()
const ouvintes = new Set<() => void>()
const assinar = (l: () => void) => { ouvintes.add(l); return () => { ouvintes.delete(l) } }
const ler = () => oculto

export function isBalanceHidden(): boolean { return oculto }

export function setHideBalance(v: boolean): void {
  oculto = v
  try { localStorage.setItem(CHAVE, v ? "1" : "0") } catch { /* ignore */ }
  ouvintes.forEach((l) => l())
}

export function useHideBalance(): [boolean, () => void] {
  const v = useSyncExternalStore(assinar, ler, ler)
  const alternar = useCallback(() => setHideBalance(!oculto), [])
  return [v, alternar]
}
