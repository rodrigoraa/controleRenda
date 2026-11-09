# Filtros de lançamentos e pessoas adicionais

Objetivo: combinar situação, responsável e faixa de valor, ordenar por valor ou data e cadastrar pessoas além de Eu/Minha mãe. Entregar também a exclusão da compra parcelada inteira solicitada antes.

Decisões: filtros afetam a lista do mês selecionado, incluindo ocorrências e parcelas. No crédito, a situação acompanha o pagamento integral da fatura (pagamento parcial mantém compras pendentes). Pessoas adicionais identificam compras; os repasses automáticos continuam limitados à mãe, conforme o acordo financeiro já existente. Valores recebidos de outras pessoas podem ser registrados como receita. A fatura continua contemplando todas as compras; gastos pessoais incluem Eu/A identificar. Novos nomes serão persistidos por orçamento, sem conceder acesso a terceiros.

Arquitetura: manter reservas me/mother/unknown e acrescentar IDs person_* com cadastro opcional no estado, tabela budget_people no PostgreSQL e validação de referências. Backups antigos continuam válidos. Mudanças de responsável continuam valendo para o grupo de parcelas. Migração nova e automática, sem alterar o SQL já aplicado.

1. [x] Finalizar exclusão: testes de domínio/interface/servidor e build, commit independente.
2. [x] Escrever e executar testes que falhem para filtros combinados, ordenação numérica, intervalos inválidos e pagamento do cartão.
3. [x] Implementar seletor puro em src/lib/transaction-filters.ts e controles responsivos; manter busca e filtros rápidos.
4. [x] Escrever testes que falhem para cadastro de pessoa, rejeição de IDs/nome inválidos e persistência de parcelas e overrides com novos responsáveis.
5. [x] Implementar tipos, validação, helpers de pessoas, migração e repositório; depois campos de cadastro e seleção no formulário/lista e filtro.
6. [x] Mostrar partes das outras pessoas sem atribuí-las ao usuário; documentar identificação e como registrar recebimentos.
7. [x] Executar suíte completa com PostgreSQL, build, revisão independente e Chromium em 320/390/1280 pixels (incluindo exclusão em grupo).
8. [x] Atualizar guia de uso e enviar ao GitHub; orientar atualização do servidor.


Verificação: 102 testes unitários/interface e 23 testes com PostgreSQL real aprovados; TypeScript, Vite e tsup aprovados. Exclusão começou com 10 falhas de interface/domínio; novos filtros/pessoas com 10 falhas de comportamento, 3 de interface e 1 de persistência, corrigidas antes da suíte final. Chromium com API simulada: fluxo combinado aprovado em 320/390/1280 pixels, incluindo reabertura, cancelamento e exclusão completa; formulário de exclusão com 440 pixels de altura. Dados fictícios e banco descartável, sem acesso à instalação do usuário.

Revisão independente sem achados financeiros ou de isolamento. A revisão apontou nomes longos: o teste de contenção do valor no cartão falhou antes do ajuste e passou após permitir quebra do nome sem comprimir o valor. Suíte completa novamente aprovada. Migração 001 preservada; a 002 é aplicada automaticamente pelo servidor.
