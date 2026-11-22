// "Proteja sua conta" (/proteja-sua-conta): convite pra ativar a verificação em duas etapas, mostrado logo
// depois do login quando o MFA está desligado (o servidor decide: MfaStatus.mostrarConvite). Só convida,
// nunca obriga: "Ativar agora" abre o passo a passo aqui mesmo; "Agora não" volta a perguntar em 30 dias; com
// "Não perguntar mais" marcado, nunca mais. A resposta fica no servidor (vale em todo dispositivo).
// O visual é o do rascunho aprovado (rascunhos/proteja.html do hub Pontes Dev, 2026-10-26): passos `proteja`,
// `ativar` e `codigos`. Ativar é o useAtivacaoMfa, o mesmo das Configurações.
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import MolduraAcesso, { CampoAcesso, Seta, VoltarA } from "../site/MolduraAcesso"
import css from "../site/Acesso.module.css"
import { BarraDev, useEstadoDev } from "../dev/BarraDev"
import { ESTADOS_ACESSO } from "../dev/estadosAcesso"
import mfaService from "../services/mfaService"
import { useAtivacaoMfa } from "./useAtivacaoMfa"

type Passo = "proteja" | "ativar" | "codigos"

/** Chave em grupos de 4, como o rascunho mostra (copiar leva a chave inteira, sem espaço). */
const emGrupos = (chave: string) => chave.match(/.{1,4}/g)?.join(" ") ?? chave

export default function ProtejaConta() {
  const navigate = useNavigate()
  const at = useAtivacaoMfa()
  const [passo, setPasso] = useState<Passo>("proteja")
  const [nuncaMais, setNuncaMais] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const irPraVisaoGeral = () => navigate("/dashboard", { replace: true })

  // DEV: a barra de estados põe a tela direto em cada passo, com chave e códigos de exemplo (sem API). Some no build.
  useEstadoDev(import.meta.env.DEV ? (e) => {
    if (e !== "proteja" && e !== "ativar" && e !== "codigos") return
    at.limpar(); if (e !== "proteja") void at.exemploDev?.(); setPasso(e)
  } : undefined)

  const agoraNao = async () => {
    setEnviando(true)
    // Se falhar, só não fica lembrado: o convite volta no próximo login. Nunca prende a pessoa aqui.
    try { await mfaService.responderConvite(nuncaMais) } catch { /* segue */ }
    irPraVisaoGeral()
  }
  const ativar = async () => { setPasso("ativar"); if (!(await at.iniciar())) setPasso("proteja") }
  const voltar = () => { at.limpar(); setPasso("proteja") }
  const confirmar = async () => { if (await at.confirmar()) setPasso("codigos") }

  return (
    <MolduraAcesso titulo="Proteja sua conta · Pontes" foto="1752652015365-52bf1f527e01-900.webp" frase="Sua senha," fraseSuave="e mais uma tranca."
      lead="Num app com o dinheiro da sua casa, a verificação em duas etapas é a proteção que mais faz diferença.">
      {passo === "proteja" && (
        <section data-passo="proteja" className="ativo">
          <h1>Proteja sua conta</h1>
          <p className="sub">Ative a verificação em duas etapas: além da senha, o Pontes pede um código do seu celular ao entrar.</p>
          <ul className="benef-a">
            <li><span className="ic-b"><svg><use href="#i-chave" /></svg></span>Mesmo que descubram a sua senha, ninguém entra sem o código.</li>
            <li><span className="ic-b"><svg><use href="#i-celular" /></svg></span>O código vem do app autenticador do seu celular. Leva 1 minuto pra configurar.</li>
            <li><span className="ic-b"><svg><use href="#i-escudo" /></svg></span>Neste aparelho dá pra pular o código por 30 dias.</li>
          </ul>
          <div className="form-a">
            {at.erro && <p className={`erro ${css.erroTopo}`} role="alert">{at.erro}</p>}
            <button className="btn btn--acc btn-cheio" type="button" disabled={at.ocupado} onClick={() => { void ativar() }}>Ativar agora</button>
            <button className="btn btn--linha btn-cheio" type="button" disabled={enviando} onClick={() => { void agoraNao() }}>{enviando ? "Um instante…" : "Agora não"}</button>
            <label className="marcar"><input type="checkbox" checked={nuncaMais} onChange={(e) => setNuncaMais(e.target.checked)} /> Não perguntar mais</label>
          </div>
          <p className="rodape-a">Dá pra ativar ou desativar quando quiser em Configurações.</p>
        </section>
      )}

      {passo === "ativar" && (
        <section data-passo="ativar" className="ativo">
          <VoltarA onClick={voltar}>Voltar</VoltarA>
          <h1>Ativar duas etapas</h1>
          <ol className="passos-mfa">
            <li>Abra o app autenticador (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
            <li>Escaneie o QR code ou digite a chave.</li>
            <li>Digite o código de 6 números que o app mostrar.</li>
          </ol>
          <div className="qr-linha">
            <div className="qr">{at.qr && <img className={css.qrImg} src={at.qr} alt="QR code pra adicionar o Pontes no app autenticador" />}</div>
            <div>
              <span className="rot">Ou digite a chave</span>
              <code className="chave-a" aria-label="Chave pra digitar no app">{emGrupos(at.chave)}</code>
              <button type="button" className="link-a" onClick={() => { void at.copiar(at.chave, "chave") }}>{at.copiado === "chave" ? "Copiado ✓" : "Copiar chave"}</button>
            </div>
          </div>
          <form className="form-a" noValidate onSubmit={(e) => { e.preventDefault(); void confirmar() }}>
            <CampoAcesso rotulo="Código do app" codigo erro={at.erroCodigo} name="codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={7}
              placeholder="000000" autoFocus value={at.codigo} onChange={(e) => at.setCodigo(e.target.value)} />
            <div className="botoes-a">
              <button className="btn btn--linha" type="button" disabled={at.ocupado} onClick={voltar}>Cancelar</button>
              <button className="btn btn--acc" type="submit" disabled={at.ocupado}>{at.ocupado ? "Confirmando…" : "Confirmar"}</button>
            </div>
          </form>
        </section>
      )}

      {passo === "codigos" && (
        <section data-passo="codigos" className="ativo">
          <h1>Tudo protegido</h1>
          <p className="alerta-ok" role="status">Verificação em duas etapas ativada.</p>
          <p className={`sub ${css.depois}`}>Guarde estes códigos de recuperação num lugar seguro. Cada um funciona uma vez, pra quando você estiver sem o celular. <b>Eles não aparecem de novo.</b></p>
          <ul className="codigos-rec" aria-label="Códigos de recuperação">{at.recuperacao.map((c) => <li key={c}>{c}</li>)}</ul>
          <div className="botoes-a">
            <button className="btn btn--linha" type="button" onClick={() => { void at.copiar(at.recuperacao.join("\n"), "codigos") }}>{at.copiado === "codigos" ? "Copiado ✓" : "Copiar códigos"}</button>
            <button className="btn btn--acc" type="button" onClick={() => { at.limpar(); irPraVisaoGeral() }}>Guardei, concluir <Seta /></button>
          </div>
        </section>
      )}
      {import.meta.env.DEV && <BarraDev grupos={ESTADOS_ACESSO} atual={passo} />}
    </MolduraAcesso>
  )
}
