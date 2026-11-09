# Saldo atual e rendas mensais — plano

> Execução nesta sessão, com testes antes das correções e revisão independente ao final.

**Objetivo:** permitir informar o dinheiro que há na conta hoje e cadastrar renda mensal a partir do próximo mês, sem confundir a movimentação mensal com o saldo acumulado.

**Arquitetura:** manter o modelo financeiro e o armazenamento atuais. Calibrar o saldo inicial pela diferença entre o saldo informado e o disponível calculado, sem registrar receita artificial. Expor a composição mensal das projeções e explicitar o início das recorrências.

**Escopo:** pedido do usuário e captura de novembro/2026. Saldo real, previsões e receitas mensais são informações distintas. Pendências continuam previstas até confirmação, correção ou exclusão explícita.

**Tecnologias:** React, TypeScript, Fastify, PostgreSQL; sem novas dependências ou migrações.

## Restrições e revisão

- Preservar lançamentos, confirmações, pagamentos e repasses existentes.
- Saldo negativo e zero são válidos; valores inválidos devem ser recusados.
- Um pagamento confirmado não pode ser contado novamente ao informar o saldo atual.
- Receita iniciada em dezembro não pode entrar em novembro ou no saldo real antes da confirmação.
- O saldo de dezembro inclui novembro; o resultado de dezembro deve aparecer separado.
- Falha do servidor e concorrência não podem anunciar sucesso ou apagar dados.
- Manter formulários utilizáveis em 320 pixels e com teclado aberto.

## Tarefa 1 — cálculo e ajuste de saldo

- [x] Escrever testes com saldo de R$ 380,03, entrada de R$ 2.221 apenas a partir de dezembro e fatura de R$ 425,56; novembro -R$ 45,53, dezembro R$ 2.175,47.
- [x] Testar ajuste com receitas, despesas, fatura e repasse confirmados, saldo negativo/zero, rejeição de valor inválido e preservação do histórico.
- [x] Executar os testes e observar as falhas antes de implementar.
- [x] Implementar `withCurrentBalance(state, amount, today): State` em `src/lib/finance.ts`, validando limites; ampliar `Summary` com saldo de início, entradas/saídas de caixa e resultado mensal.
- [x] Verificar testes unitários e persistência real em PostgreSQL.

## Tarefa 2 — fluxo na interface

- [x] Escrever teste de usuário: informar saldo atual, criar receita mensal com atalho próximo mês, reabrir orçamento e conferir meses e saldo real.
- [x] Observar falha, implementar formulário de saldo e atalho da recorrência em `Forms.tsx`, integração e explicações em `App.tsx`, estilos responsivos.
- [x] Exibir saldo de hoje primeiro; projeções com rótulo de saldo acumulado e resultado mensal; composição mensal conferível.
- [x] Testar recusa do servidor e pendências mantidas nas previsões.
- [x] Atualizar documentação de uso; executar suíte completa, build e navegador em 320, 390 e 1280 pixels.
- [x] Revisar diff, corrigir achados financeiros com testes, enviar ao GitHub e orientar atualização do servidor.

## Evidências

- Testes de regressão: 10 falhas reproduzidas antes da implementação; depois aprovados.
- Suíte final: 61 testes unitários/interface e 20 com PostgreSQL real aprovados; TypeScript, Vite e tsup aprovados.
- Chromium automatizado: fluxo de ajuste, renda com início no próximo mês, valores previstos e reabertura aprovados em 320, 390 e 1280 pixels, sem erros de página ou transbordamento horizontal. Formulários conferidos também com altura de 440 pixels.
- Revisão independente: cálculo, preservação de movimentos e concorrência sem achados financeiros. Controle explícito de saldo negativo acrescentado após teste que falhou, para dispensar a tecla de menos no teclado móvel; suíte final aprovada.
- Dados usados na verificação são fictícios; nenhuma alteração foi aplicada à instalação do usuário.
