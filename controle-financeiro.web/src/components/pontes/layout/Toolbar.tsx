/**
 * Toolbar — faixa PADRÃO de filtros das telas internas, sempre na mesma ordem:
 *  1. busca (PontesInput com ícone Search + botão de limpar) — cresce pra ocupar a linha;
 *  2. filtros da tela (`children`), ex.: PontesSegmented "Ativas | Encerradas".
 *
 * A busca é CONTROLADA: `value` é o texto digitado e `onChange` recebe cada tecla. Se a lista é
 * paginada no servidor, a TELA faz o debounce antes de mandar pra API (regra do projeto: busca e
 * filtro sempre no servidor). Todos os controles na mesma altura (42px) — igual Transações.
 */

import { useRef, type ReactNode } from "react"
import { Search, X } from "lucide-react"
import { PontesInput } from "../form/Input"
import { PontesInline } from "./Layout"
import styles from "./Toolbar.module.css"

export type PontesToolbarSearch = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Rótulo acessível do campo. Default = placeholder (ou "Buscar"). */
  ariaLabel?: string
  /** Limite de caracteres (o backend também corta em 100). Default 100. */
  maxLength?: number
}

export type PontesToolbarProps = {
  search?: PontesToolbarSearch
  /** Filtros depois da busca (ex.: PontesSegmented de status). */
  children?: ReactNode
}

export function PontesToolbar({ search, children }: PontesToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <PontesInline gap="md" wrap className={styles.toolbar}>
      {search && (
        <div className={styles.search}>
          <PontesInput
            ref={inputRef}
            type="search"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? "Buscar"}
            aria-label={search.ariaLabel ?? search.placeholder ?? "Buscar"}
            maxLength={search.maxLength ?? 100}
            iconStart={<Search size={16} strokeWidth={2.5} />}
            iconEnd={search.value ? (
              <button
                type="button"
                className={styles.clear}
                aria-label="Limpar busca"
                onClick={() => { search.onChange(""); inputRef.current?.focus() }}
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            ) : undefined}
          />
        </div>
      )}
      {children}
    </PontesInline>
  )
}
