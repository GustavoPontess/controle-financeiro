# Arquivos de exemplo pra Importar extrato

Valores de centavos e nomes inventados. Use numa conta de teste.

- `banco-latin1-entrada-saida.csv`: banco que exporta em Latin-1, com cabeçalho de banco em cima (agência, conta), linhas de saldo e entrada e saída em colunas separadas ("Crédito" e "Débito"). O app reconhece sozinho.
- `colunas-que-o-app-nao-reconhece.csv`: nomes de coluna que não dizem nada ("Dia", "Texto", "X", "Y"). O app pergunta qual coluna é o quê; da segunda vez, na mesma conta, já entra direto.
