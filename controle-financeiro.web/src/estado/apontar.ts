// Selo "Beta": o rascunho da solicitação mora AQUI (fora do formulário) pra sobreviver à navegação. A pessoa abre o
// formulário, pode sair pra "navegar pelo app" (barra flutuante no pé) e anexar prints e blocos apontados de outras
// telas, e voltar sem perder o que escreveu. O `Apontar` do layout mostra tudo. Recarregar a página perde o rascunho.
import { useSyncExternalStore } from "react"
import type { TipoSolicitacao } from "../types/Solicitacao"

export const MAXIMO_DE_ANEXOS = 5

export type AnexoRascunho = {
  id: string
  tipo: 1 | 2 // 1 print · 2 bloco apontado
  tela: string // rota
  rotuloTela: string // título da tela ("Relatórios")
  bloco: string | null
  textoDoBloco: string | null // já mascarado, a não ser que mostrarValores
  mostrarValores: boolean
  imagem: string // data URL
}

export type Rascunho = {
  formulario: boolean // o formulário está aberto
  navegando: boolean // a barra flutuante está no pé (formulário fechado, rascunho vivo)
  apontando: boolean // modo de escolher um bloco na tela
  origemDoApontar: "formulario" | "barra"
  tipo: TipoSolicitacao
  titulo: string
  descricao: string
  mostrarValores: boolean
  anexos: AnexoRascunho[]
}

const VAZIO: Rascunho = {
  formulario: false, navegando: false, apontando: false, origemDoApontar: "formulario",
  tipo: 1, titulo: "", descricao: "", mostrarValores: false, anexos: [],
}

let estado: Rascunho = VAZIO
const ouvintes = new Set<() => void>()
const assinar = (l: () => void) => { ouvintes.add(l); return () => { ouvintes.delete(l) } }
const mudar = (parcial: Partial<Rascunho>) => { estado = { ...estado, ...parcial }; ouvintes.forEach((l) => l()) }

export const useRascunho = () => useSyncExternalStore(assinar, () => estado, () => estado)
export const lerRascunho = () => estado

/** O selo Beta: abre o formulário (ou volta pra ele, se a pessoa estava navegando com um rascunho). */
export const abrirSolicitacao = () => mudar({ formulario: true, navegando: false, apontando: false })
/** × / Esc / clique fora: o formulário se recolhe pra barra no pé (com o rascunho) pra pessoa navegar e anexar de outras
 *  telas. Sem nada escrito nem anexado, só fecha. */
export const recolherFormulario = () => {
  const vazio = !estado.titulo.trim() && !estado.descricao.trim() && estado.anexos.length === 0
  if (vazio) mudar({ ...VAZIO })
  else mudar({ formulario: false, navegando: true, apontando: false })
}
export const iniciarApontar = () =>
  mudar({ apontando: true, origemDoApontar: estado.formulario ? "formulario" : "barra", formulario: false })
/** Sai do modo apontar e volta pra onde estava (formulário ou barra). */
export const pararApontar = () => mudar({ apontando: false, formulario: estado.origemDoApontar === "formulario", navegando: estado.origemDoApontar === "barra" })
export const editarRascunho = (parcial: Partial<Pick<Rascunho, "tipo" | "titulo" | "descricao" | "mostrarValores">>) => mudar(parcial)
export const adicionarAnexo = (a: AnexoRascunho) => mudar({ anexos: [...estado.anexos, a].slice(0, MAXIMO_DE_ANEXOS) })
export const removerAnexo = (id: string) => mudar({ anexos: estado.anexos.filter((a) => a.id !== id) })
/** Fecha tudo e joga o rascunho fora (Cancelar, depois de enviar). */
export const descartarRascunho = () => mudar(VAZIO)
