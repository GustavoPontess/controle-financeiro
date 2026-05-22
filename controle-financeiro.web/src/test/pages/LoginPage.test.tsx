import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '../../pages/Auth/LoginPage'
import { PontesThemeProvider } from '../../components/pontes'

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
    <PontesThemeProvider>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </PontesThemeProvider>
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
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument()
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

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'user@test.com' } })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'senha123' } })
    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form')!)

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
  })

  it('exibe mensagem de erro quando login falha', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Email ou senha inválidos'))
    renderLogin()

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'user@test.com' } })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'errada' } })
    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form')!)

    await waitFor(() => expect(screen.getByText(/email ou senha inválidos/i)).toBeInTheDocument())
  })

  it('exibe erro genérico quando exceção não é Error', async () => {
    mockLogin.mockRejectedValueOnce('falha inesperada')
    renderLogin()

    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form')!)

    await waitFor(() => expect(screen.getByText(/erro ao fazer login/i)).toBeInTheDocument())
  })

  it('exibe botão voltar à página inicial', () => {
    renderLogin()
    const backBtn = screen.getByRole('link', { name: /voltar à página inicial/i })
    expect(backBtn).toBeInTheDocument()
    expect(backBtn).toHaveAttribute('href', '/')
  })

  it('toggle de senha alterna visibilidade do campo', () => {
    const { container } = renderLogin()
    expect(container.querySelector('input[type="password"]')).toBeInTheDocument()

    const toggleBtn = container.querySelector('[data-testid="toggle-senha"]')!
    fireEvent.click(toggleBtn)
    expect(container.querySelector('input[type="text"]')).toBeInTheDocument()

    fireEvent.click(toggleBtn)
    expect(container.querySelector('input[type="password"]')).toBeInTheDocument()
  })

  it('botão fica desabilitado durante o loading', async () => {
    mockLogin.mockImplementation(() => new Promise(() => {})) // never resolves
    const { container } = renderLogin()

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'u@test.com' } })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: '123' } })
    fireEvent.submit(container.querySelector('button[type="submit"]')!.closest('form')!)

    await waitFor(() =>
      expect(container.querySelector('button[type="submit"]')).toBeDisabled()
    )
  })
})
