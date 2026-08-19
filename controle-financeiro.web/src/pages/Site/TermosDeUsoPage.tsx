/**
 * TermosDeUsoPage — Termos de Uso. Rota pública `/termos-de-uso`.
 *
 * RASCUNHO (2026-08-19) — escrito a pedido do Gustavo pra tirar o link morto do rodapé de
 * login/cadastro antes do beta. Base: Código de Defesa do Consumidor (Lei 8.078/1990) + Marco
 * Civil da Internet (Lei 12.965/2014) + mesmos limites de escopo já pesquisados em
 * docs/CONFORMIDADE_BR.md (fora do BACEN — não movimenta dinheiro). Documento contratual — não é
 * pesquisa de segurança/LGPD como a Política de Privacidade: precisa da revisão do Gustavo antes
 * de virar peça definitiva pro lançamento público.
 */
import { Link } from "react-router-dom"
import styles from "./PrivacidadePage.module.css"

export default function TermosDeUsoPage() {
  return (
    <div className={styles.root}>
      <div className={styles.wrap}>
        <div className={styles.eyebrow}>Legal</div>
        <h1 className={styles.title}>Termos de Uso</h1>
        <p className={styles.updated}>Última atualização: 19 de agosto de 2026</p>

        <div className={styles.betaBox}>
          <strong>O Pontes está em beta fechado.</strong> Você foi convidado pessoalmente pra
          testar o produto. O serviço pode mudar, sair do ar ou perder dados durante essa fase —
          evite depender do app como único registro do seu histórico financeiro por enquanto.
        </div>

        <div className={styles.section}>
          <h2 className={styles.h2}>O que é o Pontes</h2>
          <p className={styles.p}>
            O Pontes é uma ferramenta de <strong>registro manual</strong> de finanças pessoais e
            familiares — mais parecida com uma planilha do que com um banco digital. Você mesmo
            digita suas transações, contas e cartões.
          </p>
          <p className={styles.p}>
            O Pontes <strong>não</strong> é uma instituição financeira, não se conecta à sua conta
            bancária real, não movimenta dinheiro, não processa pagamento, não tem custódia de
            nenhum valor seu e <strong>não</strong> oferece consultoria ou recomendação de
            investimento — qualquer decisão financeira que você tomar com base nos números do app
            é sua, não nossa.
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.h2}>Sua conta</h2>
          <ul className={styles.list}>
            <li>Você é responsável por manter sua senha em segredo e por tudo que acontecer na
              sua conta.</li>
            <li>Os dados que você cadastra (transações, valores, nomes de terceiros em
              empréstimo) precisam ser verdadeiros — o Pontes não confere a veracidade do que
              você digita.</li>
            <li>Precisa ter pelo menos 18 anos, ou usar o app com autorização de um responsável.</li>
          </ul>
        </div>

        <div className={styles.section}>
          <h2 className={styles.h2}>Uso aceitável</h2>
          <p className={styles.p}>
            Não use o Pontes pra atividade ilegal, pra tentar acessar dado de outro usuário sem
            permissão, nem pra tentar quebrar, sobrecarregar ou comprometer a segurança do
            serviço. Contas que fizerem isso podem ser suspensas.
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.h2}>Limites de responsabilidade</h2>
          <p className={styles.p}>
            O Pontes é oferecido <strong>"como está"</strong>, sem garantia de disponibilidade
            contínua — principalmente durante o beta. Fazemos o possível pra manter seus dados
            seguros e íntegros (ver{" "}
            <Link to="/privacidade" className={styles.contactBoxLink}>Política de Privacidade</Link>
            ), mas não nos responsabilizamos por decisão financeira tomada com base nos dados do
            app, nem por perda decorrente de uso indevido da sua própria conta.
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.h2}>Cancelamento</h2>
          <p className={styles.p}>
            Você pode parar de usar o Pontes e pedir a exclusão da sua conta e dos seus dados a
            qualquer momento, sem custo — é só mandar um e-mail (contato abaixo).
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.h2}>Mudanças nestes termos</h2>
          <p className={styles.p}>
            Podemos atualizar este documento conforme o produto evolui, principalmente ao sair do
            beta. Mudança relevante será avisada por e-mail ou dentro do app.
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.h2}>Lei aplicável</h2>
          <p className={styles.p}>
            Estes termos seguem a legislação brasileira, incluindo o Código de Defesa do
            Consumidor (Lei 8.078/1990) e o Marco Civil da Internet (Lei 12.965/2014).
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.h2}>Fale com a gente</h2>
          <div className={styles.contactBox}>
            Dúvida sobre estes termos, ou pedido de cancelamento:{" "}
            <a href="mailto:gut.n.pontes@gmail.com">gut.n.pontes@gmail.com</a>
          </div>
        </div>
      </div>
    </div>
  )
}
