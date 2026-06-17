---
owner: Gustavo
last_reviewed: 2026-06-16
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
- 🔶 **Aberto** (re-pesquisar antes do lançamento): obrigações concretas de **LGPD** (RIPD/DPIA, endpoints de direito do titular, DPO), e a pergunta-chave **BACEN/Open Finance se aplica a agregador de finanças pessoais que não movimenta dinheiro?**
