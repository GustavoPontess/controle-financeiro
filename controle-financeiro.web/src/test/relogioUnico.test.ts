// Trava (2026-11-01, Gustavo: "solução correta e definitiva" pros problemas de hora): o front lê o relógio num lugar só,
// utils/dateTime.ts (agora, mesAtual, dataLocalISO). Lê o código do v2 e falha se uma tela voltar a chamar `new Date()`
// ou `Date.now()` direto, ou a tirar o dia de `toISOString()` (é o dia em UTC: das 21h à meia-noite de Brasília já é
// amanhã). `new Date(algo)` pra ler uma data continua livre; comentário pode.
import { describe, expect, it } from "vitest"

const fontes = import.meta.glob(["../**/*.{ts,tsx}", "!../test/**"], { query: "?raw", import: "default", eager: true }) as Record<string, string>

// Só estes leem o relógio: o relógio do app e a saída por inatividade (mede tempo parado, não decide dia).
const PODEM = ["../utils/dateTime.ts", "../auth/SairPorInatividade.tsx"]
const RELOGIO_SOLTO = /new Date\(\s*\)|Date\.now\(\s*\)/
const DIA_UTC = /toISOString\(\)\s*\.\s*(slice|substring)\(\s*0\s*,\s*10\s*\)|toISOString\(\)\s*\.\s*split\(\s*["'`]T["'`]\s*\)/

const achar = (padrao: RegExp, pular: string[] = []) =>
  Object.entries(fontes).filter(([arquivo]) => !pular.includes(arquivo)).flatMap(([arquivo, codigo]) =>
    codigo.split("\n").map((linha, i) => ({ arquivo, n: i + 1, texto: linha.trim() }))
      .filter((l) => !/^(\/\/|\*|\/\*|\{\/\*)/.test(l.texto) && padrao.test(l.texto))
      .map((l) => `${l.arquivo}:${l.n}: ${l.texto}`))

describe("relógio do front", () => {
  it("só utils/dateTime lê o relógio (use agora, mesAtual ou dataLocalISO)", () => {
    expect(achar(RELOGIO_SOLTO, PODEM)).toEqual([])
  })

  it("ninguém tira o dia de toISOString (use dataLocalISO)", () => {
    expect(achar(DIA_UTC)).toEqual([])
  })
})
