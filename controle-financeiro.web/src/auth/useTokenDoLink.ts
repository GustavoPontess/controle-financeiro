// Código secreto dos links que chegam por e-mail (senha nova, confirmar e-mail, "Não fui eu").
// - O e-mail manda o código depois do "#" (/redefinir-senha#token=…): essa parte nunca sai do navegador, então nenhum
//   servidor, proxy ou log recebe o código. Link antigo com "?token=" (e-mail mandado antes da troca) continua valendo.
// - Lido uma vez, o código sai da barra de endereço (some do histórico e de print de tela) e fica só na memória da tela.
//   O resto do endereço fica como estava (o "#nova" da barra de dev, por exemplo).
import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"

const lerDoHash = (hash: string) => new URLSearchParams(hash.replace(/^#/, "")).get("token")

export function useTokenDoLink(): string {
  const { pathname, search, hash } = useLocation()
  const navigate = useNavigate()
  const [token] = useState(() => (lerDoHash(hash) ?? new URLSearchParams(search).get("token") ?? "").trim())

  useEffect(() => {
    const busca = new URLSearchParams(search)
    const noHash = lerDoHash(hash) !== null
    if (!busca.has("token") && !noHash) return
    busca.delete("token")
    const resto = busca.toString()
    navigate(`${pathname}${resto ? `?${resto}` : ""}${noHash ? "" : hash}`, { replace: true })
    // Só na abertura: depois de limpo, não há o que tirar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return token
}
