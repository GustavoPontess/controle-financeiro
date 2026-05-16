import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Box, Container, TextField, Typography, Alert, CircularProgress, LinearProgress } from '@mui/material'
import CustomButton from '../../components/CustomButton'
import { useAuth } from '../../hooks/useAuth'

interface SenhaRequisito {
  label: string
  ok: boolean
}

function getSenhaRequisitos(senha: string): SenhaRequisito[] {
  return [
    { label: 'Mínimo 10 caracteres', ok: senha.length >= 10 },
    { label: '1 letra minúscula', ok: /[a-z]/.test(senha) },
    { label: '1 letra maiúscula', ok: /[A-Z]/.test(senha) },
    { label: '1 número', ok: /[0-9]/.test(senha) },
    { label: '1 caractere especial (!@#$%^&*…)', ok: /[^a-zA-Z0-9]/.test(senha) },
  ]
}

function getSenhaForca(requisitos: SenhaRequisito[]): number {
  return requisitos.filter((r) => r.ok).length
}

function PasswordStrengthIndicator({ senha }: { senha: string }) {
  if (!senha) return null
  const requisitos = getSenhaRequisitos(senha)
  const forca = getSenhaForca(requisitos)
  const progresso = (forca / requisitos.length) * 100
  const cor = forca <= 2 ? '#ef4444' : forca <= 3 ? '#f59e0b' : forca === 4 ? '#3b82f6' : '#22c55e'

  return (
    <Box sx={{ mt: -1 }}>
      <LinearProgress
        variant="determinate"
        value={progresso}
        sx={{
          height: 4,
          borderRadius: 2,
          backgroundColor: '#e5e7eb',
          '& .MuiLinearProgress-bar': { backgroundColor: cor, borderRadius: 2 },
        }}
      />
      <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {requisitos.map((r) => (
          <Typography key={r.label} fontSize={11} color={r.ok ? '#22c55e' : '#9ca3af'} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {r.ok ? '✓' : '○'} {r.label}
          </Typography>
        ))}
      </Box>
    </Box>
  )
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('As senhas não conferem')
      return
    }

    const requisitos = getSenhaRequisitos(password)
    const pendentes = requisitos.filter((r) => !r.ok).map((r) => r.label)
    if (pendentes.length > 0) {
      setError('Senha não atende aos requisitos: ' + pendentes.join('; '))
      return
    }

    setIsLoading(true)

    try {
      await register(email, nome, dataNascimento || null, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', backgroundColor: '#f9fafb' }}>
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography fontSize={32} fontWeight={700} color="#111827" mb={1}>
            Controle Financeiro
          </Typography>
          <Typography fontSize={14} color="#6b7280">
            Transparência financeira para casais
          </Typography>
        </Box>

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            backgroundColor: '#ffffff',
            padding: 3,
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
          }}
        >
          <Typography fontSize={18} fontWeight={600} color="#111827">
            Criar Conta
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                fontSize: '14px',
                '& fieldset': { borderColor: '#e5e7eb' },
                '&:hover fieldset': { borderColor: '#d1d5db' },
                '&.Mui-focused fieldset': { borderColor: '#111827', borderWidth: '1.5px' },
              },
            }}
          />

          <TextField
            label="Nome Completo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            fullWidth
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                fontSize: '14px',
                '& fieldset': { borderColor: '#e5e7eb' },
                '&:hover fieldset': { borderColor: '#d1d5db' },
                '&.Mui-focused fieldset': { borderColor: '#111827', borderWidth: '1.5px' },
              },
            }}
          />

          <TextField
            label="Data de Nascimento"
            type="date"
            value={dataNascimento}
            onChange={(e) => setDataNascimento(e.target.value)}
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                fontSize: '14px',
                '& fieldset': { borderColor: '#e5e7eb' },
                '&:hover fieldset': { borderColor: '#d1d5db' },
                '&.Mui-focused fieldset': { borderColor: '#111827', borderWidth: '1.5px' },
              },
            }}
          />

          <TextField
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                fontSize: '14px',
                '& fieldset': { borderColor: '#e5e7eb' },
                '&:hover fieldset': { borderColor: '#d1d5db' },
                '&.Mui-focused fieldset': { borderColor: '#111827', borderWidth: '1.5px' },
              },
            }}
          />
          <PasswordStrengthIndicator senha={password} />

          <TextField
            label="Confirmar Senha"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            fullWidth
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                fontSize: '14px',
                '& fieldset': { borderColor: '#e5e7eb' },
                '&:hover fieldset': { borderColor: '#d1d5db' },
                '&.Mui-focused fieldset': { borderColor: '#111827', borderWidth: '1.5px' },
              },
            }}
          />

          <CustomButton type="submit" variant="primary" fullWidth disabled={isLoading}>
            {isLoading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Criar Conta'}
          </CustomButton>

          <Box sx={{ textAlign: 'center' }}>
            <Typography fontSize={13} color="#6b7280">
              Já tem conta?{' '}
              <Link to="/auth/login" style={{ color: '#1d4ed8', textDecoration: 'none', fontWeight: 600 }}>
                Fazer login
              </Link>
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
