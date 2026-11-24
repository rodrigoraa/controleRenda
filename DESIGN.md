---
version: alpha
name: Controle Renda
description: Um caderno financeiro digital para entender o dinheiro de hoje e planejar os próximos meses.
colors:
  primary: "#176451"
  ink: "#152e2b"
  background: "#f4f7f8"
  surface: "#ffffff"
  muted: "#5f706c"
  border: "#dde6e2"
  danger: "#b43d3d"
  success: "#176451"
typography:
  sans:
    fontFamily: "DM Sans Variable, system-ui, sans-serif"
  display:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
rounded:
  DEFAULT: "0.75rem"
  sm: "0.5rem"
  lg: "1.25rem"
spacing:
  section-gap: "1.5rem"
  desktop-gutter: "clamp(24px, 2.25vw, 48px)"
components:
  button:
    height: "44px"
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
  input:
    height: "44px"
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  card:
    rounded: "{rounded.lg}"
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  dialog:
    rounded: "{rounded.lg}"
  helper:
    textColor: "{colors.muted}"
  divider:
    backgroundColor: "{colors.border}"
  error:
    textColor: "{colors.danger}"
  success:
    textColor: "{colors.success}"
---

# Controle Renda — sistema visual

## Overview

Aplicação pessoal em português brasileiro para Rodrigo acompanhar rendas, gastos e cartão compartilhado principalmente no celular. A referência é um caderno de contas bem organizado: os valores e suas relações conduzem a página. A tela inicial organiza o saldo de hoje, a previsão e a movimentação do mês em blocos com rótulos explícitos. O saldo confirmado é visualmente diferente das previsões.

Registro de produto, não página de publicidade. Preservar o verde floresta já associado ao sistema; substituir a densidade de textos pequenos por hierarquia e respiro. Não usar hero promocional, ilustrações financeiras decorativas ou um mosaico de indicadores sem explicação.

Escopo Brasil/pt-BR, BRL, calendário gregoriano, datas civis locais. Não há escopo de mercado japonês. Identidades de pessoas e dados de orçamento são privados; não persistir filtros nem rascunhos financeiros em armazenamento compartilhado entre contas.

Fonte canônica dos valores: `src/ui/theme.tsx` (`uiTokens` e tema Mantine). Este documento espelha os valores; `UIProvider` adapta o tema a variáveis `--cr-*` consumidas por CSS e componentes. Cores semânticas não são duplicadas em temas locais.

## Colors

Verde identifica ações principais e valores positivos. O tema claro usa superfícies brancas sobre fundo frio suave. No tema escuro, `darkTokens` mapeia fundo (`#101a18`), superfície (`#192622`), texto (`#e4efeb`), texto secundário (`#a8bcb4`), borda (`#344840`), destaque (`#92d7b9`) e erro (`#ffa49b`). Ações sólidas mantêm o verde marca `#176451` com texto branco. Vermelho acompanha texto ou ícone de saída negativa, erro ou ação destrutiva. Valores previstos recebem identificação textual e ficam distintos do dinheiro confirmado. O tema claro é o padrão, com alternância manual e preferência guardada no navegador.

## Typography

DM Sans Variable para texto e controles; Manrope Variable para títulos e valores. Fontes locais via Fontsource, sem dependência de requisição de fontes externas. Texto corrente 16px/1.5; rótulos e ajuda 13–14px; metadados secundários 10–12px com contraste adequado. Números com tabular-nums, BRL e centavos preservados. Valores essenciais não são truncados. Títulos em sentence case; nenhum rótulo inglês pertencente ao produto.

## Layout

Sidebar desktop de 232px, conteúdo fluido no espaço disponível. Abaixo de 900px, navegação inferior de cinco ações e atalhos; o documento é dono da rolagem. Conteúdo com 16px de respiro no telefone e de 24px a 48px no desktop. Na Visão Geral, a ordem é cartões e contas, filtro com projeção por mês, resumo do mês atual e previsão do próximo mês. Os cards identificam o tipo e o significado de cada valor. O card manual usa o nome definido em Configurações e dados. Quando um banco apresenta uma conta corrente e um cartão de crédito, o saldo e a fatura dividem o card, com seus próprios rótulos. O resumo do mês atual usa a data de hoje e indica a origem dos dados. O seletor de mês fica no topo após alcançar sua posição na rolagem. A previsão mostra o mês seguinte ao selecionado. Planejar reúne a linha do tempo e a projeção do saldo acumulado. Bancos mostra informações do provedor e a data de atualização em uma área própria. Listas do orçamento têm paginação local de 20 itens e uma representação semântica única que se reorganiza em cartões no telefone.

## Elevation & Depth

Hierarquia por espaço, bordas e contraste tonal. Sombras leves apenas em controles flutuantes/diálogos e navegação fixa. Evitar sombras em todas as células e fundos animados. Scrollbars globais visíveis, com trilho e polegar sem depender de classe opt-in.

## Shapes

Controles com raio de 0.75rem no tema; adaptadores de 10px e painéis de 13–16px conservam a densidade das listas. Diálogos de 1.25rem. Ícones Lucide de traço, normalmente 18–22px. Alvos principais com mínimo de 44px. Sem adornos que simulem cartões bancários oficiais ou afiliação a bancos.

## Components

Mantine é a base compartilhada de botões, campos, seleção nativa, badges, tabela, paginação, alerts e modais. Mantine NativeSelect conserva a interação do sistema operacional; datas usam TextInput type=date, aceitando calendário e geometria do navegador. Não implementar um segundo dropdown/calendário por tela.

`src/components/Modal.tsx` é o único adaptador de diálogo. `src/ui/ValidatedForm.tsx` centraliza validação localizada e foco; a validação financeira existente continua usando centavos e esquemas do domínio. Campos mantêm 16px no telefone. Botões com ícone mantêm nome acessível; perigosos são identificados pelo verbo, objeto e escopo. Alertas de erro persistem enquanto necessários; sucesso é anunciado após confirmação do servidor.

Hover discreto, foco com anel contrastante, desabilitado sem ação. Respeitar reduced-motion; transições curtas de feedback, sem animação de valores financeiros. Quebra de nomes longos e espaço reservado aos valores. Títulos de documento acompanham a página atual.

## Do's and Don'ts

- Mostrar primeiro o que o usuário reconhece: dinheiro disponível hoje, depois previsão.
- Explicar “de quem é a compra” e “quem pagou a fatura” como fatos distintos.
- Reutilizar os controles Mantine e os contratos de recuperação da aplicação.
- Não trocar a lógica financeira, autenticação ou regras de parcelas para acomodar um visual.
- Não expor valores privados em URL, título da aba ou notificações fora do aplicativo.
