# Dados da empresa: onde trocar

Mapa de todo lugar onde aparecem razão social, CNPJ, endereço e contato da empresa. Quando o CNPJ sair, é seguir a
lista de cima pra baixo. Lugar novo que mostrar dado da empresa entra aqui.

Hoje (2026-10-27) todos mostram os **mesmos dados de exemplo** (decisão do Gustavo), com um aviso de "dados fictícios":

| Dado | Exemplo de hoje |
|---|---|
| Razão social | Pontes Tecnologia Ltda. |
| CNPJ | 00.000.000/0001-00 |
| Endereço | Rua Exemplo, 123, Sala 4 · Centro · Cidade/UF · CEP 00000-000 |
| Contato | contato@pontesdev.com.br (real desde 2026-11-02; telefone quando tiver) |
| Aviso | "Página modelo: dados fictícios." (site) / "E-mail modelo: dados fictícios." (e-mails) |

## Onde trocar

### 1. Rodapé de todos os e-mails
- Arquivo: `ControleFinanceiro.Api/Infrastructure/Email/DadosEmpresa.cs`, **linhas 15 a 20**.
- Cada linha de exemplo tem o comentário `// EXEMPLO: trocar ...`. A linha `Aviso:` (20) tem `// APAGAR`: trocar por
  `Aviso: null);`.
- Vale pros 5 e-mails de uma vez (pedido recebido, acesso liberado, senha nova, código, exclusão da conta).

### 2. Rodapé do site (todas as páginas públicas, Termos e Privacidade)
- O site vem do rascunho do hub. Trocar **lá**, nunca nas cópias daqui (`controle-financeiro.web/src/site/paginas/`).
- Arquivo: `docs/design-home/site/fonte/_base.html`, **linhas 71 a 74**
  (71 razão social e CNPJ, 72 endereço, 73 contato, 74 aviso: apagar a linha 74).
- Depois: rodar `fonte/montar.py` no hub (gera os 7 rascunhos: home, recursos, casa, contadores, planos, segurança,
  sobre) e aqui `controle-financeiro.web/scripts/importarSite.py` (copia pro app, inclusive o rodapé de Termos e
  Privacidade, `src/site/paginas/_rodape.html`).

### 3. Contato nos Termos de Uso e na Privacidade
- Arquivo: `controle-financeiro.web/src/telas/Legal.tsx`, constantes `CONTROLADOR`, `PRIVACIDADE` e `CONTATO` no topo
  (um lugar só; as duas páginas e a seção da transferência internacional leem dali).
- **2026-11-02:** a Privacidade usa `privacidade@` (canal LGPD) e os Termos `contato@`. Nunca `pontes@` (login do admin).
- **Feito 2026-10-31:** o contato virou o e-mail (`CONTATO`) e o controlador é Gustavo Pontes, pessoa física; sem
  encarregado (agente de pequeno porte, Resolução CD/ANPD nº 2/2022), o e-mail é o canal.
- **Quando sair o CNPJ:** trocar `CONTROLADOR` pela razão social e CNPJ, tirar o "pessoa física, enquanto o Pontes não
  tem empresa aberta" e atualizar as datas das duas páginas (`atualizado=`).

### 4. Remetentes dos e-mails
- Arquivo: `config/deploy.api.yml` (`SMTP_FROM`, `SMTP_FROM_SEGURANCA`, `SMTP_FROM_PRODUTO`). Sem Reply-To desde
  2026-11-02: o domínio recebe pelo Email Routing da Cloudflare (repassa pro Gmail da PontesDev; mapa em `E:\VSCode\pontes\servidor\README.md`).
- Endereço novo que precise receber = regra nova no Email Routing da Cloudflare (pelo chat do servidor).

### 5. Conformidade
- `docs/CONFORMIDADE_BR.md`: registrar o controlador e o encarregado de dados.

## Conferir que não sobrou exemplo

```bash
grep -rn "00.000.000\|Rua Exemplo\|pontes.exemplo\|dados fictícios" ControleFinanceiro.Api controle-financeiro.web/src --include=*.cs --include=*.tsx --include=*.html
```

Sem resultado = trocado em todo lugar.
