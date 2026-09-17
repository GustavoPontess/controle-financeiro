import { useCallback, useEffect, useRef, useState } from "react"
import QRCode from "qrcode"
import { ShieldCheck, ShieldOff, Copy, Check, Download } from "lucide-react"
import { PontesButton, PontesField, PontesInput, PontesAlert, PontesBadge } from "@/components/pontes"
import mfaService, { type MfaStatus } from "@/services/mfaService"
import styles from "./MfaSection.module.css"

type Fase = "carregando" | "inativo" | "setup" | "backup" | "ativo" | "desativar"

// Monta o conteúdo do arquivo .txt de recuperação. \r\n pra abrir bem no Bloco de Notas (Windows).
const montarArquivoBackup = (codes: string[]) =>
  [
    "Pontes — Códigos de recuperação (MFA)",
    `Gerados em: ${new Date().toLocaleString("pt-BR")}`,
    "",
    "Guarde este arquivo num lugar seguro. Cada código funciona uma única vez,",
    "para quando você não tiver o app autenticador. Eles não aparecem de novo.",
    "",
    ...codes,
    "",
  ].join("\r\n")

export default function MfaSection() {
  const [fase, setFase] = useState<Fase>("carregando")
  const [status, setStatus] = useState<MfaStatus | null>(null)
  const [erro, setErro] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)

  // setup
  const [qrDataUrl, setQrDataUrl] = useState("")
  const [secret, setSecret] = useState("")
  const [codigo, setCodigo] = useState("")

  // backup codes (mostrados uma vez)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [copiado, setCopiado] = useState(false)
  const [baixado, setBaixado] = useState(false)
  const autoBaixadoRef = useRef(false)

  // desativar
  const [senhaAtual, setSenhaAtual] = useState("")
  const [codigoDesativar, setCodigoDesativar] = useState("")

  const carregarStatus = async () => {
    try {
      const s = await mfaService.status()
      setStatus(s)
      setFase(s.ativo ? "ativo" : "inativo")
    } catch {
      setErro("Não foi possível carregar o status do MFA.")
      setFase("inativo")
    }
  }

  useEffect(() => { void carregarStatus() }, [])

  const msgErro = (e: unknown) =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message

  const iniciar = async () => {
    setErro(undefined); setLoading(true)
    try {
      const { secretBase32, qrCodeUri } = await mfaService.iniciarAtivacao()
      setSecret(secretBase32)
      setQrDataUrl(await QRCode.toDataURL(qrCodeUri, { width: 200, margin: 1 }))
      setCodigo("")
      setFase("setup")
    } catch (e) {
      setErro(msgErro(e) ?? "Não foi possível iniciar a ativação.")
    } finally { setLoading(false) }
  }

  const confirmar = async () => {
    setErro(undefined)
    if (!codigo.trim()) { setErro("Informe o código do app."); return }
    setLoading(true)
    try {
      const codes = await mfaService.confirmarAtivacao(codigo.trim())
      setBackupCodes(codes)
      setFase("backup")
    } catch (e) {
      setErro(msgErro(e) ?? "Código inválido.")
    } finally { setLoading(false) }
  }

  const desativar = async () => {
    setErro(undefined)
    if (!senhaAtual || !codigoDesativar.trim()) { setErro("Preencha senha e código."); return }
    setLoading(true)
    try {
      await mfaService.desativar(senhaAtual, codigoDesativar.trim())
      setSenhaAtual(""); setCodigoDesativar("")
      await carregarStatus()
    } catch (e) {
      setErro(msgErro(e) ?? "Não foi possível desativar.")
    } finally { setLoading(false) }
  }

  const copiarBackup = async () => {
    await navigator.clipboard.writeText(backupCodes.join("\n"))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const baixarBackup = useCallback((codes: string[]) => {
    const blob = new Blob([montarArquivoBackup(codes)], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "pontes-codigos-recuperacao.txt"
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setBaixado(true)
    setTimeout(() => setBaixado(false), 2000)
  }, [])

  // Baixa automaticamente ao entrar na fase de backup (garante que a pessoa tem uma cópia
  // mesmo se ignorar os botões). Best-effort — o botão manual continua disponível. Ref evita
  // download duplicado em re-render / StrictMode.
  useEffect(() => {
    if (fase === "backup" && backupCodes.length > 0 && !autoBaixadoRef.current) {
      autoBaixadoRef.current = true
      baixarBackup(backupCodes)
    }
    if (fase !== "backup") autoBaixadoRef.current = false
  }, [fase, backupCodes, baixarBackup])

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>
          <ShieldCheck size={18} strokeWidth={2.5} className={styles.sectionIcon} aria-hidden="true" />
          Verificação em duas etapas (MFA)
          {status?.ativo && <PontesBadge tone="success">Ativo</PontesBadge>}
        </h2>
        <p className={styles.sectionHint}>
          Opcional. Adiciona um código do seu celular ao entrar — mesmo que descubram sua senha,
          não entram sem o código.
        </p>
      </div>

      {erro && <PontesAlert tone="error">{erro}</PontesAlert>}

      {fase === "inativo" && (
        <div className={styles.card}>
          <ShieldOff size={20} className={styles.iconMuted} />
          <div className={styles.cardBody}>
            <p className={styles.cardText}>MFA está desligado. Recomendamos ativar pra proteger sua conta.</p>
            <div className={styles.actions}>
              <PontesButton variant="primary" size="md" onClick={iniciar} loading={loading}>
                Ativar MFA
              </PontesButton>
            </div>
          </div>
        </div>
      )}

      {fase === "setup" && (
        <div className={styles.card}>
          <div className={styles.setup}>
            <ol className={styles.steps}>
              <li>Abra seu app autenticador (Google Authenticator, Authy, 1Password…).</li>
              <li>Escaneie o QR code abaixo, ou digite a chave manualmente.</li>
              <li>Digite o código de 6 dígitos que o app mostrar.</li>
            </ol>
            {qrDataUrl && <img src={qrDataUrl} alt="QR code do MFA" className={styles.qr} />}
            <div className={styles.secretBox}>
              <span className={styles.secretLabel}>Chave manual</span>
              <code className={styles.secretCode}>{secret}</code>
            </div>
            <PontesField label="Código do app" htmlFor="mfa-setup-codigo" required>
              <PontesInput
                id="mfa-setup-codigo"
                inputMode="numeric"
                placeholder="000000"
                value={codigo}
                onChange={(e) => { setCodigo(e.target.value); setErro(undefined) }}
              />
            </PontesField>
            <div className={styles.actions}>
              <PontesButton variant="primary" size="md" onClick={confirmar} loading={loading}>Confirmar</PontesButton>
              <PontesButton variant="ghost" size="md" onClick={() => { setFase("inativo"); setErro(undefined) }}>Cancelar</PontesButton>
            </div>
          </div>
        </div>
      )}

      {fase === "backup" && (
        <div className={styles.card}>
          <div className={styles.cardBody}>
            <div className={styles.backupHead}>
              <ShieldCheck size={20} className={styles.iconOk} />
              <p className={styles.cardText}>
                <strong>MFA ativado!</strong> Guarde estes códigos de recuperação num lugar seguro —
                cada um funciona uma vez, pra quando você não tiver o celular. Eles não vão aparecer de novo.
              </p>
            </div>
            <div className={styles.backupGrid}>
              {backupCodes.map((c) => <code key={c} className={styles.backupCode}>{c}</code>)}
            </div>
            <p className={styles.backupNote}>
              <Download size={14} strokeWidth={2.5} aria-hidden="true" />
              Já salvamos um arquivo <code>pontes-codigos-recuperacao.txt</code> no seu dispositivo.
              Se não achou, baixe de novo abaixo.
            </p>
            <div className={styles.actions}>
              <PontesButton variant="outline" size="md" onClick={() => baixarBackup(backupCodes)} iconStart={baixado ? <Check size={16} /> : <Download size={16} />}>
                {baixado ? "Baixado" : "Baixar .txt"}
              </PontesButton>
              <PontesButton variant="outline" size="md" onClick={copiarBackup} iconStart={copiado ? <Check size={16} /> : <Copy size={16} />}>
                {copiado ? "Copiado" : "Copiar códigos"}
              </PontesButton>
              <PontesButton variant="primary" size="md" onClick={carregarStatus}>Concluir</PontesButton>
            </div>
          </div>
        </div>
      )}

      {fase === "ativo" && (
        <div className={styles.card}>
          <ShieldCheck size={20} className={styles.iconOk} />
          <div className={styles.cardBody}>
            <p className={styles.cardText}>
              MFA está ativo{status?.backupCodesRestantes != null && <> · {status.backupCodesRestantes} códigos de recuperação restantes</>}.
            </p>
            <div className={styles.actions}>
              <PontesButton variant="danger" size="md" onClick={() => { setFase("desativar"); setErro(undefined) }}>
                Desativar MFA
              </PontesButton>
            </div>
          </div>
        </div>
      )}

      {fase === "desativar" && (
        <div className={styles.card}>
          <div className={styles.cardBody}>
            <p className={styles.cardText}>Pra desativar, confirme sua senha e um código do app (ou de recuperação).</p>
            <PontesField label="Senha atual" htmlFor="mfa-off-senha" required>
              <PontesInput id="mfa-off-senha" type="password" value={senhaAtual}
                onChange={(e) => { setSenhaAtual(e.target.value); setErro(undefined) }} autoComplete="current-password" />
            </PontesField>
            <PontesField label="Código" htmlFor="mfa-off-codigo" required>
              <PontesInput id="mfa-off-codigo" inputMode="numeric" placeholder="000000" value={codigoDesativar}
                onChange={(e) => { setCodigoDesativar(e.target.value); setErro(undefined) }} />
            </PontesField>
            <div className={styles.actions}>
              <PontesButton variant="danger" size="md" onClick={desativar} loading={loading}>Desativar</PontesButton>
              <PontesButton variant="ghost" size="md" onClick={() => { setFase("ativo"); setErro(undefined) }}>Cancelar</PontesButton>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
