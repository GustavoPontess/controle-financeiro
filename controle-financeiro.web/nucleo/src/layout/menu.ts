// Núcleo (modelo): o que o layout mostra. É o ÚNICO arquivo do layout que o projeto edita (o V2Layout.tsx e o CSS
// vêm do núcleo e não se mexe). Os itens abaixo são exemplo: troque pelos do produto.
import { BarChart3, CalendarDays, LayoutDashboard, MessageCircle, Settings2, Users } from "lucide-react"

export type ItemMenu = { para: string; rotulo: string; icone: typeof LayoutDashboard; exato?: boolean }
/** Tela fora do menu (pelo sino, pelo menu da conta) ou interna de uma seção: dá o título do topo e a raiz do "voltar". */
export type Secao = { para: string; rotulo: string; raiz?: string; semMenu?: boolean }

export const NOME_DO_APP = "Pontes"
/** Símbolo do menu (arquivo em public/). */
export const LOGO = "/icon.svg"

/** Menu principal, na ordem. */
export const PRINCIPAL: ItemMenu[] = [
  { para: "/inicio", rotulo: "Visão geral", icone: LayoutDashboard },
  { para: "/agenda", rotulo: "Agenda", icone: CalendarDays },
  { para: "/conversas", rotulo: "Conversas", icone: MessageCircle },
  { para: "/relatorios", rotulo: "Relatórios", icone: BarChart3 },
]
/** Segundo grupo do menu (cadastros), com o rótulo. */
export const GRUPO = { rotulo: "Gerenciar", itens: [
  { para: "/clientes", rotulo: "Clientes", icone: Users },
  { para: "/ajustes", rotulo: "Ajustes", icone: Settings2 },
] as ItemMenu[] }
/** Telas fora do menu: o topo mostra a seta de voltar pra onde a pessoa estava. */
export const OUTRAS: Secao[] = [
  { para: "/configuracoes", rotulo: "Configurações", semMenu: true },
  { para: "/notificacoes", rotulo: "Notificações", semMenu: true },
]
/** O botão principal do topo (no celular, a bola do meio da barra de baixo). */
export const ACAO_PRINCIPAL = { rotulo: "Novo horário", para: "/agenda/novo" }
/** Barra de baixo no celular: 2 itens, a ação principal no meio, 1 item e o Menu. */
export const ATALHOS: [ItemMenu, ItemMenu, ItemMenu] = [PRINCIPAL[0], PRINCIPAL[1], PRINCIPAL[2]]
/** Pra onde vai quem entra, troca de conta ou clica na própria conta. */
export const INICIO = "/inicio"
