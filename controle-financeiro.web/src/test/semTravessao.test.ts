// Trava (2026-10-20, Gustavo: travessão em texto que a pessoa lê é "marca de IA"): nenhum texto do v2 leva "—".
// Campo vazio diz o que é ("Sem categoria", "Não informado"); frase usa ponto, vírgula ou dois-pontos. Lê o código das
// telas e componentes e falha se um texto entre aspas ou crases voltar a ter travessão; comentário pode.
import { describe, expect, it } from "vitest"

const fontes = import.meta.glob(["../**/*.{ts,tsx}", "!../test/**"], { query: "?raw", import: "default", eager: true }) as Record<string, string>
const TEXTO_COM_TRAVESSAO = /(["'`])[^"'`]*—[^"'`]*\1/

describe("textos do v2", () => {
  it("não têm travessão", () => {
    const achados = Object.entries(fontes).flatMap(([arquivo, codigo]) =>
      codigo.split("\n").map((linha, i) => ({ arquivo, n: i + 1, texto: linha.trim() }))
        .filter((l) => !/^(\/\/|\*|\/\*|\{\/\*)/.test(l.texto) && TEXTO_COM_TRAVESSAO.test(l.texto))
        .map((l) => `${l.arquivo}:${l.n}: ${l.texto}`))
    expect(achados).toEqual([])
  })
})
