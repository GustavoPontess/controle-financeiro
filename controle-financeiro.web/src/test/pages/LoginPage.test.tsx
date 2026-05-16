import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '../../pages/Auth/LoginPage'

const mockLogin = vi.fn()
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ login: mockLogin }),
}))

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza sem crash', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('exibe campo de email', () => {
    renderLogin()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('exibe campo de senha', () => {
    renderLogin()
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument()
  })

  it('exibe botão de submit', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })

  it('exibe link para criar conta', () => {
    renderLogin()
    expect(screen.getByText(/criar conta/i)).toBeInTheDocument()
  })

  it('navega para home após login bem-sucedido', async () => {
    mockLogin.mockResolvedValueOnce(undefined)
    renderLogin()

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@test.com' } })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'senha123' } })
    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form')!)

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
  })

  it('exibe mensagem de erro quando login falha', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Email ou senha inválidos'))
    renderLogin()

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@test.com' } })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'errada' } })
    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form')!)

    await waitFor(() => expect(screen.getByText('Email ou senha inválidos')).toBeInTheDocument())
  })

  it('exibe erro genérico quando exceção não é Error', async () => {
    mockLogin.mockRejectedValueOnce('falha inesperada')
    renderLogin()

    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form')!)

    await waitFor(() => expect(screen.getByText('Erro ao fazer login')).toBeInTheDocument())
  })
})
