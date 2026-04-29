import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Box, Container, TextField, Typography, Alert, CircularProgress } from '@mui/material'
import CustomButton from '../../components/CustomButton'
import { useAuth } from '../../hooks/useAuth'

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

          <CustomButton type="submit" variant="primary" fullWidth disabled={isLoading}>
            {isLoading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Entrar'}
          </CustomButton>

          <Box sx={{ textAlign: 'center' }}>
            <Typography fontSize={13} color="#6b7280">
              Não tem conta?{' '}
              <Link to="/auth/register" style={{ color: '#1d4ed8', textDecoration: 'none', fontWeight: 600 }}>
                Criar conta
              </Link>
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
