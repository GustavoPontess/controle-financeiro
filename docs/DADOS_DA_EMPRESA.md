# Dados da empresa: onde trocar

Mapa de todo lugar onde aparecem razão social, CNPJ, endereço e contato da empresa. Quando o CNPJ sair, é seguir a
lista de cima pra baixo. Lugar novo que mostrar dado da empresa entra aqui.

Hoje (2026-10-27) todos mostram os **mesmos dados de exemplo** (decisão do Gustavo), com um aviso de "dados fictícios":

| Dado | Exemplo de hoje |
|---|---|
| Razão social | Pontes Tecnologia Ltda. |
| CNPJ | 00.000.000/0001-00 |
| Endereço | Rua Exemplo, 123, Sala 4 · Centro · Cidade/UF · CEP 00000-000 |
| Contato | contato@pontes.exemplo · (00) 0000-0000 |
| Aviso | "Página modelo: dados fictícios." (site) / "E-mail modelo: dados fictícios." (e-mails) |

## Onde trocar

### 1. Rodapé de todos os e-mails
- Arquivo: `ControleFinanceiro.Api/Infrastructure/Email/DadosEmpresa.cs`, **linhas 15 a 20**.
- Cada linha de exemplo tem o comentário `// EXEMPLO: trocar ...`. A linha `Aviso:` (20) tem `// APAGAR`: trocar por
  `Aviso: null);`.
- Vale pros 5 e-mails de uma vez (pedido recebido, acesso liberado, senha nova, código, exclusão da conta).

### 2. Rodapé do site (todas as páginas públicas, Termos e Privacidade)
- O site vem do rascunho do hub. Trocar **lá**, nunca nas cópias daqui (`controle-financeiro.web/src/site/paginas/`).
- Arquivo: `E:\VSCode\pontes\PontesDev\clientes\pontes-financas\site\fonte\_base.html`, **linhas 71 a 74**
  (71 razão social e CNPJ, 72 endereço, 73 contato, 74 aviso: apagar a linha 74).
- Depois: rodar `fonte/montar.py` no hub (gera os 7 rascunhos: home, recursos, casa, contadores, planos, segurança,
  sobre) e aqui `controle-financeiro.web/scripts/importarSite.py` (copia pro app, inclusive o rodapé de Termos e
  Privacidade, `src/site/paginas/_rodape.html`).

### 3. Contato nos Termos de Uso e na Privacidade
- Arquivo: `controle-financeiro.web/src/telas/Legal.tsx`.
- **Linha 61** (Termos) e **linha 91** (Privacidade): trocar "fale com quem te convidou pro beta" pelo e-mail de contato.
- Na Privacidade, dizer quem é o controlador (razão social e CNPJ) e quem é o encarregado de dados, com contato (LGPD
  art. 41). Hoje não tem.
- Mudou o texto: atualizar a data, **linha 32** (Termos) e **linha 69** (Privacidade).
- Apagar o comentário TODO das linhas 4 e 5.

### 4. Remetentes dos e-mails
- Arquivo: `config/deploy.api.yml`, **linhas 65 a 67** (`SMTP_FROM`, `SMTP_FROM_SEGURANCA`, `SMTP_FROM_PRODUTO`) e o
  segredo `SMTP_REPLY_TO_PRODUTO` (linha 80).
- Só muda se o domínio mudar ou se `pontesdev.com.br` passar a receber e-mail (aí o contato pode ser dele).

### 5. Conformidade
- `docs/CONFORMIDADE_BR.md`: registrar o controlador e o encarregado de dados.

## Conferir que não sobrou exemplo

```bash
grep -rn "00.000.000\|Rua Exemplo\|pontes.exemplo\|dados fictícios" ControleFinanceiro.Api controle-financeiro.web/src --include=*.cs --include=*.tsx --include=*.html
```

Sem resultado = trocado em todo lugar.
