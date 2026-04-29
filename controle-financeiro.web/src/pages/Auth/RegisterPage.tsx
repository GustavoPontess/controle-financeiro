import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Box, Container, TextField, Typography, Alert, CircularProgress } from '@mui/material'
import CustomButton from '../../components/CustomButton'
import { useAuth } from '../../hooks/useAuth'

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

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres')
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
            helperText="Mínimo 6 caracteres"
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
