import { useState } from "react"
import {
  PontesButton, PontesModal, PontesField, PontesInput, PontesAlert,
} from "@/components/pontes"
import { useAuth } from "../../hooks/useAuth"

type Props = {
  open: boolean
  onClose: () => void
}

/**
 * Modal de adicionar OUTRA CONTA DO USUÁRIO (multi-account switching).
 * NÃO é conta bancária — é login alternativo (trocar entre contas sem fazer
 * login de novo). Roda no Sidebar.
 */
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
    <PontesModal
      open={open}
      title="Adicionar conta"
      onClose={handleClose}
      footer={<>
        <PontesButton variant="outline" onClick={handleClose} disabled={loading}>Cancelar</PontesButton>
        <PontesButton onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
          loading={loading} disabled={loading || !email || !password}>
          Adicionar
        </PontesButton>
      </>}
    >
      <form noValidate onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ margin: 0, fontSize: "var(--pontes-fs-corpo)", color: "var(--pontes-text-muted)" }}>
          Entre com as credenciais da conta que deseja conectar. Você poderá alternar entre contas sem precisar fazer login novamente.
        </p>
        {error && <PontesAlert tone="error">{error}</PontesAlert>}
        <PontesField label="E-mail" required>
          <PontesInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            autoFocus
          />
        </PontesField>
        <PontesField label="Senha" required>
          <PontesInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </PontesField>
      </form>
    </PontesModal>
  )
}
