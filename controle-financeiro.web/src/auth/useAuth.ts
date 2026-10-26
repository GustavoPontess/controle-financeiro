import { useContext } from "react"
import { AuthContext } from "./contexto"

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth precisa do AuthProvider")
  return ctx
}
