import { describe, it, expect } from "vitest"

// Trava da migração pro padrão de telas (skill pontes-telas): as telas fora do padrão ficam
// listadas em eslint-legado-telas.js e escapam do lint. A lista SÓ ENCOLHE. Migrou uma tela?
// Tire-a da lista e baixe o TETO pro novo tamanho.
const TETO = 19

const legado = import.meta.glob<{ TELAS_LEGADO: string[] }>("../../eslint-legado-telas.js", { eager: true })
const TELAS_LEGADO = Object.values(legado)[0].TELAS_LEGADO
const paginas = Object.keys(import.meta.glob("/src/pages/**/*.tsx"))

describe("telas fora do padrão (eslint-legado-telas.js)", () => {
  it("a lista não cresce", () => {
    expect(TELAS_LEGADO.length).toBeLessThanOrEqual(TETO)
  })

  it("toda tela listada existe (tela migrada ou apagada sai da lista)", () => {
    const inexistentes = TELAS_LEGADO.filter((t) => !paginas.includes(`/${t}`))
    expect(inexistentes).toEqual([])
  })
})
