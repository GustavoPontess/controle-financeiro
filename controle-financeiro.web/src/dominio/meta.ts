// Rótulos, ícones e contas de Metas no v2 (um lugar só pra lista, página da meta, formulário e guardar/resgatar).
import type { LucideIcon } from "lucide-react"
import { Baby, Car, Gift, GraduationCap, HeartPulse, House, PartyPopper, PawPrint, Plane, ShieldCheck, Smartphone, Target } from "lucide-react"
import type { Meta, SituacaoMeta } from "../types/Meta"

/** Mesmo limite do servidor (CriarMetaDto, nome da caixinha). */
export const MAX_NOME_META = 100

/** Os ícones que o servidor aceita (MetaService.Icones), na ordem do formulário. */
export const ICONES_META: { chave: string; rotulo: string; Icone: LucideIcon }[] = [
  { chave: "alvo", rotulo: "Meta", Icone: Target },
  { chave: "emergencia", rotulo: "Emergência", Icone: ShieldCheck },
  { chave: "viagem", rotulo: "Viagem", Icone: Plane },
  { chave: "casa", rotulo: "Casa", Icone: House },
  { chave: "carro", rotulo: "Carro", Icone: Car },
  { chave: "estudos", rotulo: "Estudos", Icone: GraduationCap },
  { chave: "presente", rotulo: "Presente", Icone: Gift },
  { chave: "saude", rotulo: "Saúde", Icone: HeartPulse },
  { chave: "pet", rotulo: "Pet", Icone: PawPrint },
  { chave: "festa", rotulo: "Festa", Icone: PartyPopper },
  { chave: "celular", rotulo: "Celular", Icone: Smartphone },
  { chave: "bebe", rotulo: "Bebê", Icone: Baby },
]
export const iconeDaMeta = (chave: string | null | undefined): LucideIcon =>
  ICONES_META.find((i) => i.chave === chave)?.Icone ?? Target

/** Sugestões na meta nova: um toque preenche o nome e o ícone. */
export const TEMAS_META: { nome: string; icone: string }[] = [
  { nome: "Reserva de emergência", icone: "emergencia" },
  { nome: "Viagem", icone: "viagem" },
  { nome: "Entrada da casa", icone: "casa" },
  { nome: "Carro", icone: "carro" },
  { nome: "Estudos", icone: "estudos" },
  { nome: "Casamento", icone: "festa" },
  { nome: "Celular novo", icone: "celular" },
  { nome: "Chegada do bebê", icone: "bebe" },
]

/** Etiqueta da situação; "sem-prazo" não ganha etiqueta (o cartão já mostra a porcentagem). */
export const SITUACAO_META: Record<SituacaoMeta, { rotulo: string; tom?: "positivo" | "negativo" | "alerta" } | null> = {
  "concluida": { rotulo: "Concluída", tom: "positivo" },
  "chegou-la": { rotulo: "Chegou lá", tom: "positivo" },
  "no-ritmo": { rotulo: "No ritmo", tom: "positivo" },
  "atras": { rotulo: "Atrás do ritmo", tom: "alerta" },
  "prazo-passou": { rotulo: "Prazo passou", tom: "negativo" },
  "sem-prazo": null,
}
/** O que a barra e o número grande mostram: o que juntou (concluída) ou o que está guardado. */
export const progressoDaMeta = (m: Pick<Meta, "guardado" | "concluidaEm" | "valorJuntado">) =>
  m.concluidaEm ? m.valorJuntado ?? 0 : m.guardado

/** Cor da barra de progresso pela situação. */
export const tomDaBarra = (s: SituacaoMeta): "positivo" | "alerta" | undefined =>
  s === "concluida" || s === "chegou-la" ? "positivo" : s === "atras" || s === "prazo-passou" ? "alerta" : undefined
/** Ícone em verde: chegou lá ou concluída. */
export const metaNoVerde = (s: SituacaoMeta) => s === "concluida" || s === "chegou-la"

/** "Criar outra igual": nome, ícone, quanto e a mesma DURAÇÃO do prazo, contada a partir de agora (a original
 *  pode ter prazo no passado). `meses` = quantos meses o prazo tinha contando o mês em que foi criada. */
export type ModeloMeta = { nome: string; icone: string; valorAlvo: number; meses: number | null }
export function modeloDaMeta(m: Pick<Meta, "nome" | "icone" | "valorAlvo" | "dataLimite" | "criadoEm">): ModeloMeta {
  const meses = m.dataLimite
    ? Math.max(1, (Number(m.dataLimite.slice(0, 4)) - Number(m.criadoEm.slice(0, 4))) * 12 + (Number(m.dataLimite.slice(5, 7)) - Number(m.criadoEm.slice(5, 7))) + 1)
    : null
  return { nome: m.nome, icone: m.icone, valorAlvo: m.valorAlvo, meses }
}

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

/** "dez/2027" a partir de "2027-12-01..." */
export function mesAnoCurto(iso: string): string {
  const [a, m] = iso.slice(0, 7).split("-").map(Number)
  return `${MESES_CURTOS[m - 1]}/${a}`
}

/** "YYYY-MM-01" do mês escolhido. */
export const prazoIso = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}-01`
