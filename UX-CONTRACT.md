# UX Contract

## Product context

Aplicação pessoal de orçamento e cartão compartilhado; prioridade ao celular. Mercado Brasil, locale pt-BR, moeda BRL. Datas são ISO civis no domínio e dia/mês na apresentação, fuso do dispositivo para “hoje”. Tema claro; acessibilidade WCAG 2.2 AA. Fontes e rótulos com acentos completos.

## Business-context sources

| Escopo                            | Fonte                                             | Tipo                      |
| --------------------------------- | ------------------------------------------------- | ------------------------- |
| Saldo, faturas, repasses, pessoas | docs/uso-no-celular.md; src/lib/finance.ts        | Contrato de uso e domínio |
| Edição e exclusão                 | src/lib/entry-editing.ts; docs/uso-no-celular.md  | Domínio e contrato de uso |
| Sessão e isolamento de contas     | docs/correcao-sessao-2026-11-10.md; server/app.ts | API e auditoria           |
| Concorrência e modo exemplo       | docs/auditoria-logica-2026-11-09.md; src/App.tsx  | Auditoria e aplicação     |

## Visual contract

DESIGN.md explica o sistema; src/ui/theme.tsx é o dono dos tokens e UIProvider os adapta a CSS/Mantine. Rótulos, navegação e comportamentos iguais em todas as telas.

## Canonical UI Map

| Capability     | Canonical owner                    | Source of truth                                | Allowed variants                          | Verification                                    |
| -------------- | ---------------------------------- | ---------------------------------------------- | ----------------------------------------- | ----------------------------------------------- |
| Select/Listbox | Mantine NativeSelect               | DESIGN.md; src/ui/theme.tsx                    | native, platform-owned popup              | tests/mantine-lists.test.tsx; browser           |
| Date           | Mantine TextInput type=date        | src/components/Forms.tsx                       | native ISO date; platform-owned popup     | tests/date-editing-ui.test.tsx; browser         |
| Form           | src/ui/ValidatedForm.tsx           | UX-CONTRACT.md; existing schemas               | create/edit/auth                          | tests/mantine-forms.test.tsx; existing UI tests |
| Scrollbar      | src/styles.css                     | DESIGN.md                                      | global baseline; modal geometry exception | browser computed style                          |
| Toast          | App notice with Mantine Alert      | src/App.tsx                                    | success/error/info                        | tests/remote.test.tsx; browser                  |
| CRUD           | App handlers and BudgetPersistence | docs/uso-no-celular.md; src/lib/persistence.ts | occurrence/installment purchase           | domain/server/UI suites                         |

Não há seleção de múltiplas linhas; a ação de excluir compra tem escopo próprio e confirmação.

## Dataset navigation

Filtros ficam recolhidos até 650px sob “Filtros e ordenação”, com contador de critérios ativos; fechar mantém a seleção. Desktop mostra os controles abertos. 20 itens por página; busca local e filtros combináveis no mês selecionado; ordenação por valor ou data. Resetar/clamp paginação ao alterar filtros/dataset ou excluir. Filtros são temporários e ficam apenas na memória deste orçamento: exceção deliberada à persistência em URL, pois o orçamento é privado e a aplicação mantém navegação interna sem rotas públicas. “Limpar filtros” limpa imediatamente, com busca retornando foco ao controle. Busca por texto possui X acessível. Dataset vazio oferece cadastro; sem resultados oferece ajustar filtros. Há uma única tabela semântica; no celular cada registro se apresenta como cartão sem duplicar DOM/ações.

## Flow ledger

| Operação             | Pendente                                             | Sucesso                                                         | Falha                                                      | Fonte                  |
| -------------------- | ---------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------- |
| Criar/editar         | campo e rascunho preservados, sem sucesso antecipado | fechar só o formulário de origem; data editada abre mês destino | manter valores; erro acessível                             | App/saveEntry; domínio |
| Atribuir responsável | espera servidor                                      | parcela atual e grupo conforme contrato                         | preservar dados; aviso                                     | entry-editing.ts       |
| Excluir              | confirmação app-owned com objeto/escopo              | atualizar lista, clamp página                                   | manter confirmação para tentar; conflito a invalida        | DeleteEntryDialog; App |
| Confirmar/transferir | valor/data explícitos                                | atualizar saldo apenas após servidor                            | conflitos exigem reabrir confirmação atualizada            | App; API               |
| Cadastrar pessoa     | preservar rascunho de compra                         | selecionar pessoa, sem perder campos                            | manter nome e permitir tentar                              | PersonControls; App    |
| Importar             | validação e confirmação antes de substituir          | novo orçamento confirmado                                       | nenhum sucesso falso; descartar leitura após troca de modo | App; auditoria         |

## Navigation and responsive behavior

Início, Lançamentos, Cartão, Recorrências, Configurações. Sidebar desktop e barra inferior no telefone. Navegação de verdade expõe aria-current; nome da aba `{Página} · Controle Renda`, sem valores/PII. Estado do mês preservado enquanto usuário navega; novos filtros reiniciam por área conforme comportamento existente. O documento rola; tabelas só usam overflow próprio se necessário. Modais não excedem visualViewport e safe areas; ações continuam alcançáveis com teclado aberto.

## Overlays and feedback

Modal Mantine pelo adaptador compartilhado, foco inicial no controle de fechar (cancelamento seguro), trap, Escape e restauração ao gatilho. Confirmação de exclusão com verbos e escopos explícitos; não prometer Undo inexistente. Alertas com role=alert para erro e role=status para sucesso; erro crítico não some por tempo. Nenhum alert/confirm/prompt nativo. Rascunho fica apenas na memória enquanto formulário está aberto, sem armazenamento local privado adicional. Cancelar/Escape fecha sem salvar; ações ainda pendentes são protegidas pelo controle de origem.

## Async and resilience

Mutações financeiras pessimistas e revisionadas. Não adicionar autosave nem filas offline. Falha não limpa o formulário nem anuncia sucesso. Conflito atualiza estado e invalida diálogos dependentes; formulário de edição usa proteção de snapshot. Requisições e confirmações antigas não atravessam conta, modo de exemplo ou geração de login. Sessão é revalidada antes de encerrar uma tela válida; outra conta nunca substitui dados silenciosamente. Fonte: auditorias e API citadas acima.

## Validation

ValidatedForm usa noValidate, validade HTML e mensagens localizadas próprias, aria-invalid/describedby e foco no primeiro campo inválido. Regras financeiras (parseMoney/centavos/datas/referências) continuam autoritativas. Campos sem gravação automática, controles principais de pelo menos 44px. Valores monetários são strings localizadas convertidas para centavos; datas permanecem strings ISO. Senhas permitem gerenciadores, colagem e revelar/ocultar. Erros não expõem payloads internos nem credenciais.

## Verification

npm test (PostgreSQL separado), npm run typecheck, npm run build, lint de DESIGN.md e auditoria estática premium. Chromium 320/390/768/1280, teclado440px, navegação por teclado, seleção nativa aberta, estados vazio/erro/conflito/sessão. Os fluxos canônicos são os mesmos do guia e das suites existentes. Não alterar backend/esquema nesta migração visual.
