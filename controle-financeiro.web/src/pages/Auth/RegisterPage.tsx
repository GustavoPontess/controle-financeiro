import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Box, Container, TextField, Typography, Alert, CircularProgress, LinearProgress } from '@mui/material'
import CustomButton from '../../components/CustomButton'
import { useAuth } from '../../hooks/useAuth'
import { getSenhaRequisitos, getSenhaForca } from '../../utils/passwordPolicy'
import { tokens } from '../../theme/tokens'

function PasswordStrengthIndicator({ senha }: { senha: string }) {
  if (!senha) return null
  const requisitos = getSenhaRequisitos(senha)
  const forca = getSenhaForca(requisitos)
  const progresso = (forca / requisitos.length) * 100
  const cor = forca <= 2 ? tokens.color.status.error.main : forca <= 3 ? tokens.color.status.warning.main : forca === 4 ? tokens.color.status.info.main : tokens.color.status.success.main

  return (
    <Box sx={{ mt: -1 }}>
      <LinearProgress
        variant="determinate"
        value={progresso}
        sx={{
          height: 4,
          borderRadius: 2,
          backgroundColor: "divider",
          '& .MuiLinearProgress-bar': { backgroundColor: cor, borderRadius: 2 },
        }}
      />
      <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {requisitos.map((r) => (
          <Typography key={r.label} fontSize={tokens.typography.fontSize['2xs']} color={r.ok ? tokens.color.status.success.main : "text.disabled"} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
      navigate('/onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', backgroundColor: "background.default" }}>
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography fontSize={32} fontWeight={tokens.typography.fontWeight.bold} color="text.primary" mb={1}>
            Controle Financeiro
          </Typography>
          <Typography fontSize={tokens.typography.fontSize.sm} color="text.secondary">
            Transparência financeira para casais
          </Typography>
        </Box>

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            backgroundColor: "background.paper",
            padding: 3,
            borderRadius: tokens.radius.lg,
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
          }}
        >
          <Typography fontSize={tokens.typography.fontSize.lg} fontWeight={tokens.typography.fontWeight.bold} color="text.primary">
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
                backgroundColor: tokens.color.background.secondary,
                borderRadius: tokens.radius.md,
                fontSize: tokens.typography.fontSize.sm,
                '& fieldset': { borderColor: tokens.color.border.default },
                '&:hover fieldset': { borderColor: tokens.color.border.strong },
                '&.Mui-focused fieldset': { borderColor: tokens.color.text.primary, borderWidth: '1.5px' },
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
                backgroundColor: tokens.color.background.secondary,
                borderRadius: tokens.radius.md,
                fontSize: tokens.typography.fontSize.sm,
                '& fieldset': { borderColor: tokens.color.border.default },
                '&:hover fieldset': { borderColor: tokens.color.border.strong },
                '&.Mui-focused fieldset': { borderColor: tokens.color.text.primary, borderWidth: '1.5px' },
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
                backgroundColor: tokens.color.background.secondary,
                borderRadius: tokens.radius.md,
                fontSize: tokens.typography.fontSize.sm,
                '& fieldset': { borderColor: tokens.color.border.default },
                '&:hover fieldset': { borderColor: tokens.color.border.strong },
                '&.Mui-focused fieldset': { borderColor: tokens.color.text.primary, borderWidth: '1.5px' },
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
                backgroundColor: tokens.color.background.secondary,
                borderRadius: tokens.radius.md,
                fontSize: tokens.typography.fontSize.sm,
                '& fieldset': { borderColor: tokens.color.border.default },
                '&:hover fieldset': { borderColor: tokens.color.border.strong },
                '&.Mui-focused fieldset': { borderColor: tokens.color.text.primary, borderWidth: '1.5px' },
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
                backgroundColor: tokens.color.background.secondary,
                borderRadius: tokens.radius.md,
                fontSize: tokens.typography.fontSize.sm,
                '& fieldset': { borderColor: tokens.color.border.default },
                '&:hover fieldset': { borderColor: tokens.color.border.strong },
                '&.Mui-focused fieldset': { borderColor: tokens.color.text.primary, borderWidth: '1.5px' },
              },
            }}
          />

          <CustomButton type="submit" variant="primary" fullWidth disabled={isLoading}>
            {isLoading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Criar Conta'}
          </CustomButton>

          <Box sx={{ textAlign: 'center' }}>
            <Typography fontSize={tokens.typography.fontSize.sm} color="text.secondary">
              Já tem conta?{' '}
              <Link to="/auth/login" style={{ color: tokens.color.brand.primary, textDecoration: 'none', fontWeight: tokens.typography.fontWeight.bold }}>
                Fazer login
              </Link>
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
