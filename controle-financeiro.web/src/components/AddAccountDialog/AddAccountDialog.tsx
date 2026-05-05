import { useState } from "react"
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Alert, CircularProgress, Box, Typography,
} from "@mui/material"
import { useAuth } from "../../hooks/useAuth"

type Props = {
  open: boolean
  onClose: () => void
}

export default function AddAccountDialog({ open, onClose }: Props) {
  const { addAccount } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await addAccount(email, password)
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar conta")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    setEmail("")
    setPassword("")
    setError(null)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      PaperProps={{ sx: { borderRadius: "16px", minWidth: "380px" } }}
    >
      <DialogTitle sx={{ fontSize: 16, fontWeight: 700, pb: 0.5 }}>
        Adicionar conta
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 1 }}>
          <Typography fontSize={13} color="#6b7280" mb={2.5}>
            Entre com as credenciais da conta que deseja conectar. Você poderá alternar entre contas sem precisar fazer login novamente.
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2, fontSize: 13, borderRadius: "8px" }}>
              {error}
            </Alert>
          )}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              size="small"
              disabled={loading}
              autoFocus
            />
            <TextField
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              size="small"
              disabled={loading}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={handleClose}
            disabled={loading}
            sx={{ fontSize: 13, color: "#6b7280", textTransform: "none" }}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !email || !password}
            sx={{
              fontSize: 13,
              borderRadius: "8px",
              textTransform: "none",
              bgcolor: "#111827",
              "&:hover": { bgcolor: "#374151" },
              minWidth: 100,
            }}
          >
            {loading ? <CircularProgress size={16} sx={{ color: "white" }} /> : "Adicionar"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
