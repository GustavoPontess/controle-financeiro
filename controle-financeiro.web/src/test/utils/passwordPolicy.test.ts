import { describe, it, expect } from 'vitest'
import { getSenhaRequisitos } from '../../utils/passwordPolicy'

describe('getSenhaRequisitos', () => {
  it('falha quando senha tem menos de 15 chars', () => {
    const r = getSenhaRequisitos('Abcdefgh1!')
    expect(r[0].ok).toBe(false)
  })

  it('passa quando senha tem 15+ chars', () => {
    const r = getSenhaRequisitos('Abcdefghij12345!')
    expect(r[0].ok).toBe(true)
  })

  it('falha quando senha passa de 128 chars', () => {
    const r = getSenhaRequisitos('Aa1!'.repeat(40)) // 160 chars
    expect(r[0].ok).toBe(false)
  })

  it('falha com string vazia', () => {
    const r = getSenhaRequisitos('')
    expect(r[0].ok).toBe(false)
  })

  // NIST SP 800-63B: sem regra de composição — senha só com minúscula, sem
  // maiúscula/número/especial, passa se tiver 15+ chars.
  it('passa mesmo sem maiúscula/número/especial, só com o tamanho certo', () => {
    const r = getSenhaRequisitos('somenteminuscula')
    expect(r[0].ok).toBe(true)
  })
})
