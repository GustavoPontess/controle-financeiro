// Ativar a verificação em duas etapas: QR + chave, código do app pra confirmar e os códigos de recuperação
// (mostrados UMA vez: copiar/baixar). Lógica única, usada pela seção das Configurações (SegurancaMfa) e pelo
// convite pós-login (ProtejaConta), que só mudam o visual.
import { useState } from "react"
import QRCode from "qrcode"
import mfaService from "../services/mfaService"
import { mensagemDeErro } from "../api/cliente"

const CODIGO = /^\d{6}$/

/** Arquivo .txt dos códigos de recuperação (\r\n abre bem no Bloco de Notas). */
const arquivoRecuperacao = (codigos: string[]) => [
  "Pontes: códigos de recuperação da verificação em duas etapas",
  `Gerados em: ${new Date().toLocaleString("pt-BR")}`,
  "",
  "Cada código funciona uma vez, pra quando você estiver sem o app autenticador.",
  "Guarde num lugar seguro. Eles não aparecem de novo.",
  "",
  ...codigos,
  "",
].join("\r\n")

export function useAtivacaoMfa() {
  const [qr, setQr] = useState("")
  const [chave, setChave] = useState("")
  const [codigo, setCodigoBruto] = useState("")
  const [erroCodigo, setErroCodigo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [recuperacao, setRecuperacao] = useState<string[]>([])
  const [copiado, setCopiado] = useState<"chave" | "codigos" | null>(null)

  /** Pede o segredo novo ao servidor e monta o QR. true = pronto pra digitar o código. */
  const iniciar = async (): Promise<boolean> => {
    setErro(null); setOcupado(true)
    try {
      const { secretBase32, qrCodeUri } = await mfaService.iniciarAtivacao()
      setChave(secretBase32)
      setQr(await QRCode.toDataURL(qrCodeUri, { width: 192, margin: 1 }))
      setCodigoBruto(""); setErroCodigo(null)
      return true
    } catch (e) { setErro(mensagemDeErro(e)); return false }
    finally { setOcupado(false) }
  }

  /** Confere o código do app. true = ativou (os códigos de recuperação estão em `recuperacao`). */
  const confirmar = async (): Promise<boolean> => {
    setErro(null)
    const c = codigo.replace(/\s/g, "")
    if (!c) { setErroCodigo("Digite o código do app."); return false }
    if (!CODIGO.test(c)) { setErroCodigo("São 6 números."); return false }
    setOcupado(true)
    try { setRecuperacao(await mfaService.confirmarAtivacao(c)); return true }
    catch (e) { setErroCodigo(mensagemDeErro(e)); return false }
    finally { setOcupado(false) }
  }

  const setCodigo = (v: string) => { setCodigoBruto(v.replace(/[^\d\s]/g, "")); setErroCodigo(null) }

  const copiar = async (texto: string, qual: "chave" | "codigos") => {
    try { await navigator.clipboard.writeText(texto); setCopiado(qual); setTimeout(() => setCopiado(null), 2000) } catch { /* sem área de transferência */ }
  }

  const baixar = () => {
    const url = URL.createObjectURL(new Blob([arquivoRecuperacao(recuperacao)], { type: "text/plain;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url; a.download = "pontes-codigos-recuperacao.txt"
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }

  /** Sai do passo a passo (cancelou ou concluiu): esquece código, erros e os códigos de recuperação. */
  const limpar = () => { setRecuperacao([]); setCodigoBruto(""); setErroCodigo(null); setErro(null) }

  /** DEV: QR, chave e códigos de exemplo (os do rascunho), pra barra de estados mostrar os passos sem o servidor. Some no build. */
  const exemploDev = import.meta.env.DEV ? async () => {
    const { CODIGOS_EXEMPLO } = await import("../dev/estadosAcesso")
    setChave("JBSWY3DPEHPK3PXP")
    setQr(await QRCode.toDataURL("otpauth://totp/Pontes:exemplo?secret=JBSWY3DPEHPK3PXP&issuer=Pontes", { width: 192, margin: 1 }))
    setRecuperacao(CODIGOS_EXEMPLO)
  } : undefined

  return { exemploDev, qr, chave, codigo, setCodigo, erroCodigo, erro, ocupado, recuperacao, copiado, iniciar, confirmar, copiar, baixar, limpar }
}
