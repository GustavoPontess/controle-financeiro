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
- **Zona cinzenta sem resposta fechada:** o que acontece se a pessoa citada num empréstimo (sem
  conta) pedir exclusão dos dados dela guardados por outro usuário — nenhuma fonte primária cobre
  esse caso específico. Cataloga como P2 pro público, não bloqueia o beta (poucos testadores
  conhecidos, risco baixo).

**O que ficou pronto no código desta sessão (2026-08-18):** página `/privacidade`, checkbox real
de aceite (não pré-marcado) no cadastro, aviso de minimização no campo "pessoa" do empréstimo.
**O que falta pro público (não bloqueia o beta):** endpoint de exportar/apagar dado, política pra
pedido de exclusão de terceiro sem conta, reavaliação de porte se a receita/escala crescer.
