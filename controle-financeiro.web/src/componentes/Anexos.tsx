// Anexos do lançamento (2026-11-07): print da nota, foto do cupom, PDF do comprovante. Miniaturas como as do selo Beta,
// um pouco maiores: a foto aparece (tocar abre grande, com ‹ › entre as fotos), o PDF mostra o ícone e baixa ao tocar
// (quando já está no servidor), o × tira e o último quadrado anexa. Confere tipo, tamanho e quantos antes de mandar
// (o servidor confere de novo).
import { useEffect, useRef, useState } from "react"
import { FileText, Plus, X } from "lucide-react"
import { ANEXO_ACEITA, ANEXOS_POR_LANCAMENTO, ehPdf, problemaDoArquivo } from "../dominio/anexo"
import VerAnexos from "./VerAnexos"
import styles from "./Anexos.module.css"

export type ItemAnexo = {
  chave: string
  nome: string
  /** "image/…" ou "application/pdf". */
  tipo: string
  /** Já está no servidor: a foto vem daqui e o PDF baixa daqui. */
  url?: string
  /** Ainda só no aparelho: a foto aparece pelo próprio arquivo. */
  arquivo?: File
}

export default function Anexos({ itens, onAdicionar, onRemover, enviando, erro: erroDeFora, desabilitado }: {
  itens: ItemAnexo[]
  /** Sem os dois: só mostra (página de ver a transação). */
  onAdicionar?: (arquivos: File[]) => void | Promise<void>
  onRemover?: (chave: string) => void | Promise<void>
  /** Mandando pro servidor agora. */
  enviando?: boolean
  /** Erro de quem usa (ex.: o servidor recusou). */
  erro?: string | null
  desabilitado?: boolean
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [vendo, setVendo] = useState<number | null>(null)
  const cheio = itens.length >= ANEXOS_POR_LANCAMENTO
  const editavel = !!onAdicionar

  // A foto que ainda não subiu aparece pelo próprio arquivo (endereço blob:, um por arquivo, solto quando ele sai da lista).
  const blobs = useRef(new Map<File, string>())
  const doArquivo = (f: File) => {
    if (typeof URL.createObjectURL !== "function") return undefined
    let u = blobs.current.get(f)
    if (!u) { u = URL.createObjectURL(f); blobs.current.set(f, u) }
    return u
  }
  useEffect(() => {
    const vivos = new Set(itens.map((a) => a.arquivo))
    for (const [f, u] of blobs.current) if (!vivos.has(f)) { URL.revokeObjectURL(u); blobs.current.delete(f) }
  }, [itens])
  useEffect(() => { const m = blobs.current; return () => { m.forEach((u) => URL.revokeObjectURL(u)); m.clear() } }, [])
  const imagemDe = (a: ItemAnexo) => (ehPdf(a.tipo) ? undefined : a.url ?? (a.arquivo ? doArquivo(a.arquivo) : undefined))
  const fotos = itens.filter((a) => imagemDe(a))

  const escolher = (lista: FileList | null) => {
    setErro(null)
    const arquivos = Array.from(lista ?? [])
    if (entrada.current) entrada.current.value = ""
    if (arquivos.length === 0) return
    const problema = arquivos.map(problemaDoArquivo).find(Boolean)
    if (problema) { setErro(problema); return }
    if (itens.length + arquivos.length > ANEXOS_POR_LANCAMENTO) {
      setErro(`Cada lançamento pode ter até ${ANEXOS_POR_LANCAMENTO} anexos.`)
      return
    }
    void onAdicionar?.(arquivos)
  }

  const mensagem = erro ?? erroDeFora
  if (!editavel && itens.length === 0) return null
  return (
    <span className={styles.raiz}>
      <ul className={styles.lista} aria-label="Anexos">
        {itens.map((a) => {
          const imagem = imagemDe(a)
          return (
            <li key={a.chave} className={styles.mini} title={a.nome}>
              {imagem
                ? <button type="button" className={styles.ver} aria-label={`Ver ${a.nome}`} onClick={() => setVendo(fotos.indexOf(a))}>
                    <img src={imagem} alt={a.nome} />
                  </button>
                : a.url
                  ? <a className={styles.pdf} href={a.url} download={a.nome} aria-label={`Baixar ${a.nome}`}>
                      <FileText size={28} strokeWidth={1.75} aria-hidden="true" />
                    </a>
                  : <span className={styles.pdf}><FileText size={28} strokeWidth={1.75} aria-hidden="true" /></span>}
              <span className={styles.rotulo}>{a.nome}</span>
              {onRemover && (
                <button type="button" className={styles.tirar} aria-label={`Tirar ${a.nome}`} disabled={desabilitado}
                  onClick={() => { setErro(null); void onRemover(a.chave) }}>
                  <X size={12} strokeWidth={2.5} aria-hidden="true" />
                </button>
              )}
            </li>
          )
        })}
        {editavel && !cheio && (
          <li>
            <button type="button" className={styles.anexar} disabled={desabilitado || enviando} onClick={() => entrada.current?.click()}>
              <Plus size={20} strokeWidth={2.25} aria-hidden="true" />
              <span>{enviando ? "Anexando…" : "Anexar"}</span>
            </button>
          </li>
        )}
      </ul>
      {editavel && (
        <input ref={entrada} type="file" multiple accept={ANEXO_ACEITA} hidden aria-label="Escolher arquivo"
          onChange={(e) => escolher(e.target.files)} />
      )}
      {mensagem && <span className={styles.erro} role="alert">{mensagem}</span>}
      {vendo !== null && fotos[vendo] && (
        <VerAnexos indice={vendo} aoMudar={setVendo} aoFechar={() => setVendo(null)}
          anexos={fotos.map((a) => ({ url: imagemDe(a)!, nome: a.nome, texto: null }))} />
      )}
    </span>
  )
}
