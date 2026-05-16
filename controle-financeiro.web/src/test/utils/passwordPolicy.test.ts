import { describe, it, expect } from 'vitest'
import { getSenhaRequisitos, getSenhaForca } from '../../utils/passwordPolicy'

describe('getSenhaRequisitos', () => {
  it('falha no comprimento quando senha tem menos de 10 chars', () => {
    const r = getSenhaRequisitos('Ab1!')
    expect(r[0].ok).toBe(false)
  })

  it('passa no comprimento quando senha tem 10+ chars', () => {
    const r = getSenhaRequisitos('Abcdefgh1!')
    expect(r[0].ok).toBe(true)
  })

  it('falha em minúscula quando não há letra minúscula', () => {
    const r = getSenhaRequisitos('ABCDEFGH1!')
    expect(r[1].ok).toBe(false)
  })

  it('passa em minúscula quando há letra minúscula', () => {
    const r = getSenhaRequisitos('abcDEFGH1!')
    expect(r[1].ok).toBe(true)
  })

  it('falha em maiúscula quando não há letra maiúscula', () => {
    const r = getSenhaRequisitos('abcdefgh1!')
    expect(r[2].ok).toBe(false)
  })

  it('passa em maiúscula quando há letra maiúscula', () => {
    const r = getSenhaRequisitos('abcDEFGH1!')
    expect(r[2].ok).toBe(true)
  })

  it('falha em número quando não há dígito', () => {
    const r = getSenhaRequisitos('Abcdefgh!@')
    expect(r[3].ok).toBe(false)
  })

  it('passa em número quando há dígito', () => {
    const r = getSenhaRequisitos('Abcdefg1!@')
    expect(r[3].ok).toBe(true)
  })

  it('falha em especial quando não há caractere especial', () => {
    const r = getSenhaRequisitos('Abcdefgh12')
    expect(r[4].ok).toBe(false)
  })

  it('passa em especial quando há caractere especial', () => {
    const r = getSenhaRequisitos('Abcdefg1!@')
    expect(r[4].ok).toBe(true)
  })

  it('todos os requisitos ok com senha forte', () => {
    const r = getSenhaRequisitos('Tr0ub4dor&3')
    expect(r.every((req) => req.ok)).toBe(true)
  })

  it('todos os requisitos falham com string vazia', () => {
    const r = getSenhaRequisitos('')
    expect(r.every((req) => req.ok)).toBe(false)
  })
})

describe('getSenhaForca', () => {
  it('retorna 0 para senha vazia', () => {
    const r = getSenhaRequisitos('')
    expect(getSenhaForca(r)).toBe(0)
  })

  it('retorna 5 para senha forte', () => {
    const r = getSenhaRequisitos('Tr0ub4dor&3')
    expect(getSenhaForca(r)).toBe(5)
  })

  it('retorna valor parcial corretamente', () => {
    const r = getSenhaRequisitos('abcdefghij')
    // tem minúscula e comprimento (>=10), sem maiúscula, número, especial
    expect(getSenhaForca(r)).toBe(2)
  })
})
