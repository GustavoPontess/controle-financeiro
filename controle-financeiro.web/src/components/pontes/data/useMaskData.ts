/**
 * useMaskData — store global de "mascarar dados sensíveis" (privacy toggle do painel admin).
 *
 * Mesmo mecanismo do useHideBalance (store externo com useSyncExternalStore + localStorage, sem
 * provider), mas com chave própria e **default MASCARADO** (true): o painel admin nasce ocultando
 * PII (e-mails), e o admin revela sob demanda no olhinho. Consumido por PontesMaskedValue /
 * PontesMaskToggle (MaskedData.tsx).
 */

import { useSyncExternalStore, useCallback } from "react"

const KEY = "pontes:maskData"

function readInitial(): boolean {
  // Default mascarado: só fica revelado se o admin explicitamente gravou "0".
  try { return localStorage.getItem(KEY) !== "0" } catch { return true }
}

let masked = readInitial()
const listeners = new Set<() => void>()

function emit() { listeners.forEach((l) => l()) }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }
function getSnapshot() { return masked }

/** Leitura não-reativa do estado global (para formatadores fora de componente). */
export function isDataMasked(): boolean { return masked }

/** Define o estado global de mascarar dados (persiste em localStorage). */
export function setMaskData(value: boolean): void {
  masked = value
  try { localStorage.setItem(KEY, value ? "1" : "0") } catch { /* ignore */ }
  emit()
}

/** Hook global: `[masked, toggle]`. Sincroniza entre todas as instâncias. */
export function useMaskData(): [boolean, () => void] {
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const toggle = useCallback(() => setMaskData(!masked), [])
  return [value, toggle]
}

/**
 * Mascara um valor sensível preservando pistas mínimas de reconhecimento.
 * E-mail: `gu•••@g•••.com` (2 primeiros do local + 1º do host + TLD). Texto sem "@": primeiros 2
 * caracteres + `•••`. String vazia vira `—`.
 */
export function maskEmail(value?: string | null): string {
  const v = (value ?? "").trim()
  if (!v) return "—"

  const at = v.indexOf("@")
  if (at < 0) {
    // Não é e-mail (ex.: descrição livre) — mascara genérico, mantendo início pra reconhecer.
    return v.length <= 2 ? v[0] + "•••" : v.slice(0, 2) + "•••"
  }

  const local = v.slice(0, at)
  const domain = v.slice(at + 1)
  const localMasked = (local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2)) + "•••"

  const dot = domain.lastIndexOf(".")
  if (dot < 0) return `${localMasked}@${domain.slice(0, 1)}•••`
  const host = domain.slice(0, dot)
  const tld = domain.slice(dot) // inclui o ponto, ex.: ".com"
  return `${localMasked}@${host.slice(0, 1)}•••${tld}`
}
