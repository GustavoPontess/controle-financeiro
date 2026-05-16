import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CustomButton from '../../components/CustomButton'

describe('CustomButton', () => {
  it('renderiza children corretamente', () => {
    render(<CustomButton>Clique aqui</CustomButton>)
    expect(screen.getByRole('button', { name: 'Clique aqui' })).toBeInTheDocument()
  })

  it('chama onClick quando clicado', () => {
    const handler = vi.fn()
    render(<CustomButton onClick={handler}>Ação</CustomButton>)
    fireEvent.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('não chama onClick quando disabled', () => {
    const handler = vi.fn()
    render(<CustomButton disabled onClick={handler}>Ação</CustomButton>)
    fireEvent.click(screen.getByRole('button'))
    expect(handler).not.toHaveBeenCalled()
  })

  it('renderiza variante primary sem erros', () => {
    render(<CustomButton variant="primary">Primary</CustomButton>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('renderiza variante danger sem erros', () => {
    render(<CustomButton variant="danger">Deletar</CustomButton>)
    expect(screen.getByRole('button', { name: 'Deletar' })).toBeInTheDocument()
  })

  it('renderiza variante secondary sem erros', () => {
    render(<CustomButton variant="secondary">Cancelar</CustomButton>)
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('renderiza variante ghost sem erros', () => {
    render(<CustomButton variant="ghost">Ghost</CustomButton>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('renderiza size small sem erros', () => {
    render(<CustomButton size="small">Pequeno</CustomButton>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('o botão está disabled quando prop disabled=true', () => {
    render(<CustomButton disabled>Bloqueado</CustomButton>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
