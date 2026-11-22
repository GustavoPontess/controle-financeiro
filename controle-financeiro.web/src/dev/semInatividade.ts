// SÓ EM DESENVOLVIMENTO (pedido do Gustavo, 2026-11-06): chave do painel de dev "Sem sair por inatividade".
// Ligada, o login já vem com "Manter-me conectado" e a sessão aberta sem ele não cai (o ManterVivoDev pergunta o
// /auth/me de 5 em 5 min, o que renova o refresh antes do limite do servidor). Fica no navegador (localStorage).
// Nunca importar fora de `import.meta.env.DEV`: a trava scripts/conferirDevFora.mjs procura a chave no dist.
import { useSyncExternalStore } from "react"

const CHAVE = "dev:semInatividade"
const ouvintes = new Set<() => void>()

export const semInatividade = (): boolean => {
  try { return localStorage.getItem(CHAVE) === "1" } catch { return false }
}
export const definirSemInatividade = (ligada: boolean) => {
  try { if (ligada) localStorage.setItem(CHAVE, "1"); else localStorage.removeItem(CHAVE) } catch { /* sem armazenamento */ }
  ouvintes.forEach((o) => o())
}
const assinar = (o: () => void) => { ouvintes.add(o); return () => { ouvintes.delete(o) } }
export const useSemInatividade = () => useSyncExternalStore(assinar, semInatividade)
