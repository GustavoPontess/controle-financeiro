// Os campos de UM lançamento, do mesmo jeito em toda tela que preenche um (Gustavo, 2026-11-22: "onde é exibido o
// detalhamento da transação tinha que ser da mesma forma em Nova transação; se não é, fica destoante"). O formulário de
// Nova transação / editar e a fila do Importar extrato montam com ESTAS peças, na mesma ordem: valor, descrição, data e
// hora, forma de pagamento e conta, categoria e subcategoria. Campo novo de lançamento nasce aqui, nunca numa tela só.
// O que a tela não deixa mudar (no Importar, o que veio do banco: valor e data) passa `fixo`: fica no mesmo lugar,
// escrito como texto (sem a caixa de campo travado).
import type { ReactNode } from "react"
import Botao from "../componentes/Botao"
import Campo, { ValorTexto } from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import EntradaValor from "../componentes/EntradaValor"
import { LinhaCampos } from "../componentes/Formulario"
import Selecao from "../componentes/Selecao"
import SeletorData, { formatarData } from "../componentes/SeletorData"
import { MAX_DESCRICAO } from "../dominio/transacao"
import { dataLocalISO, mascararHora, somaDias } from "../utils/dateTime"
import styles from "./CamposLancamento.module.css"

type Opcao = { valor: string; rotulo: string }
type Tom = "positivo" | "negativo" | "neutro"

/** O valor grande. `fixo`: só mostra (o texto já mascarado, "1.234,56"). */
export function CampoValor({ valor, tom, erro, autoFocus, fixo, onChange }: {
  valor: string; tom: Tom; erro?: string | null; autoFocus?: boolean; fixo?: boolean; onChange?: (valor: string) => void
}) {
  return (
    <Campo rotulo="Valor" erro={erro} estatico={fixo}>
      <EntradaValor valor={valor} tom={tom} autoFocus={autoFocus} fixo={fixo} onChange={onChange ?? (() => { /* fixo */ })} />
    </Campo>
  )
}

export function CampoDescricao({ valor, erro, placeholder, onChange }: {
  valor: string; erro?: string | null; placeholder?: string; onChange: (valor: string) => void
}) {
  return (
    <Campo rotulo="Descrição" erro={erro}>
      <Entrada value={valor} maxLength={MAX_DESCRICAO} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Campo>
  )
}

/** Data (Hoje / Ontem / calendário) e hora, lado a lado quando cabe. `dataFixa`: a data só aparece (veio do banco). */
export function CamposDataHora({ data, hora, erroData, erroHora, rotuloData = "Data", dataMax, comHora = true, dataFixa, aoData, aoHora }: {
  data: string; hora: string; erroData?: string | null; erroHora?: string | null; rotuloData?: string
  /** Último dia que pode (AAAA-MM-DD); sem ele, qualquer data. */
  dataMax?: string
  comHora?: boolean; dataFixa?: boolean
  aoData?: (data: string) => void; aoHora: (hora: string) => void
}) {
  const hoje = dataLocalISO()
  const ontem = somaDias(hoje, -1)
  return (
    <div className={styles.dataHora} data-fixa={dataFixa || undefined}>
      {dataFixa ? (
        <Campo rotulo={rotuloData} estatico><ValorTexto>{formatarData(data)}</ValorTexto></Campo>
      ) : (
        <Campo rotulo={rotuloData} erro={erroData}>
          <div className={styles.dataRapida}>
            <Botao tamanho="lg" ativo={data === hoje} onClick={() => aoData?.(hoje)}>Hoje</Botao>
            <Botao tamanho="lg" ativo={data === ontem} onClick={() => aoData?.(ontem)}>Ontem</Botao>
            <SeletorData valor={data} max={dataMax} onChange={(x) => aoData?.(x)} />
          </div>
        </Campo>
      )}
      {comHora && <CampoHora valor={hora} erro={erroHora} onChange={aoHora} />}
    </div>
  )
}

/** "Pago com" / "Recebido por". */
export function CampoMeio({ rotulo, valor, opcoes, placeholder, erro, onChange }: {
  rotulo: ReactNode; valor: string; opcoes: Opcao[]; placeholder?: string; erro?: string | null; onChange: (valor: string) => void
}) {
  return (
    <Campo rotulo={rotulo} erro={erro}>
      <Selecao valor={valor} placeholder={placeholder} onChange={onChange} opcoes={opcoes} />
    </Campo>
  )
}

/** Um dado do lançamento que a tela não deixa mudar, no lugar onde o campo estaria (ex.: a conta do extrato). */
export function CampoFixo({ rotulo, children }: { rotulo: ReactNode; children: ReactNode }) {
  return <Campo rotulo={rotulo} estatico><ValorTexto>{children}</ValorTexto></Campo>
}

export function CampoCategoria({ valor, opcoes, rotulo = "Categoria", erro, onChange }: {
  valor: string; opcoes: Opcao[]; rotulo?: ReactNode; erro?: string | null; onChange: (id: string) => void
}) {
  return (
    <Campo rotulo={rotulo} erro={erro}>
      <Selecao valor={valor} placeholder="Escolha a categoria" onChange={onChange} opcoes={opcoes} />
    </Campo>
  )
}

export function CampoSubcategoria({ valor, opcoes, onChange }: { valor: string; opcoes: Opcao[]; onChange: (id: string) => void }) {
  return (
    <Campo rotulo="Subcategoria">
      <Selecao valor={valor} desabilitado={opcoes.length === 0}
        placeholder={opcoes.length === 0 ? "Nenhuma" : "Opcional"} onChange={onChange}
        opcoes={opcoes.length === 0 ? [] : [{ valor: "", rotulo: "Sem subcategoria" }, ...opcoes]} />
    </Campo>
  )
}

export function CampoHora({ valor, erro, onChange }: { valor: string; erro?: string | null; onChange: (hora: string) => void }) {
  return (
    <Campo rotulo="Hora (opcional)" erro={erro}>
      <Entrada inputMode="numeric" placeholder="HH:MM" maxLength={5} value={valor} onChange={(e) => onChange(mascararHora(e.target.value))} />
    </Campo>
  )
}

/** Categoria e subcategoria, lado a lado. */
export function CamposCategoria({ categoriaId, subcategoriaId, categorias, subcategorias, rotuloCategoria = "Categoria", erro, aoCategoria, aoSubcategoria }: {
  categoriaId: string; subcategoriaId: string
  categorias: Opcao[]; subcategorias: Opcao[]
  rotuloCategoria?: ReactNode; erro?: string | null
  aoCategoria: (id: string) => void; aoSubcategoria: (id: string) => void
}) {
  return (
    <LinhaCampos>
      <CampoCategoria valor={categoriaId} opcoes={categorias} rotulo={rotuloCategoria} erro={erro} onChange={aoCategoria} />
      <CampoSubcategoria valor={subcategoriaId} opcoes={subcategorias} onChange={aoSubcategoria} />
    </LinhaCampos>
  )
}
