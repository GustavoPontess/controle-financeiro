import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RegisterPage from '../../pages/Auth/RegisterPage'
import { PontesThemeProvider } from '../../components/pontes'

const mockRegister = vi.fn()
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ register: mockRegister }),
}))

function renderRegister() {
  return render(
    <PontesThemeProvider>
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    </PontesThemeProvider>
  )
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza sem crash', () => {
    renderRegister()
    expect(screen.getByRole('button', { name: /criar conta/i })).toBeInTheDocument()
  })

  it('exibe campo de email', () => {
    renderRegister()
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument()
  })

  it('exibe campo de nome', () => {
    renderRegister()
    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument()
  })

  it('exibe campos de senha e confirmar senha', () => {
    const { container } = renderRegister()
    const passwordInputs = container.querySelectorAll('input[type="password"]')
    expect(passwordInputs.length).toBe(2)
  })

  it('não exibe indicador de força quando senha está vazia', () => {
    renderRegister()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('exibe indicador de força quando senha é digitada', () => {
    const { container } = renderRegister()
    const [senhaInput] = container.querySelectorAll('input[type="password"]')
    fireEvent.change(senhaInput, { target: { value: 'abc' } })
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('exibe requisito de comprimento com ✓ quando senha tem 10+ chars', () => {
    const { container } = renderRegister()
    const [senhaInput] = container.querySelectorAll('input[type="password"]')
    fireEvent.change(senhaInput, { target: { value: 'abcdefghij' } })
    expect(screen.getByText(/mínimo 10 caracteres/i)).toBeInTheDocument()
    const items = screen.getAllByText(/✓/)
    expect(items.length).toBeGreaterThan(0)
  })

  it('exibe erro quando senhas não conferem', async () => {
    const { container } = renderRegister()
    const [senhaInput, confirmarInput] = container.querySelectorAll('input[type="password"]')

    fireEvent.change(senhaInput, { target: { value: 'Tr0ub4dor&3' } })
    fireEvent.change(confirmarInput, { target: { value: 'diferente' } })
    fireEvent.submit(screen.getByRole('button', { name: /criar conta/i }).closest('form')!)

    await waitFor(() => expect(screen.getByText(/senhas não conferem/i)).toBeInTheDocument())
  })

  it('exibe erro quando senha não atende requisitos', async () => {
    const { container } = renderRegister()
    const [senhaInput, confirmarInput] = container.querySelectorAll('input[type="password"]')

    fireEvent.change(senhaInput, { target: { value: 'fraca' } })
    fireEvent.change(confirmarInput, { target: { value: 'fraca' } })
    fireEvent.submit(screen.getByRole('button', { name: /criar conta/i }).closest('form')!)

    await waitFor(() => expect(screen.getByText(/senha não atende/i)).toBeInTheDocument())
  })

  it('navega para /onboarding após registro bem-sucedido', async () => {
    mockRegister.mockResolvedValueOnce(undefined)
    const { container } = renderRegister()
    const [senhaInput, confirmarInput] = container.querySelectorAll('input[type="password"]')

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'u@test.com' } })
    fireEvent.change(screen.getByLabelText(/nome completo/i), { target: { value: 'Teste' } })
    fireEvent.change(senhaInput, { target: { value: 'Tr0ub4dor&3' } })
    fireEvent.change(confirmarInput, { target: { value: 'Tr0ub4dor&3' } })
    fireEvent.submit(screen.getByRole('button', { name: /criar conta/i }).closest('form')!)

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/onboarding'))
  })

  it('exibe erro retornado pelo backend', async () => {
    mockRegister.mockRejectedValueOnce(new Error('Email já cadastrado'))
    const { container } = renderRegister()
    const [senhaInput, confirmarInput] = container.querySelectorAll('input[type="password"]')

    fireEvent.change(senhaInput, { target: { value: 'Tr0ub4dor&3' } })
    fireEvent.change(confirmarInput, { target: { value: 'Tr0ub4dor&3' } })
    fireEvent.submit(screen.getByRole('button', { name: /criar conta/i }).closest('form')!)

    await waitFor(() => expect(screen.getByText(/email já cadastrado/i)).toBeInTheDocument())
  })

  it('exibe botão voltar à página inicial', () => {
    renderRegister()
    const backBtn = screen.getByRole('link', { name: /voltar à página inicial/i })
    expect(backBtn).toBeInTheDocument()
    expect(backBtn).toHaveAttribute('href', '/')
  })

  it('toggle de senha alterna visibilidade dos campos', () => {
    const { container } = renderRegister()
    expect(container.querySelectorAll('input[type="password"]').length).toBe(2)

    const toggleSenha = container.querySelector('[data-testid="toggle-senha"]')!

    fireEvent.click(toggleSenha)
    expect(container.querySelectorAll('input[type="password"]').length).toBe(1)

    fireEvent.click(toggleSenha)
    expect(container.querySelectorAll('input[type="password"]').length).toBe(2)
  })

  it('botão fica desabilitado durante o loading', async () => {
    mockRegister.mockImplementation(() => new Promise(() => {})) // never resolves
    const { container } = renderRegister()
    const [senhaInput, confirmarInput] = container.querySelectorAll('input[type="password"]')

    fireEvent.change(senhaInput, { target: { value: 'Tr0ub4dor&3' } })
    fireEvent.change(confirmarInput, { target: { value: 'Tr0ub4dor&3' } })
    fireEvent.submit(container.querySelector('button[type="submit"]')!.closest('form')!)

    await waitFor(() =>
      expect(container.querySelector('button[type="submit"]')).toBeDisabled()
    )
  })
})
