---
owner: Gustavo
last_reviewed: 2026-08-18
status: ATIVO
---

# Conformidade & Fontes de referência

**Índice das fontes autoritativas** que regem segurança e conformidade do Pontes. **Consultar SEMPRE** antes de codar segurança, mexer em dados pessoais/financeiros, ou planejar lançamento. Regra inegociável em `CLAUDE.md`; gate de lançamento em `ROADMAP.md`; spec técnico em `docs/SEGURANCA_BEST_PRACTICES.md`.

> Brasil **não tem** equivalente técnico do OWASP/NIST — segurança técnica (como codar) vem de OWASP/NIST (internacional, usado no mundo todo). O Brasil entra na camada **legal/regulatória** (LGPD/ANPD/BACEN). Use os dois: OWASP/NIST pro "como fazer seguro", LGPD/BACEN pro "quais regras o Brasil impõe".

---

## 🔧 Técnico — como codar seguro (internacional)

| Fonte | O que é | Consultar para | Link |
|---|---|---|---|
| **OWASP Cheat Sheet Series** | Guias práticos "faça assim", por tema | Senha (Password Storage), reset (Forgot Password), token/sessão (Session Management), CSRF, logging, secrets | https://cheatsheetseries.owasp.org |
| **OWASP Top 10** | 10 falhas web mais comuns | Visão geral de risco web | https://owasp.org/Top10 |
| **OWASP API Security Top 10 (2023)** | Top 10 de risco em APIs | Broken Auth (API2), Resource Consumption (API4) | https://owasp.org/API-Security |
| **OWASP ASVS** | Checklist de verificação de segurança (níveis L1/L2/L3) | Auditoria/checklist de segurança | https://owasp.org/www-project-application-security-verification-standard |
| **NIST SP 800-63B** | Padrão de identidade/autenticação (governo EUA) | Política de senha, MFA/AAL, força de autenticação | https://pages.nist.gov/800-63-4/sp800-63b.html |
| **RFC 8725** | JWT Best Current Practices (IETF) | Validação de JWT (rejeitar `alg:none`, etc) | https://datatracker.ietf.org/doc/html/rfc8725 |

## ⚖️ Regulatório Brasil — regras impostas (legal)

| Fonte | O que é | Aplica a nós? | Consultar para | Link |
|---|---|---|---|---|
| **LGPD** (Lei 13.709/2018) | Lei geral de proteção de dados (≈ GDPR) | ✅ **obrigatório** | Base legal/consentimento, direitos do titular (acesso/exclusão/portabilidade), minimização, RIPD/DPIA | https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm |
| **ANPD** | Autoridade que fiscaliza a LGPD (aplica multa, publica guias) | ✅ | Guias oficiais, template de RIPD, prazos | https://www.gov.br/anpd |
| **Marco Civil da Internet** (Lei 12.965/2014) | Direitos e deveres na internet | ✅ | Privacidade, guarda de logs de acesso | https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm |
| **BACEN** (Banco Central) | Regula instituições financeiras/pagamento, Pix, Open Finance | ⏳ **só se movimentar dinheiro / virar IP** | Cibersegurança de instituição financeira, Pix | https://www.bcb.gov.br |
| **Open Finance Brasil** | Open banking regulado pelo BACEN | ⏳ **só se integrar Open Finance** (puxar dados de banco) | Padrão de segurança **FAPI** (Financial-grade API, sobre OAuth) | https://openfinancebrasil.org.br · FAPI: https://openid.net/specs/fapi |
| **CVM** | Regula valores mobiliários/investimentos | ⏳ só se mexer com investimento | — | https://www.gov.br/cvm |

## 📐 Normas técnicas (voluntárias, dão credibilidade)

| Fonte | O que é | Link |
|---|---|---|
| **ABNT NBR ISO/IEC 27001** | Gestão de segurança da informação (selo que banco/investidor olha) | https://www.iso.org/standard/27001 |
| **ABNT NBR ISO/IEC 27002** | Controles de segurança (complementa a 27001) | https://www.abnt.org.br |

---

## Quando consultar (gatilhos)

- **Mexer em auth / senha / token / sessão** → OWASP Cheat Sheets + NIST + RFC 8725.
- **Mexer em dado pessoal / PII / financeiro do usuário** → LGPD + ANPD.
- **Adicionar logs / coletar dado novo** → LGPD (minimização) + OWASP Logging.
- **Planejar lançamento (`1.0.0`)** → checklist do gate no `ROADMAP.md` (todas as fontes acima).
- **Pensar em mover dinheiro / Pix / integrar banco** → BACEN + Open Finance/FAPI (gatilho que muda TUDO — vira entidade regulada).
- **Pensar em receber/processar pagamento com cartão** (ex.: cobrar o plano Família/Contador) → **PCI-DSS** (norma das bandeiras). Regra prática: **nunca** deixar o número do cartão passar pelo nosso servidor — usar gateway com página/campo hospedado e tokenização (Stripe, Pagar.me, Mercado Pago…), o que reduz o escopo ao questionário mais simples (SAQ A). Revisar a política de senha das contas **da equipe** que acessam o ambiente de pagamento (o PCI ainda pede letras + números lá; a dos clientes segue o NIST). *Anotado 2026-10-15 a partir de conhecimento geral — conferir a versão vigente do PCI-DSS na fonte (pcisecuritystandards.org) quando o gatilho disparar.*

## Status da nossa pesquisa
- ✅ Técnico (senha/reset/token/CSRF/API) verificado por fonte primária → `docs/SEGURANCA_BEST_PRACTICES.md`.
- ✅ **LGPD, BACEN/Open Finance e regime de pequeno porte — pesquisados por completo em 2026-08-18**
  (3 agentes em paralelo, fonte primária: planalto.gov.br, gov.br/anpd, bcb.gov.br,
  normativos.bcb.gov.br). Resumo abaixo; achados acionáveis catalogados no `ROADMAP.md` → "Gate de
  lançamento".

### BACEN / Open Finance — **fora do escopo regulatório**, confiança alta
Pontes não coleta/intermedeia recursos de terceiros nem tem custódia de valor (Lei 4.595/1964,
Art. 17), não opera "conta de pagamento" nem executa instrução de pagamento (Lei 12.865/2013,
Art. 6º), e Open Finance só se aplica a instituições já autorizadas pelo BACEN (Resolução Conjunta
BCB/CMN nº 1/2020, Art. 1º-2º — quem não é autorizado é sempre "cliente", nunca "participante"). O
recurso de empréstimo entre pessoas também fica fora do SEP (Resolução CMN 4.656/2018) — não há
captação/direcionamento de recursos por uma plataforma de matching. **Sem ação necessária.** Vale
reabrir essa pesquisa só se o item de roadmap "Conexão com Open Finance" sair do papel de verdade.

### LGPD — base legal, RIPD, DPO, direitos do titular
- **Base legal:** dados próprios (transação, conta, cartão) → execução de contrato (Art. 7º, V).
  Dados de terceiro em empréstimo (nome/valor de alguém sem conta) → legítimo interesse (Art. 7º,
  IX + teste de balanceamento do Art. 10), com minimização estrita (só nome + valor).
- **RIPD:** não obrigatório agora (não há dado sensível nem processamento em larga escala); ANPD
  pode exigir a qualquer momento por causa da base de legítimo interesse — reavaliar se a base de
  usuários crescer.
- **DPO/Encarregado:** dispensado — Pontes se qualifica como **agente de tratamento de pequeno
  porte** (Resolução CD/ANPD nº 2/2022, Art. 11º), que troca o DPO por um canal de comunicação
  acessível com o titular (temos: e-mail de contato na `/privacidade`). Essa resolução também
  dobra o prazo de resposta a pedido de titular (Art. 14º) e permite política de segurança e
  registro de operações simplificados (Art. 9º/13º).
- **Direitos do titular:** cumprimento manual (e-mail) é suficiente nesta fase — endpoint de
  autoatendimento (exportar/apagar) fica pro lançamento público.
- **Transferência internacional (registro, 2026-10-31; decisão do Gustavo):** o servidor é uma VPS da Hostinger nos
  **EUA** (São Paulo sem vaga na contratação, `docs/features/hospedagem-beta/decisao.md`). Guardar os dados num
  operador no exterior é transferência internacional (Resolução CD/ANPD nº 19/2024, Anexo I, arts. 3º e 5º).
  - **Mecanismo escolhido:** LGPD **art. 33, IX** (necessária pra executar o contrato, art. 7º, V), admitido pelo
    art. 9º, II, "c" do regulamento, com finalidade informada, mínimo necessário e hipótese legal do art. 7º.
    Consentimento (art. 33, VIII) descartado: exigiria caixa específica e em destaque só pra transferência, e quem
    recusasse ou revogasse ficaria sem o app. O "Li e aceito a Política de Privacidade" do Pedir acesso é aceite da
    política (que agora explica a transferência), não esse consentimento específico.
  - **Por que não as cláusulas-padrão da ANPD (art. 16, texto integral, prazo de adoção acabou em ago/2025):**
    conferido em 2026-10-31 que o DPA da Hostinger (`hostinger.com/legal/dpa`) cita a LGPD mas só traz as EU SCCs, e
    o DPA da Cloudflare (`cloudflare.com/cloudflare-customer-dpa`) não menciona o Brasil; a ANPD não reconheceu as EU
    SCCs como equivalentes. Reavaliar se algum deles passar a oferecer as cláusulas da ANPD.
  - **Operadores e países:** Hostinger (servidor e banco, EUA), Cloudflare (proxy, rede global), Resend (e-mail,
    região São Paulo, sem transferência). Sentry desligado em produção.
  - **Transparência (art. 17, §§ 2º e 3º, usado como modelo):** seção em destaque "Onde seus dados ficam
    (transferência internacional)" na `/privacidade` (`#onde-ficam`), com finalidade, destino, duração, base legal,
    operadores, segurança, direitos (inclusive reclamar à ANPD) e controlador com contato.
  - **Controlador:** Gustavo Pontes, pessoa física, enquanto não há CNPJ (`Legal.tsx`, `CONTROLADOR`/`CONTATO`).
  - **Saída estrutural:** trazer o servidor pra São Paulo antes do lançamento público, se abrir vaga (elimina a
    transferência principal; reinstalar apaga tudo; trabalho do chat do servidor).
  - Fontes: Resolução CD/ANPD nº 19/2024 (gov.br/anpd, atos normativos) e LGPD arts. 7º, 9º e 33.
- **Solicitações do beta (selo Beta, 2026-10-30):** texto, tela e até 5 anexos (print ou bloco apontado).
  Base: execução do pedido do titular (Art. 7º, V); valores à mostra só com **consentimento por envio**
  (Art. 7º, I; escolha "Mostrar meus valores nos anexos", desligada por padrão, gravada em
  `SolicitacaoAnexo.MostrarValores`). Minimização (Art. 6º III): valores mascarados por padrão (front +
  `SolicitacaoService.Mascarar`), imagem redesenhada em WebP (nada do arquivo enviado), só o admin vê
  (policy `IsAdmin`), **retenção: anexos apagados 30 dias após a solicitação fechar**
  (`PurgaPrintSolicitacaoJob`); entra na exportação e sai na purga da conta (cascade). Texto na
  `/privacidade` ("O que coletamos" e "Por que coletamos").
- **Exibição de PII (e-mail) no painel admin — analisado 2026-09-12 (fonte primária):** exibir o
  e-mail do usuário pro **admin autenticado** (fila de aprovação, gestão de usuários, LGPD, auditoria)
  **é permitido**. Base: Art. 6º III (necessidade) — o e-mail é dado *pertinente e proporcional* à
  finalidade (decidir aprovação, gerir conta, atender direito do titular), não excessivo; Art. 6º VII +
  Art. 46 (segurança/controle de acesso) — exigem que só quem precisa veja, e o acesso já é restrito
  (policy `IsAdmin` + chunk lazy só-admin, zero no bundle comum). A LGPD **não obriga** mascarar PII do
  operador autorizado. **Mesmo assim implementamos mascaramento com "revelar" (olhinho)** como *privacy
  by design* (Art. 6º VII/VIII) — reduz exposição em print/ombro; default mascarado, revelação sob
  demanda. Não é exigência legal, é reforço.
- **Eliminação de dados — prazo e retenção (pesquisado 2026-08-26, LGPD Art. 15-16 + ANPD FAQ 5.5):**
  - **Não há prazo fixo em dias na LGPD.** A lei manda eliminar os dados **após o término do
    tratamento** ("no âmbito e nos limites técnicos das atividades"), sem cravar número de dias.
    Término do tratamento (Art. 15): finalidade alcançada/dados desnecessários, fim do período, ou
    **comunicação do titular** (revogação/pedido de exclusão).
  - **Padrão que passa em auditoria (GDPR/SOC 2, pesquisado 2026-08-26): soft delete → carência →
    hard delete.** Só soft delete permanente NÃO é conforme (mantém o dado que o titular mandou
    apagar). O soft é só a janela reversível; o hard (delete real, cascade) é obrigatório no fim pra
    satisfazer o direito ao esquecimento.
  - **⚠️ Sobre "30 dias" — separar duas coisas (a LGPD NÃO fixa carência de exclusão):**
    - **Prazo de RESPOSTA ao titular (isto é lei):** LGPD **Art. 19 = 15 dias**; Resolução CD/ANPD
      nº 2/2022 **dobra** pra agente de pequeno porte → **30 dias no nosso caso**. É o prazo pra
      ATENDER o pedido, não "janela antes de apagar".
    - **Prazo pra ELIMINAR os dados:** LGPD Art. 15-16 **não cravam dias** ("após o término do
      tratamento, nos limites técnicos").
    - **Janela de carência (soft→hard) de 30 dias:** é **convenção de mercado / boa prática (SOC 2/
      GDPR), NÃO obrigação legal.** Escolha nossa. Protege contra exclusão acidental e contra **conta
      hackeada** (o dono real recupera antes da purga). Coincide com nosso prazo de resposta (30d),
      o que é conveniente, mas não é a lei mandando.
  - **Conservação permitida mesmo após pedido de exclusão (Art. 16):** dados necessários pra (1)
    cumprir **obrigação legal/regulatória**; (2) estudo por órgão de pesquisa (anonimizado); (3)
    transferência a terceiro conforme a lei; (4) **uso exclusivo do controlador, anonimizado**.
    Regra prática: apagar o PII, e o que precisar reter (ex.: `FinancialEventLog` de auditoria)
    fica **anonimizado**, sem acesso de terceiro.
  - **Prazo de resposta ao pedido do titular:** ~15 dias na LGPD, **dobrado** pra agente de pequeno
    porte (Resolução CD/ANPD nº 2/2022) → ~30 dias no nosso caso. A eliminação em si é "sem demora,
    nos limites técnicos".
  - **Aplicação no admin (Ferramentas LGPD):** exclusão em 2 estágios — (1) marcar pra exclusão
    (soft-delete reversível, janela ~30 dias); (2) purga definitiva do PII após a janela, retendo
    anonimizado só o exigido por lei.
- **Retenção obrigatória de logs — Marco Civil da Internet Art. 15 (pesquisado 2026-08-26):**
  provedor de aplicações **PJ, organizado, com fins econômicos** deve guardar os **registros de acesso
  a aplicações (login → identificador + IP + timestamp) por 6 MESES**, sob sigilo/ambiente controlado;
  ordem judicial pode estender. **Isso limita a exclusão:** ao apagar uma conta, os registros de
  acesso NÃO vão junto — ficam retidos 6 meses num store separado seguro (conservação por obrigação
  legal, LGPD Art. 16, I), depois são purgados. Fonte: [Marco Civil Art. 15](https://www.jusbrasil.com.br/topicos/27363770/art-15-da-lei-n-12965-de-23-de-abril-de-2014).
  **Aplicabilidade:** mira PJ com fins econômicos — hoje o Pontes é pré-empresa (sem CNPJ), então
  ainda não dispara pleno, mas dispara quando existir a empresa, e ordem judicial vale pra qualquer
  um. **Desenhar pra isso desde já.** **Achado de código — RESOLVIDO (2026-09-12):** existe o store
  dedicado `RegistroAcesso` (entidade sem FK → fora do cascade da conta), captura de login+IP+timestamp
  no `AuthController`, retenção 6 meses (`RegistroAcessoService.RetencaoDias=180`) com purga automática
  via `PurgaRegistroAcessoExpiradoJob` (Hangfire diário). O dado guardado é o registro legal do
  Art. 5 VIII — **data/hora + IP** — mais o e-mail como identificador (mantém o log útil após a purga
  da conta); **sem User-Agent** (minimização, Art. 6º III). Reconfirmado na fonte primária em
  2026-09-12: Art. 5, VIII define o registro como "informações referentes à data e hora de uso de uma
  determinada aplicação de internet a partir de um determinado endereço IP".
- **Exclusão de conta de quem é de uma família (pesquisado 2026-10-19, texto da LGPD na cópia oficial da Câmara;
  o site do Planalto recusou conexão):** antes a purga era RECUSADA pra sempre se a pessoa tinha vínculo de família,
  o que deixava o pedido de eliminação sem atender (Art. 18, VI; Art. 16 caput: eliminar após o término do
  tratamento). **Decisão do Gustavo (2026-10-19): a família guarda só os números.** Na purga
  (`FamiliaAoExcluirConta`), as despesas divididas que aconteceram ficam com valor, data, categoria padrão e a parte de
  cada um, e o dinheiro entre eles fica com o valor, tudo em nome de um "Membro que saiu" (usuário `Removido`, sem
  e-mail real nem senha, fora do admin); somem nome, e-mail, foto, descrição, conta, cartão, categoria própria, nota do
  acerto e a regra de renda dela. **Não é dado anonimizado** (Art. 5º III/XI, Art. 12): quem conhece a pessoa sabe
  quem era, então segue sendo dado pessoal mínimo. **Base:** interesse legítimo de TERCEIRO (Art. 7º, IX), os outros
  membros, cujo histórico financeiro próprio (o que pagaram, a parte deles, o equilíbrio dos meses passados) depende
  desses números; balanceamento (Art. 10): retenção mínima, sem identificação direta, só visível pra quem dividiu
  junto; minimização (Art. 6º, III). A pessoa é avisada antes de excluir (tela "Excluir a conta": transparência,
  Art. 6º VI e Art. 9º). Vínculos que AINDA travam a purga: relacionamento, empréstimo com contraparte, proposta de
  consolidação e conta compartilhada (fora deste passo). **Risco residual:** zona cinzenta parecida com a do
  empréstimo de terceiro; reavaliar com o público (RIPD se crescer).
- **Zona cinzenta sem resposta fechada:** o que acontece se a pessoa citada num empréstimo (sem
  conta) pedir exclusão dos dados dela guardados por outro usuário — nenhuma fonte primária cobre
  esse caso específico. Cataloga como P2 pro público, não bloqueia o beta (poucos testadores
  conhecidos, risco baixo).

**O que ficou pronto no código desta sessão (2026-08-18):** página `/privacidade`, checkbox real
de aceite (não pré-marcado) no cadastro, aviso de minimização no campo "pessoa" do empréstimo.
**O que falta pro público (não bloqueia o beta):** endpoint de exportar/apagar dado, política pra
pedido de exclusão de terceiro sem conta, reavaliação de porte se a receita/escala crescer.

