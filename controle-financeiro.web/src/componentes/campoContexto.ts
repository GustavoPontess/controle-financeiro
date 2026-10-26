// Contexto do Campo: o controle de dentro (Entrada, Selecao) descobre sozinho o id do rótulo,
// se está inválido e onde está a mensagem de erro.
import { createContext, useContext } from "react"

export type ContextoCampo = { id: string; erroId: string; invalido: boolean }
export const CampoContexto = createContext<ContextoCampo | null>(null)
export const useCampo = () => useContext(CampoContexto)
