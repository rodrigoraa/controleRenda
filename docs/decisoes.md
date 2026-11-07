# Histórico — primeira versão local

Esta decisão foi substituída pela arquitetura com PostgreSQL descrita em [servidor-linux.md](servidor-linux.md).

Aplicativo pessoal em português para receitas mensais (salário, bolsa e sistema vendido), despesas, parcelas, cartão compartilhado com a mãe e previsão acumulada de saldo. Datas e valores são configuráveis; nenhum dado financeiro real é pré-carregado.

React + TypeScript + Vite. Persistência local no navegador, sem conta ou servidor. Backups JSON exportáveis/importáveis com validação. Não sincroniza entre aparelhos. Um modo de demonstração isolado permite conhecer a interface sem misturar valores fictícios ao orçamento.

Valores inteiros em centavos. Saldo inicial corresponde ao começo do mês inicial. Compras no cartão pertencem explicitamente ao mês da fatura, não são debitadas duas vezes. A fatura inteira é uma saída e o repasse da mãe é entrada separada; valores previstos e recebidos são distintos. Faturas permitem pagamentos e repasses parciais. Compras sem responsável continuam na fatura integral, sem criar um repasse fictício.

Receitas e contas recorrentes geram ocorrências mensais, com dias ajustados ao último dia do mês. Edições e exclusões de uma ocorrência não alteram outros meses. É possível encerrar uma recorrência para os meses seguintes. Parcelas distribuem o total exato em centavos.

Desenvolvimento direto autorizado pelo usuário, com testes do motor financeiro, persistência e fluxos principais. Entrega no repositório informado, com instruções de execução e CI.
