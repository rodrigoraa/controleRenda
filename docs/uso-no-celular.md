# Controle pelo celular

A interface prioriza o uso diário no telefone e mantém a navegação pelo computador.

Na barra inferior:

- **Início:** saldo da conta hoje, saldo previsto no fim de cada mês e composição das previsões.
- **Lançamentos:** busca, filtros e cartões com os detalhes de cada movimentação.
- **Novo:** botão central sempre acessível para registrar receita ou despesa. Ao abrir pela página do cartão, o formulário já seleciona cartão de crédito.
- **Cartão:** compras por responsável, repasses da mãe e pagamentos da fatura.
- **Mais:** configurações, conta, backups, modo de exemplo e acesso às recorrências.

Nas listas, use o seletor de responsável para identificar uma compra. Toque em Pendente para confirmar uma movimentação, no lápis para editar e na lixeira para solicitar exclusão.

Em compras parceladas, o responsável escolhido no cadastro vale para todas as parcelas. Ao mudar o responsável pela lista ou pelo lápis, a alteração vale para todas as parcelas da mesma compra, inclusive as já cadastradas. Datas e valores continuam individuais; pagamentos da fatura e repasses registrados são preservados.

Se uma compra antiga aparece como **Minha mãe** em dezembro e **Eu** em janeiro, abra janeiro e selecione **Minha mãe** nessa parcela uma vez. O sistema corrige o responsável das demais parcelas dessa compra; não é necessário excluir ou cadastrar novamente.

Para corrigir uma data, toque no lápis, altere **Data prevista** ou **Data na fatura** e salve. Ao mudar o mês, o sistema abre o mês de destino. Se o lançamento já foi confirmado, você também pode corrigir a **Data do recebimento** ou **Data do pagamento**, que informa quando o dinheiro realmente entrou ou saiu.

A correção afeta somente o lançamento escolhido: as demais parcelas e as próximas ocorrências mensais mantêm as datas cadastradas. No cartão, pagamentos da fatura e repasses já registrados permanecem no mês original.

## Saldo de hoje e renda a partir do próximo mês

1. Confirme os recebimentos e pagamentos que já aconteceram. No cartão, registre o pagamento da fatura e os repasses recebidos.
2. Em **Início → Informar saldo de hoje**, digite o valor que aparece no seu banco. O sistema ajusta o ponto de partida considerando os movimentos confirmados; ele não registra esse valor como receita. Pendências continuam nas previsões.
3. Para cadastrar salário, bolsa ou outro pagamento mensal, toque em **Novo → Receita**, preencha o valor de um mês e selecione **Todo mês**. Ajuste o dia do recebimento e toque em **A partir do próximo mês**. Confira a primeira data mostrada e salve.
4. Veja o saldo previsto no fim de cada mês. O **resultado só desse mês** mostra quanto as entradas e saídas daquele mês acrescentam ou retiram. O **saldo final** inclui o dinheiro trazido dos meses anteriores. As rendas futuras só entram no saldo de hoje quando você confirma que recebeu.

Exemplo: R$ 380,03 na conta hoje, fatura de novembro de R$ 425,56 e renda de R$ 2.221 a partir de dezembro. Sem outras movimentações, novembro termina em −R$ 45,53; dezembro tem resultado de +R$ 2.221 e termina com saldo de R$ 2.175,47.

Se uma renda recorrente foi cadastrada em novembro, mas só deveria começar em dezembro, exclua **somente a ocorrência de novembro** pela lixeira e confirme. Dezembro e os meses seguintes continuam cadastrados; não crie outra renda mensal igual.

O campo **Saldo no início desse mês**, nas configurações, continua disponível para quem prefere controlar desde o começo do mês. Para informar o valor que está no banco agora, use **Informar saldo de hoje**.

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

- Suíte completa: 94 testes aprovados, incluindo 21 testes com PostgreSQL real.
- TypeScript e builds da interface e do servidor aprovados.
- Chromium automatizado: larguras de 320, 360, 390, 430, 768, 844 e 1280 pixels; a largura 844 foi testada em paisagem com 390 pixels de altura.
- Login verificado em 320, 390 e 1280 pixels.
- Fluxos de inclusão, edição, atribuição à mãe, navegação e recorrências executados em cada largura.
- Conferidos ausência de rolagem horizontal da página e controles principais com pelo menos 44 pixels nas telas móveis.
- Formulário também verificado com altura reduzida a 440 pixels, simulando a redução de área útil pelo teclado.
- Correção de datas verificada em 320, 390 e 1280 pixels: troca de mês, reabertura após salvar, data de recebimento, recorrências e parcelas.
- Saldo atual e renda iniciada no próximo mês verificados em 320, 390 e 1280 pixels, incluindo reabertura e comparação dos valores previstos. Formulários também conferidos com 440 pixels de altura.
- Compras em 10 parcelas verificadas em 320, 390 e 1280 pixels: responsável no cadastro, troca pela lista e pelo lápis, virada do ano, preservação de valores individuais e reabertura após salvar.
- Testes de navegador usaram API simulada e dados fictícios; testes do servidor usaram PostgreSQL separado. Não foram usados dados ou credenciais da instalação real.

A simulação de navegador não substitui o teste em aparelho físico; Safari/iOS não foi executado nesta conferência.
