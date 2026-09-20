import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '../../pages/Auth/LoginPage'
import { PontesThemeProvider } from '../../components/pontes'

const mockLogin = vi.fn()
const mockVerificarMfaLogin = vi.fn()
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ login: mockLogin, verificarMfaLogin: mockVerificarMfaLogin }),
}))

const mockRosterListar = vi.fn().mockResolvedValue([])
const mockRosterObterEmail = vi.fn()
const mockRosterRemover = vi.fn().mockResolvedValue(undefined)
vi.mock('@/services/rosterService', () => ({
  default: {
    listar: () => mockRosterListar(),
    obterEmail: (id: string) => mockRosterObterEmail(id),
    remover: (id: string) => mockRosterRemover(id),
    esquecerTodas: vi.fn(),
  },
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
    mockRosterListar.mockResolvedValue([]) // sem contas lembradas → mostra o form direto
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

  it('link da Política de Privacidade aponta pra /privacidade', () => {
    renderLogin()
    const link = screen.getByRole('link', { name: /política de privacidade/i })
    expect(link).toHaveAttribute('href', '/privacidade')
  })

  it('link dos Termos de Uso aponta pra /termos-de-uso', () => {
    renderLogin()
    const link = screen.getByRole('link', { name: /termos de uso/i })
    expect(link).toHaveAttribute('href', '/termos-de-uso')
  })

  it('navega para home após login bem-sucedido', async () => {
    mockLogin.mockResolvedValueOnce({ mfaRequerido: false })
    renderLogin()

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'user@test.com' } })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'senha123' } })
    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form')!)

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
  })

  it('mostra passo do código quando login pede MFA e completa com verificarMfaLogin', async () => {
    mockLogin.mockResolvedValueOnce({ mfaRequerido: true, challengeToken: 'chal-123' })
    mockVerificarMfaLogin.mockResolvedValueOnce(undefined)
    renderLogin()

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'user@test.com' } })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'senha123' } })
    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form')!)

    // Trocou pra tela do 2º fator — não navegou ainda.
    await waitFor(() => expect(screen.getByText(/verificação em duas etapas/i)).toBeInTheDocument())
    expect(mockNavigate).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: '123456' } })
    fireEvent.submit(screen.getByRole('button', { name: /verificar/i }).closest('form')!)

    // Checkboxes "confiar" e "manter conectado" desmarcados por padrão (opt-in) → 3º/4º arg false.
    await waitFor(() => expect(mockVerificarMfaLogin).toHaveBeenCalledWith('chal-123', '123456', false, false))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
  })

  it('marca "confiar neste dispositivo" e envia o opt-in (3º arg true) ao verificar o MFA', async () => {
    mockLogin.mockResolvedValueOnce({ mfaRequerido: true, challengeToken: 'chal-xyz' })
    mockVerificarMfaLogin.mockResolvedValueOnce(undefined)
    renderLogin()

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'user@test.com' } })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'senha123' } })
    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form')!)

    await waitFor(() => expect(screen.getByText(/verificação em duas etapas/i)).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: '123456' } })
    // Opt-in: marca o "confiar neste dispositivo" (é um botão com o rótulo).
    fireEvent.click(screen.getByRole('button', { name: /confiar neste dispositivo/i }))
    fireEvent.submit(screen.getByRole('button', { name: /verificar/i }).closest('form')!)

    await waitFor(() => expect(mockVerificarMfaLogin).toHaveBeenCalledWith('chal-xyz', '123456', true, false))
  })

  it('marca "manter-me conectado" e envia o opt-in (3º arg true) ao logar', async () => {
    mockLogin.mockResolvedValueOnce({ mfaRequerido: false })
    renderLogin()

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'user@test.com' } })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'senha123' } })
    fireEvent.click(screen.getByRole('button', { name: /manter-me conectado/i }))
    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form')!)

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('user@test.com', 'senha123', true))
  })

  it('mostra o chooser quando há contas lembradas e selecionar pré-preenche o e-mail', async () => {
    mockRosterListar.mockResolvedValueOnce([
      { usuarioId: 'u1', nome: 'Gustavo', emailMascarado: 'gu•••@gmail.com' },
    ])
    mockRosterObterEmail.mockResolvedValueOnce('gustavo@gmail.com')
    renderLogin()

    // Chooser aparece com nome + e-mail mascarado (não o inteiro).
    await waitFor(() => expect(screen.getByText('Gustavo')).toBeInTheDocument())
    expect(screen.getByText('gu•••@gmail.com')).toBeInTheDocument()
    expect(screen.queryByText('gustavo@gmail.com')).not.toBeInTheDocument()

    // Selecionar → revela o e-mail real e vai pro form (só falta a senha).
    fireEvent.click(screen.getByText('Gustavo'))
    await waitFor(() => expect(mockRosterObterEmail).toHaveBeenCalledWith('u1'))
    // Chip da conta no topo (mascarado) e o campo de e-mail some — só falta a senha.
    await waitFor(() => expect(screen.getByText('gu•••@gmail.com')).toBeInTheDocument())
    expect(screen.queryByLabelText(/e-mail/i)).not.toBeInTheDocument()
  })

  it('do form dá pra voltar pra lista de contas salvas sem sair da tela de login', async () => {
    mockRosterListar.mockResolvedValueOnce([
      { usuarioId: 'u1', nome: 'Gustavo', emailMascarado: 'gu•••@gmail.com' },
    ])
    renderLogin()
    await waitFor(() => expect(screen.getByText('Gustavo')).toBeInTheDocument())

    // Vai pro form ("entrar em outra conta")…
    fireEvent.click(screen.getByRole('button', { name: /entrar em outra conta/i }))
    await waitFor(() => expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument())

    // …e consegue VOLTAR pra lista direto do form.
    fireEvent.click(screen.getByRole('button', { name: /escolher conta salva/i }))
    await waitFor(() => expect(screen.getByText('Gustavo')).toBeInTheDocument())
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

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'user@test.com' } })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'senha123' } })
    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form')!)

    await waitFor(() => expect(screen.getByText(/erro ao fazer login/i)).toBeInTheDocument())
  })

  it('submit vazio bloqueia e mostra erro por campo (sem chamar login)', () => {
    renderLogin()
    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form')!)
    expect(mockLogin).not.toHaveBeenCalled()
    expect(screen.getByText('Informe o e-mail')).toBeInTheDocument()
    expect(screen.getByText('Informe a senha')).toBeInTheDocument()
  })

  it('e-mail inválido mostra erro e bloqueia', () => {
    renderLogin()
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'invalido' } })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'senha123' } })
    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form')!)
    expect(mockLogin).not.toHaveBeenCalled()
    expect(screen.getByText('E-mail inválido')).toBeInTheDocument()
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
