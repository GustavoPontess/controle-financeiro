// Regras de empréstimo usadas por mais de uma tela (lista, formulários). Linguagem de fato, sem cobrança (memória
// "copy sensível"): "falta voltar" (o que você emprestou) e "falta devolver" (o que você pegou); nunca deve, dívida,
// cobrar, a receber ou a pagar. Decisão do Gustavo, 2026-10-19.
import type { Emprestimo } from "../types/Emprestimo"
import { FormaPagamentoEmprestimo, StatusVinculoEmprestimo, TipoEmprestimo } from "../types/Emprestimo"

/** Você emprestou (o dinheiro volta pra você)? O tipo já vem relativo a quem olha. */
export const emprestei = (e: Pick<Emprestimo, "tipo">) => e.tipo === TipoEmprestimo.Emprestei

/** Quem está do outro lado: o nome que a pessoa deu ("Itaú", "João"; o servidor já troca pelo nome de quem criou, se
 *  for o caso). O nome do catálogo de bancos é a razão social ("ITAÚ UNIBANCO S.A."), só reserva. */
export const quemDoOutroLado = (e: Emprestimo) => e.pessoa || e.bancoNome || "Empréstimo"

export const parcelado = (e: Pick<Emprestimo, "formaPagamento">) => e.formaPagamento === FormaPagamentoEmprestimo.Parcelado

/** "Falta voltar" ou "Falta devolver". */
export const rotuloFalta = (e: Pick<Emprestimo, "tipo">) => (emprestei(e) ? "Falta voltar" : "Falta devolver")

/** "Já voltou" ou "Já devolvi". */
export const rotuloPago = (e: Pick<Emprestimo, "tipo">) => (emprestei(e) ? "Já voltou" : "Já devolvi")

/** Botão de registrar: "Registrar o que voltou" (quem emprestou) ou "Registrar o que devolvi" (quem pegou). */
export const rotuloRegistrar = (e: Pick<Emprestimo, "tipo">) => (emprestei(e) ? "Registrar o que voltou" : "Registrar o que devolvi")

/** O outro também acompanha (aceitou o convite). */
export const acompanhaJunto = (e: Pick<Emprestimo, "statusVinculo">) => e.statusVinculo === StatusVinculoEmprestimo.Vinculado
export const conviteEnviado = (e: Pick<Emprestimo, "statusVinculo">) => e.statusVinculo === StatusVinculoEmprestimo.PendenteAceite

/** "dia 25" no mês de hoje; "5/11" em outro mês (dia de calendário, sem fuso). */
export function quandoCurto(iso: string, hoje = new Date()): string {
  const [a, m, d] = [Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10))]
  return a === hoje.getFullYear() && m === hoje.getMonth() + 1 ? `dia ${d}` : `${d}/${m}`
}

/** "2,5" → 2.5; vazio → 0; texto que não é número → null (o formulário mostra o erro em vez de salvar sem juros). */
export function parsePercentual(texto: string): number | null {
  const t = texto.trim().replace(",", ".")
  if (!t) return 0
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

/** "YYYY-MM-DD" do formulário → meio-dia UTC (o dia não escorrega pra véspera em fuso nenhum do Brasil). */
export const meioDiaUtc = (dia: string) => `${dia}T12:00:00Z`

/** A categoria de "empréstimo" (se a pessoa tiver uma), pra já vir escolhida no lançamento. */
export const categoriaDeEmprestimo = <T extends { descricao: string }>(cats: T[]) =>
  cats.find((c) => /empr[eé]stim/i.test(c.descricao))

/** O que dá pra digitar num campo de %: dígitos e UMA vírgula, até duas casas ("2,5", "10", "1,99"). */
export function soPercentual(texto: string): string {
  const [inteiro, ...resto] = texto.replace(/[^\d,]/g, "").split(",")
  return resto.length === 0 ? inteiro.slice(0, 3) : `${inteiro.slice(0, 3)},${resto.join("").slice(0, 2)}`
}
