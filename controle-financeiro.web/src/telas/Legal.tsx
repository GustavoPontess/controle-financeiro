// Páginas legais: Termos de Uso (/termos-de-uso) e Política de Privacidade (/privacidade), com a roupa do site. Copy portada
// do app atual (2026-08-18/19, fundamentada em docs/CONFORMIDADE_BR.md: LGPD, CDC, Marco Civil). Públicas.
//
// Controlador e contato (LGPD art. 9º e Resolução CD/ANPD nº 19/2024 art. 17): pessoa física enquanto não há empresa
// aberta; quando sair o CNPJ, trocar aqui (mapa em docs/DADOS_DA_EMPRESA.md).
import { useEffect, type ReactNode } from "react"
import { Link, useLocation } from "react-router-dom"
import MolduraSite from "../site/MolduraSite"
import styles from "./Legal.module.css"

const CONTROLADOR = "Gustavo Pontes"
const CONTATO = "pontes@pontesdev.com.br"
const Email = () => <a href={`mailto:${CONTATO}`}>{CONTATO}</a>

// Mesmo topo e rodapé do site (MolduraSite); o texto com a fonte e as cores do site.
function PaginaLegal({ titulo, atualizado, beta, children }: { titulo: string; atualizado: string; beta: ReactNode; children: ReactNode }) {
  // Link direto pra uma seção (/privacidade#onde-ficam): o navegador tenta rolar antes de a página existir.
  const { hash } = useLocation()
  useEffect(() => { if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView() }, [hash])
  return (
    <MolduraSite titulo={`${titulo} · Pontes`}>
      <main className={styles.miolo}>
        <span className="olho">Legal</span>
        <h1 className={styles.titulo}>{titulo}</h1>
        <p className={styles.atualizado}>Última atualização: {atualizado}</p>
        <div className={styles.beta}><strong>O Pontes está em beta fechado.</strong> {beta}</div>
        {children}
      </main>
    </MolduraSite>
  )
}

const Secao = ({ titulo, id, destaque, children }: { titulo: string; id?: string; destaque?: boolean; children: ReactNode }) => (
  <section id={id} className={destaque ? `${styles.secao} ${styles.destaque}` : styles.secao}><h2 className={styles.h2}>{titulo}</h2>{children}</section>
)

export function TermosDeUso() {
  return (
    <PaginaLegal titulo="Termos de Uso" atualizado="31 de outubro de 2026"
      beta="Você foi convidado pessoalmente pra testar o produto. O serviço pode mudar, sair do ar ou perder dados durante essa fase. Por enquanto, evite depender do app como único registro do seu histórico financeiro.">
      <Secao titulo="O que é o Pontes">
        <p className={styles.p}>O Pontes é uma ferramenta de <strong>registro manual</strong> de finanças pessoais e familiares, mais parecida com uma planilha do que com um banco digital. Você mesmo digita suas transações, contas e cartões.</p>
        <p className={styles.p}>O Pontes <strong>não</strong> é uma instituição financeira, não se conecta à sua conta bancária real, não movimenta dinheiro, não processa pagamento, não tem custódia de nenhum valor seu e <strong>não</strong> oferece consultoria ou recomendação de investimento. Qualquer decisão financeira que você tomar com base nos números do app é sua, não nossa.</p>
      </Secao>
      <Secao titulo="Sua conta">
        <ul className={styles.lista}>
          <li>Você é responsável por manter sua senha em segredo e por tudo que acontecer na sua conta.</li>
          <li>Os dados que você cadastra (transações, valores, nomes de terceiros em empréstimo) precisam ser verdadeiros: o Pontes não confere a veracidade do que você digita.</li>
          <li>Precisa ter pelo menos 18 anos, ou usar o app com autorização de um responsável.</li>
        </ul>
      </Secao>
      <Secao titulo="Uso aceitável">
        <p className={styles.p}>Não use o Pontes pra atividade ilegal, pra tentar acessar dado de outro usuário sem permissão, nem pra tentar quebrar, sobrecarregar ou comprometer a segurança do serviço. Contas que fizerem isso podem ser suspensas.</p>
      </Secao>
      <Secao titulo="Limites de responsabilidade">
        <p className={styles.p}>O Pontes é oferecido <strong>"como está"</strong>, sem garantia de disponibilidade contínua, principalmente durante o beta. Fazemos o possível pra manter seus dados seguros e íntegros (ver <Link to="/privacidade">Política de Privacidade</Link>), mas não nos responsabilizamos por decisão financeira tomada com base nos dados do app, nem por perda decorrente de uso indevido da sua própria conta.</p>
      </Secao>
      <Secao titulo="Cancelamento">
        <p className={styles.p}>Você pode parar de usar o Pontes e pedir a exclusão da sua conta e dos seus dados a qualquer momento, sem custo. É só falar com a gente (contato abaixo).</p>
      </Secao>
      <Secao titulo="Mudanças nestes termos">
        <p className={styles.p}>Podemos atualizar este documento conforme o produto evolui, principalmente ao sair do beta. Mudança relevante será avisada por e-mail ou dentro do app.</p>
      </Secao>
      <Secao titulo="Lei aplicável">
        <p className={styles.p}>Estes termos seguem a legislação brasileira, incluindo o Código de Defesa do Consumidor (Lei 8.078/1990) e o Marco Civil da Internet (Lei 12.965/2014).</p>
      </Secao>
      <Secao titulo="Fale com a gente">
        <div className={styles.contato}>Dúvida sobre estes termos, ou pedido de cancelamento: escreva pra <Email />. O Pontes é mantido por {CONTROLADOR}.</div>
      </Secao>
    </PaginaLegal>
  )
}

export function Privacidade() {
  return (
    <PaginaLegal titulo="Política de Privacidade" atualizado="31 de outubro de 2026"
      beta="Você foi convidado pessoalmente pra testar o produto. Dados podem ser resetados ou perdidos durante essa fase. Por enquanto, evite depender do app como único registro do seu histórico financeiro.">
      <p className={styles.p}><strong>Seus dados ficam num servidor nos Estados Unidos.</strong> Veja <a href="#onde-ficam">onde ficam e por quê</a>.</p>
      <Secao titulo="O que coletamos">
        <p className={styles.p}>Pra funcionar, o Pontes guarda os dados que você mesmo digita: nome, e-mail, foto de perfil (se você puser uma; só quem está nas suas famílias vê), transações (valor, data, descrição, categoria), contas e cartões que você cadastra (só um nome e uma cor; não conectamos a nenhum banco de verdade) e, na função de empréstimos, o nome e valor de pessoas com quem você tem uma dívida ou crédito, mesmo que essa pessoa não tenha conta no Pontes.</p>
        <p className={styles.p}>Se você mandar algo pelo selo <strong>Beta</strong> (um problema ou uma melhoria), guardamos o que você escreveu, a tela de onde mandou e, se você anexar, imagens da tela. Nas imagens e no texto dos blocos apontados, os seus valores vão escondidos, a não ser que você escolha mostrar. Só a equipe do Pontes vê, e as imagens são apagadas 30 dias depois que a solicitação é encerrada.</p>
        <p className={styles.p}>O Pontes <strong>não</strong> se conecta à sua conta bancária real, não movimenta dinheiro, não processa pagamento e não tem custódia de nenhum valor seu. É um registro manual, mais parecido com uma planilha do que com um banco digital.</p>
      </Secao>
      <Secao titulo="Por que coletamos (base legal)">
        <ul className={styles.lista}>
          <li><strong>Seus próprios dados</strong> (conta, transações, cartões): tratados pra executar o contrato de uso do app, ou seja, o que você espera que o Pontes faça por você (Art. 7º, V da LGPD).</li>
          <li><strong>O que você manda pelo selo Beta</strong>: tratado porque você pediu pra nos contar (Art. 7º, V). Quando você escolhe mostrar os seus valores nos anexos, a base é o seu consentimento (Art. 7º, I), dado a cada envio; sem essa escolha, os valores vão escondidos.</li>
          <li><strong>Dados de terceiros em empréstimos</strong> (nome/valor de alguém que te deve ou você deve): tratados com base em legítimo interesse: seu interesse legítimo em manter um registro pessoal de dívida (Art. 7º, IX). Coletamos só o mínimo (nome e valor), nunca dado extra dessa pessoa.</li>
        </ul>
      </Secao>
      <Secao titulo="Seus direitos">
        <p className={styles.p}>Você pode pedir acesso, correção, exclusão ou exportação dos seus dados a qualquer momento, inclusive dados de empréstimo sobre você registrados por outra pessoa, mesmo sem ter conta no Pontes. É só falar com a gente (contato abaixo); respondemos dentro do prazo legal. Se achar que não resolvemos, você pode reclamar à <a href="https://www.gov.br/anpd" target="_blank" rel="noreferrer">ANPD</a> (Autoridade Nacional de Proteção de Dados).</p>
      </Secao>
      {/* LGPD art. 33 e Resolução CD/ANPD nº 19/2024 art. 17 §§ 2º e 3º: o que a transferência precisa informar, em destaque. */}
      <Secao titulo="Onde seus dados ficam (transferência internacional)" id="onde-ficam" destaque>
        <p className={styles.p}>Os dados do Pontes ficam num servidor alugado da <strong>Hostinger</strong>, nos <strong>Estados Unidos</strong>. Pela lei isso é uma transferência internacional de dados (LGPD, art. 33), e é assim que ela funciona:</p>
        <ul className={styles.lista}>
          <li><strong>Pra quê:</strong> guardar e processar o que você registra pro app funcionar (salvar lançamentos, calcular saldos, entrar na sua conta). Só isso.</li>
          <li><strong>Pra onde:</strong> Estados Unidos, no servidor da Hostinger. A Cloudflare, que fica na frente do site, atende pela rede dela em vários países. Os e-mails do Pontes saem pelo Resend, de servidores em São Paulo.</li>
          <li><strong>Como e por quanto tempo:</strong> os dados viajam sempre criptografados (HTTPS) e ficam no servidor enquanto a sua conta existir. Quando você exclui a conta, eles são apagados de lá, e das cópias de segurança quando elas são renovadas.</li>
          <li><strong>Por que pode:</strong> a transferência é necessária pra executar o contrato de uso do app que você aceitou (LGPD, art. 33, IX, com o art. 7º, V). Hostinger, Cloudflare e Resend tratam os dados só por nossa conta, como operadores, e não usam pra nada deles.</li>
          <li><strong>Segurança:</strong> conexão sempre criptografada, banco de dados sem acesso pela internet, servidor acessado só com chave, cópia de segurança diária e senha protegida com Argon2id.</li>
          <li><strong>Seus direitos e quem responde:</strong> os mesmos de "Seus direitos" acima, inclusive reclamar à ANPD. Quem responde pelos seus dados (controlador) é {CONTROLADOR}, pelo e-mail <Email />.</li>
        </ul>
      </Secao>
      <Secao titulo="Com quem compartilhamos">
        <p className={styles.p}>Com ninguém, exceto: a outra pessoa de um empréstimo vinculado (ela vê o que você registrou sobre a dívida entre vocês dois) e provedores técnicos que hospedam e protegem o app (banco de dados, servidor, envio de e-mail e a Cloudflare, que fica na frente do site contra ataques e, nas telas de entrar, pedir acesso e recuperar senha, confere que quem preenche não é um robô; pra isso ela vê o endereço IP e dados do navegador; ver "Onde seus dados ficam") e o Google, que entrega as fontes do texto (vê o endereço IP e dados do navegador). Eles não usam seus dados pra nada além de manter o Pontes no ar e seguro.</p>
      </Secao>
      {/* Lista que precisa bater com o CookiesDoApp (API) e com as chaves de localStorage do front. Cookie ou chave nova entra aqui. */}
      <Secao titulo="Cookies e o que fica no seu navegador">
        <p className={styles.p}>O Pontes usa só os cookies <strong>necessários</strong> pra você entrar e usar o app com segurança. <strong>Não</strong> usamos cookies de publicidade nem de análise de audiência, e não seguimos você em outros sites. Por serem necessários, não pedimos consentimento: a base é o legítimo interesse de manter o serviço funcionando e seguro (Art. 7º, IX da LGPD), como orienta o guia de cookies da ANPD. Todos são do próprio Pontes, só vão pro endereço do app e não podem ser lidos por outros sites.</p>
        <ul className={styles.lista}>
          <li><strong>Sessão</strong> (__Host-jwt): mostra ao servidor que é você, a cada tela. Dura 15 minutos e se renova sozinho enquanto você usa.</li>
          <li><strong>Renovação da sessão</strong> (__Host-rt_…, um por conta conectada, até 5) e <strong>conta ativa</strong> (__Host-active_acct): renovam a sessão e dizem qual das suas contas está aberta. Com "Manter-me conectado", duram 7 dias; sem, somem ao fechar o navegador.</li>
          <li><strong>Proteção contra ataques</strong> (__Host-X-CSRF-Token): impede que outro site faça algo na sua conta sem você saber. Dura o mesmo que a renovação da sessão.</li>
          <li><strong>Contas lembradas</strong> (__Host-rd): só se você marcar "Manter-me conectado"; guarda um número aleatório que identifica este navegador pra mostrar suas contas na tela de entrar. Dura 180 dias.</li>
          <li><strong>Aparelho conhecido</strong> (__Host-ac): marca que este navegador já entrou na sua conta, pra você não ter que esperar depois de errar a senha. Dura 180 dias.</li>
          <li><strong>Aparelho confiável</strong> (__Host-td): só se você pedir pra não informar o código das duas etapas neste aparelho. Dura 30 dias.</li>
        </ul>
        <p className={styles.p}>No armazenamento do navegador (não é cookie e não vai pro servidor) ficam só preferências suas: tema claro ou escuro, menu aberto ou recolhido, valores escondidos ou não, quantos itens por página e a última visão das telas, e a lista das contas conectadas neste navegador (nome e e-mail), que some quando você sai.</p>
        <p className={styles.p}>A Cloudflare, que protege o site, pode gravar cookies de segurança dela pra separar pessoas de robôs. As fontes do texto vêm do Google Fonts: ao abrir o site, o navegador busca as fontes nos servidores do Google.</p>
        <p className={styles.p}>Você pode apagar tudo isso pelas configurações do navegador a qualquer momento; aí é só entrar de novo.</p>
      </Secao>
      <Secao titulo="Segurança">
        <p className={styles.p}>Senha protegida com Argon2id (padrão recomendado pela OWASP), conexão sempre criptografada (HTTPS), sessão em cookie seguro. Detalhe técnico completo em nossa documentação de segurança, disponível sob pedido.</p>
      </Secao>
      <Secao titulo="Fale com a gente">
        <div className={styles.contato}>Quem cuida dos seus dados (controlador) é {CONTROLADOR}, pessoa física, enquanto o Pontes não tem empresa aberta. Dúvida, pedido de acesso ou exclusão de dados, ou qualquer coisa sobre privacidade: escreva pra <Email />. Como agente de pequeno porte, o Pontes não tem encarregado (DPO) nomeado; este e-mail é o canal com você (Resolução CD/ANPD nº 2/2022).</div>
      </Secao>
    </PaginaLegal>
  )
}
