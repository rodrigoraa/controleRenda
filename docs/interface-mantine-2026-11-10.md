# Interface Mantine — 10 de novembro de 2026

A revisão usa o plugin Frontend Design e Mantine 9.8 para oferecer uma interface consistente no computador e no telefone. O verde do produto foi preservado; os componentes e a organização das informações foram refeitos.

## O que mudou

- **Dinheiro de hoje primeiro:** saldo confirmado com ação para informar o valor da conta. Previsões do mês selecionado e do próximo mês identificadas por texto.
- **Composição visível:** saldo trazido + entradas − saídas = saldo final previsto. Resultado mensal separado do saldo acumulado.
- **Lançamentos legíveis:** uma tabela semântica se apresenta como cartões no telefone; moeda e centavos ficam juntos. Descrições longas podem ocupar mais linhas.
- **Filtros acessíveis:** no telefone, “Filtros e ordenação” abre os controles e informa os critérios ativos. Recolher mantém a seleção. No computador os controles ficam abertos.
- **Listas com paginação:** até 20 registros por página, posição informada, retorno à primeira página ao mudar busca/filtros/mês e recuperação após exclusão.
- **Formulários padronizados:** campos Mantine, validação em português associada aos campos, foco no primeiro erro e rascunho preservado ao falhar o salvamento.
- **Janelas no celular:** conteúdo rola na área visível; rodapé mantém salvar/cancelar acessíveis. Foco contido na janela e devolvido ao gatilho ao fechar.
- **Conta e login:** campos de senha com revelar/ocultar acessível por teclado, suporte a gerenciadores e botões com tamanho estável durante o envio.
- **Base compartilhada:** tema Mantine, fontes locais, contraste revisado, foco visível, movimento reduzido e títulos da aba sem dados privados.

As regras de saldo, parcelas, faturas, responsáveis, repasses, autenticação e persistência foram preservadas. A migração não exige mudança de banco de dados.

## Arquivos de referência

- [Sistema visual](../DESIGN.md): direção visual, fontes e cores.
- [Contrato de interação](../UX-CONTRACT.md): controles canônicos, fluxos, acessibilidade e recuperação de falhas.
- [Tema em execução](../src/ui/theme.tsx): fonte dos tokens e provedor Mantine.
- [Guia no celular](uso-no-celular.md): uso diário e atualização da instalação.

## Verificação

A conferência usa dados fictícios e PostgreSQL separado da instalação real. As telas foram inspecionadas em Chromium; não houve acesso a senhas ou dados de produção.

- Testes de regras financeiras, interface, sessão e integração com PostgreSQL.
- TypeScript e builds da interface/servidor.
- Lint de DESIGN.md e auditoria estática premium em modo estrito.
- Navegador em 320, 390, 768 e 1280 pixels: resumo, busca, filtros, cartão, recorrências, configurações, inclusão, atribuição de pessoa e exclusão de dez parcelas.
- Área visível reduzida a 440 pixels: formulário e confirmação de exclusão com ações alcançáveis.
- Saldos positivos e negativos longos em 320, 390, 768, 1024 e 1280 pixels, sem quebrar centavos no resumo.
- Login real, salvamento/reabertura pelo servidor, falha 503 com rascunho preservado e nova tentativa confirmada no PostgreSQL.
- Recuperação de sessão, resposta atrasada após novo login, falha temporária e isolamento de outra conta.
- Teclado, retorno de foco, revelar senha, validação em português e axe-core nos estados de tela conferidos.

A suíte completa passou com **179 testes**: 149 de regras/interface e 30 com PostgreSQL real. O build passou; o lint de DESIGN.md e a auditoria premium terminaram sem erros ou avisos. Axe-core não encontrou violações nas 20 combinações de resumo, lançamentos, formulário, cartão e configurações em quatro larguras. A versão compilada para produção também foi aberta no navegador. O navegador automatizado não substitui a conferência em aparelhos físicos; Safari/iOS não foi executado.
