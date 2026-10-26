/** Um estado da barra de dev: rótulo e endereço (rota + #estado, ex.: "/entrar#duas-etapas"). */
export type EstadoDev = { rotulo: string; para: string }
/** Grupos de estados (um separador entre grupos). */
export type GruposEstadosDev = EstadoDev[][]
