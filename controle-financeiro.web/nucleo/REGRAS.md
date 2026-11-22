# Regras gerais dos projetos da Pontes Dev

Vêm do app Pontes, que é a referência. Valem pra qualquer projeto que puxa o núcleo. As do front, uma por decisão,
estão no `CONVENCOES.md`.

## Segurança e LGPD (inegociável)

- **Antes de lançar qualquer coisa que toca login, dado pessoal ou dado sensível:** conferir nas fontes primárias
  (OWASP, NIST, ANPD) e respeitar tudo. Dado de saúde é sensível (LGPD art. 11).
- **A API nega por padrão:** tudo exige login; endpoint público declara `[AllowAnonymous]`, nunca "sem atributo".
- **Dono do recurso em toda escrita:** id que vem do cliente é conferido contra a pessoa (ou a empresa) antes de
  gravar; de outro ou inexistente → 404 (o mesmo pros dois). Filtrar a leitura não basta.
- **Quem pode o quê num lugar só:** as perguntas de permissão têm nome num helper; nunca reescritas na mão por tela
  ou service. Regra nova = pergunta nova no helper + teste.
- **Sessão:** JWT de 15 min em cookie httpOnly + refresh opaco rotativo de 7 dias com detecção de reuso; CSRF no
  header. Em HTTPS todo cookie sai como `__Host-…` (Secure, `Path=/`, sem Domain) e o nome sem prefixo nunca é lido.
- **Senha (NIST SP 800-63B):** 15 a 128 caracteres, sem regra de composição, recusa comum/sequência/vazada (Pwned
  Passwords por k-anonymity). Hash Argon2id com pepper.
- **Senha errada:** nunca trava a conta e a frase não muda conforme a conta exista; Turnstile (Cloudflare) a partir
  do 1º erro, espera que dobra a partir do 5º. Pedir acesso e Esqueci a senha exigem Turnstile sempre.
- **Duas etapas** no admin sempre; o admin é um mini-app à parte, num endereço secreto, fora do pacote do app.
- **Sair por inatividade** em sessão sem "Manter-me conectado": regra no servidor.
- **Menor exposição:** o que não é pra pessoa ela nem recebe (a API não manda pro front esconder). Log nunca leva
  destinatário, token, código nem dado pessoal.
- **Arquivo que vem do cliente:** decidido pelo conteúdo, redesenhado (imagem sem EXIF/GPS), com teto de tamanho.
- **Pacote novo (npm ou NuGet) só entra conferido:** quem publicou, downloads, idade e repositório de origem. Na
  dúvida, não entra. Instalação no CI e no Docker é `npm ci`.
- **Exportar e apagar os dados da pessoa (LGPD):** todo dado novo da pessoa entra na exportação e na purga.

## Regras de código

- **Que dia é hoje:** um helper só, no fuso da conta (servidor e front). Nunca `DateTime.UtcNow.Date`,
  `DateTime.Now`, `new Date()` solto na tela. Trava lê o código.
- **Valor em reais em mensagem:** helper `Reais.Formatar`; nunca `{x:C}` nem `CultureInfo` (a imagem de produção
  roda com cultura invariante).
- **Idempotência** em criação que não pode duplicar: header `Idempotency-Key`, tabela com índice único, gravada na
  MESMA gravação (um SaveChanges só); mesmo pedido devolve o resultado original, outro conteúdo → 409.
- **Concorrência otimista** (`xmin` do Postgres) onde duas pessoas mexem no mesmo registro → 409.
- **Schema só por migration**, sempre compatível com a versão anterior (rollback não desfaz migration).
- **Limitação do back se resolve no back** (gravação única, idempotência, teste), nunca contornando pelo front.
- **Criar e editar exigem o mesmo:** mesmo formulário, mesma validação, uma conferência no servidor pros dois.
- **Validação nas duas pontas:** o front bloqueia antes de enviar; o servidor confere de novo. Limite de caracteres
  igual nos dois.
- **Listas:** busca, filtro e página no servidor.
- **Projeto de teste na solution:** senão o CI passa verde sem rodar nada.

## Texto que a pessoa lê

PT-BR simples. Sem travessão. Sem subtítulo explicativo embaixo do título e sem contador redundante. Campo vazio
diz o que é ("Não informado"). Erro no campo, uma linha.

## Processo

- `STATE.md` (onde parou) e `ROADMAP.md` (fila com prioridade P0 a P3) atualizados ao fim de CADA bloco.
- Todo achado vira item priorizado no ROADMAP; P0 fura a fila.
- Commit, push e PR só quando o Gustavo pedir. Deploy só com "sobe".
- Mudança grande: explicar o plano em português claro e esperar o OK antes.
- Toda tela nova: teste (enviar vazio bloqueia + fluxo feliz), dados de demonstração em todos os estados e o painel
  de dev com os estados.
- Testes locais só do que mudou; a suíte inteira é do CI.
- Nunca afirmar fato do código sem ler antes.
