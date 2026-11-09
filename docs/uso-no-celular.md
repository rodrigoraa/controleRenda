# Controle pelo celular

A interface prioriza o uso diário no telefone e mantém a navegação pelo computador.

Na barra inferior:

- **Início:** sobra prevista, próximo mês e saldo disponível.
- **Lançamentos:** busca, filtros e cartões com os detalhes de cada movimentação.
- **Novo:** botão central sempre acessível para registrar receita ou despesa. Ao abrir pela página do cartão, o formulário já seleciona cartão de crédito.
- **Cartão:** compras por responsável, repasses da mãe e pagamentos da fatura.
- **Mais:** configurações, conta, backups, modo de exemplo e acesso às recorrências.

Nas listas, use o seletor de responsável para identificar uma compra. Toque em Pendente para confirmar uma movimentação, no lápis para editar e na lixeira para solicitar exclusão.

Os formulários se ajustam à área visível do navegador. Os campos mantêm tamanho de texto adequado para celular e os botões de salvar ficam acessíveis enquanto o restante do formulário rola. Os controles principais têm área de toque de pelo menos 44 pixels.

## Imagens de exemplo

Os valores abaixo são fictícios, do modo de exemplo.

- [Resumo no celular](imagens/celular-resumo.png)
- [Cartão compartilhado](imagens/celular-cartao.png)
- [Novo gasto](imagens/celular-novo-gasto.png)

## Atualizar a instalação com Cloudflare Tunnel

Na pasta da instalação:

```bash
cd /var/www/controleRenda
sh scripts/backup.sh
git pull --ff-only
docker compose -f compose.yaml -f compose.tunnel.yaml up -d --build
```

Recarregue a página no celular após a atualização.

## Verificação da alteração

- Suíte completa: 51 testes aprovados, incluindo 18 testes com PostgreSQL real.
- TypeScript e builds da interface e do servidor aprovados.
- Chromium automatizado: larguras de 320, 360, 390, 430, 768, 844 e 1280 pixels; a largura 844 foi testada em paisagem com 390 pixels de altura.
- Login verificado em 320, 390 e 1280 pixels.
- Fluxos de inclusão, edição, atribuição à mãe, navegação e recorrências executados em cada largura.
- Conferidos ausência de rolagem horizontal da página e controles principais com pelo menos 44 pixels nas telas móveis.
- Formulário também verificado com altura reduzida a 440 pixels, simulando a redução de área útil pelo teclado.
- Testes de navegador usaram API simulada e dados fictícios; testes do servidor usaram PostgreSQL separado. Não foram usados dados ou credenciais da instalação real.

A simulação de navegador não substitui o teste em aparelho físico; Safari/iOS não foi executado nesta conferência.
