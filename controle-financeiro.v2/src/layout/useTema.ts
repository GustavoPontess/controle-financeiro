// Tema do front v2 (claro/escuro): lembrado por dispositivo; sem escolha, segue o sistema.
// Estado compartilhado (mesmo padrão do "olho"): a escolha mora em Configurações e o documento inteiro
// (tokens no :root) reage na hora, de qualquer tela.
import { useSyncExternalStore } from "react"

export type Tema = "claro" | "escuro"
const CHAVE = "v2:tema"

function inicial(): Tema {
  try {
    const salvo = localStorage.getItem(CHAVE)
    if (salvo === "claro" || salvo === "escuro") return salvo
  } catch { /* privado/bloqueado → segue o sistema */ }
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "escuro" : "claro"
}

let tema: Tema = inicial()
const ouvintes = new Set<() => void>()
const assinar = (l: () => void) => { ouvintes.add(l); return () => { ouvintes.delete(l) } }
const ler = () => tema

/** Aplica no <html data-tema> (o index.html já faz isso antes do 1º desenho) e lembra no dispositivo. */
export function definirTema(novo: Tema): void {
  tema = novo
  document.documentElement.dataset.tema = novo
  try { localStorage.setItem(CHAVE, novo) } catch { /* ignore */ }
  ouvintes.forEach((l) => l())
}

export function useTema(): [Tema, (novo: Tema) => void] {
  return [useSyncExternalStore(assinar, ler, ler), definirTema]
}
