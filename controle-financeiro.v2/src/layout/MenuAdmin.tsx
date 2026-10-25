// O pedaço "Administração" do menu, carregado à parte (lazy) e só pra quem é admin: os textos e o atalho do admin
// não ficam no código que todo usuário baixa. O V2Layout passa o próprio Item, pra o visual ser o mesmo do menu.
import type { ComponentType } from "react"
import { ShieldCheck } from "lucide-react"

type ItemMenu = { para: string; rotulo: string; icone: typeof ShieldCheck }

export default function MenuAdmin({ Item, classeGrupo, classeRotulo }: {
  Item: ComponentType<ItemMenu>
  classeGrupo: string
  classeRotulo: string
}) {
  return (
    <>
      <span className={classeGrupo}><span className={classeRotulo}>Administração</span></span>
      <Item para="/admin" rotulo="Admin" icone={ShieldCheck} />
    </>
  )
}
