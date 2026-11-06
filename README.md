# Controle Renda

Um controle financeiro pessoal em português, feito para responder **quanto deve sobrar neste mês e no próximo**.

## O que funciona

- Receitas mensais recorrentes: salário, bolsa da faculdade e pagamentos de um sistema vendido, ou qualquer outra fonte.
- Despesas únicas e recorrentes, categorias, busca e filtros.
- Compras no cartão com responsável: **eu**, **minha mãe** ou **a identificar**.
- Compras parceladas, com distribuição exata dos centavos entre os meses.
- Fatura completa, parte de cada pessoa, pagamentos e repasses parciais, com histórico e opção de desfazer.
- Saldo disponível baseado em movimentações confirmadas, separado do saldo previsto.
- Previsão acumulada para o mês atual, o próximo e gráfico dos seis meses seguintes.
- Edição/exclusão por ocorrência, preservando outros meses. Encerramento de recorrências para os meses seguintes.
- Salvamento local, exportação/importação de backups JSON validados e atualização entre abas.
- Exemplo interativo isolado dos dados reais e interface adaptada para celular.

## Executar

Requer **Node.js 22.12 ou superior** e npm.

```bash
git clone https://github.com/rodrigoraa/controleRenda.git
cd controleRenda
npm ci
npm run dev
```

Abra o endereço mostrado no terminal (normalmente `http://localhost:5173`).

```bash
npm test            # testes financeiros, persistência e fluxos da interface
npm run build      # valida TypeScript e gera dist/
npm run preview    # serve o build localmente
```

O GitHub Actions executa os testes e o build em pushes e pull requests. O sistema pode ser hospedado como aplicação estática em um serviço que sirva o conteúdo de `dist/`. Nenhum serviço externo ou segredo é necessário para executar esta versão.

## Começar a usar

1. Clique em **Configurar meu saldo**. Informe o mês inicial, o saldo que você tinha no começo desse mês e o vencimento do cartão.
2. Cadastre as três rendas como **Receita → Todo mês**. Os valores ficam previstos até você confirmar cada recebimento.
3. Adicione as contas e compras. Para cartão, escolha o responsável e uma data dentro do **mês da primeira fatura**. Em compras parceladas, informe o valor total e o número de parcelas.
4. Em **Cartão compartilhado**, confira as compras a identificar. Registre o Pix da sua mãe quando entrar e o pagamento da fatura quando acontecer. Um não confirma o outro automaticamente.
5. Confira a sobra prevista e avance o mês. As recorrências e parcelas já aparecem no mês seguinte.

Você pode explorar valores fictícios pelo botão **Explorar exemplo**, ou por **Configurações e dados → Abrir exemplo**. Alterações no exemplo não são gravadas no seu orçamento.

## Como as contas são feitas

Todos os valores são inteiros em centavos.

**Disponível hoje** = saldo inicial + entradas confirmadas até hoje − saídas confirmadas até hoje.

**Sobra prevista** = saldo inicial + entradas cadastradas até o fim do mês − saídas cadastradas até o fim do mês. As pendências de meses anteriores continuam no cálculo. A sobra do próximo mês inclui o saldo previsto do mês anterior.

A compra no cartão compõe a fatura. A saída de dinheiro é o pagamento integral da fatura, dividido entre pagamentos confirmados e o restante previsto; a compra não é descontada uma segunda vez. O repasse da mãe entra separadamente. Compras sem responsável continuam sendo consideradas na fatura inteira, sem criar um repasse fictício.

O repasse ainda pendente é previsto para o vencimento da fatura. Repasses já registrados usam a data real informada. A entrada da mãe aparece no fluxo de caixa, sem ser apresentada como uma das suas fontes de renda.

As previsões dependem dos lançamentos cadastrados: não estimam automaticamente mercado, combustível ou outros gastos variáveis. Cadastre esses valores como despesas previstas para incluí-los. O gráfico mostra o fechamento mensal, não uma garantia de saldo positivo em todos os dias.

Dias recorrentes como 31 são ajustados ao último dia dos meses menores. Para alterar uma recorrência permanentemente, encerre a antiga e cadastre uma nova a partir do mês desejado. Editar uma ocorrência altera somente aquele mês.

## Dados e limites desta versão

Os dados ficam no `localStorage` **deste navegador e endereço**. Não há conta, banco remoto, sincronização entre aparelhos, conexão bancária ou acesso compartilhado com outro usuário. O responsável pelas compras é definido por você.

Exporte backups regularmente em **Configurações e dados**. Limpar os dados do navegador, usar navegação privada ou mudar de endereço de hospedagem pode deixar o orçamento indisponível. O backup contém informações financeiras: guarde o arquivo em um local privado. A importação valida o arquivo e pede confirmação antes de substituir os dados atuais.

Nenhum orçamento ou backup financeiro é enviado ao GitHub. Apenas o código e os dados fictícios do modo de exemplo fazem parte do repositório.

## Estrutura

- `src/lib/finance.ts`: calendário, parcelas, fatura e projeções.
- `src/lib/storage.ts`: validação dos dados e persistência local.
- `src/lib/demo.ts`: orçamento fictício isolado.
- `src/components/`: formulários e janela acessível.
- `src/App.tsx`: telas e fluxos do aplicativo.
- `tests/`: testes de comportamento com Vitest e Testing Library.
