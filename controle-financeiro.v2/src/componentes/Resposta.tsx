// A resposta de uma tela em uma frase (docs/features/respostas/visao.md): o número e o que dá pra fazer, com o tom
// da situação. O texto vem pronto do servidor; aqui só a caixa e as ações.
import { useNavigate } from "react-router-dom"
import Botao from "./Botao"
import styles from "./Resposta.module.css"

export default function Resposta({ tom = "neutro", texto, acoes = [] }: {
  tom?: "positivo" | "alerta" | "negativo" | "neutro"
  texto: string
  acoes?: { rotulo: string; para: string }[]
}) {
  const navigate = useNavigate()
  return (
    <div className={styles.resposta} data-tom={tom}>
      <p className={styles.texto}>{texto}</p>
      {acoes.length > 0 && (
        <div className={styles.acoes}>
          {acoes.map((a) => <Botao key={a.para} onClick={() => navigate(a.para)}>{a.rotulo}</Botao>)}
        </div>
      )}
    </div>
  )
}
