import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Download, TriangleAlert } from "lucide-react"
import { PontesButton, PontesField, PontesInput, PontesAlert } from "@/components/pontes"
import { useAuth } from "../../hooks/useAuth"
import contaService, { type MetodoExclusao } from "@/services/minhaContaService"
import styles from "./ExcluirContaSection.module.css"

type Fase = "inicio" | "senha" | "codigo"

const msgErro = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message

export default function ExcluirContaSection() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  const [fase, setFase] = useState<Fase>("inicio")
  const [senha, setSenha] = useState("")
  const [metodo, setMetodo] = useState<MetodoExclusao>("email")
  const [codigo, setCodigo] = useState("")
  const [erro, setErro] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [baixando, setBaixando] = useState(false)

  const baixarDados = async () => {
    setErro(undefined); setBaixando(true)
    try {
      const dados = await contaService.exportarMeusDados()
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "meus-dados-pontes.json"
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErro(msgErro(e) ?? "Não foi possível baixar seus dados.")
    } finally { setBaixando(false) }
  }

  const enviarCodigo = async () => {
    setErro(undefined)
    if (!senha) { setErro("Informe sua senha atual."); return }
    setLoading(true)
    try {
      const m = await contaService.enviarCodigoExclusao(senha)
      setMetodo(m)
      setCodigo("")
      setFase("codigo")
    } catch (e) {
      setErro(msgErro(e) ?? "Não foi possível continuar.")
    } finally { setLoading(false) }
  }

  const excluir = async () => {
    setErro(undefined)
    if (!codigo.trim()) { setErro("Informe o código de verificação."); return }
    setLoading(true)
    try {
      await contaService.excluirConta(senha, codigo.trim())
      logout() // limpa o estado local; o backend já encerrou a sessão
      navigate("/auth/login", { replace: true, state: { contaExcluida: true } })
    } catch (e) {
      setErro(msgErro(e) ?? "Não foi possível excluir a conta.")
    } finally { setLoading(false) }
  }

  const cancelar = () => {
    setFase("inicio"); setSenha(""); setCodigo(""); setErro(undefined)
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Excluir minha conta</h2>
        <p className={styles.sectionHint}>
          Encerra sua conta e agenda a remoção dos seus dados. Você tem <strong>30 dias</strong> para
          reativar entrando de novo — depois disso a exclusão é permanente.
        </p>
      </div>

      {erro && <PontesAlert tone="error">{erro}</PontesAlert>}

      <div className={styles.danger}>
        <TriangleAlert size={20} className={styles.icon} />
        <div className={styles.body}>
          {fase === "inicio" && (
            <>
              <p className={styles.text}>
                Antes de excluir, você pode <strong>baixar uma cópia dos seus dados</strong> (perfil,
                contas, cartões, transações, metas e orçamentos).
              </p>
              <div className={styles.actions}>
                <PontesButton variant="outline" size="md" onClick={baixarDados} loading={baixando}
                  iconStart={<Download size={16} strokeWidth={2.5} />}>
                  Baixar meus dados
                </PontesButton>
                <PontesButton variant="danger" size="md" onClick={() => { setErro(undefined); setFase("senha") }}>
                  Excluir minha conta
                </PontesButton>
              </div>
            </>
          )}

          {fase === "senha" && (
            <>
              <p className={styles.text}>Confirme sua <strong>senha atual</strong> para continuar.</p>
              <PontesField label="Senha atual" htmlFor="excluir-senha" required>
                <PontesInput id="excluir-senha" type="password" autoComplete="current-password"
                  value={senha} onChange={(e) => { setSenha(e.target.value); setErro(undefined) }} />
              </PontesField>
              <div className={styles.actions}>
                <PontesButton variant="danger" size="md" onClick={enviarCodigo} loading={loading}>Continuar</PontesButton>
                <PontesButton variant="ghost" size="md" onClick={cancelar}>Cancelar</PontesButton>
              </div>
            </>
          )}

          {fase === "codigo" && (
            <>
              <p className={styles.text}>
                {metodo === "totp"
                  ? "Digite o código do seu app autenticador (ou um código de recuperação) para confirmar."
                  : "Enviamos um código para o seu e-mail. Digite-o para confirmar a exclusão."}
              </p>
              <PontesField label="Código de verificação" htmlFor="excluir-codigo" required>
                <PontesInput id="excluir-codigo" inputMode="numeric" placeholder="000000"
                  value={codigo} onChange={(e) => { setCodigo(e.target.value); setErro(undefined) }} autoFocus />
              </PontesField>
              <div className={styles.actions}>
                <PontesButton variant="danger" size="md" onClick={excluir} loading={loading}>Excluir de vez</PontesButton>
                <PontesButton variant="ghost" size="md" onClick={cancelar}>Cancelar</PontesButton>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
