import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Box, Container, TextField, Typography, Alert, CircularProgress } from '@mui/material'
import CustomButton from '../../components/CustomButton'
import { useAuth } from '../../hooks/useAuth'
import { tokens } from '../../theme/tokens'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login')
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
            Entrar
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

          <CustomButton type="submit" variant="primary" fullWidth disabled={isLoading}>
            {isLoading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Entrar'}
          </CustomButton>

          <Box sx={{ textAlign: 'center' }}>
            <Typography fontSize={tokens.typography.fontSize.sm} color="text.secondary">
              Não tem conta?{' '}
              <Link to="/auth/register" style={{ color: tokens.color.brand.primary, textDecoration: 'none', fontWeight: tokens.typography.fontWeight.bold }}>
                Criar conta
              </Link>
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
