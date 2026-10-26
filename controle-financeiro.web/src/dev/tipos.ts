/** Um estado da tela pro painel de dev: rótulo e endereço (rota + #estado, ex.: "/entrar#duas-etapas"). */
export type EstadoDev = { rotulo: string; para: string }
/** Estados em grupos com nome (viram os grupos do seletor). */
export type GruposEstadosDev = { grupo: string; estados: EstadoDev[] }[]
/** Atalhos extras de uma tela no painel de dev (ex.: contas de teste do login): clique faz a ação. */
export type ExtrasDev = { titulo: string; itens: { rotulo: string; detalhe?: string; dica?: string; aoClicar: () => void }[] }
