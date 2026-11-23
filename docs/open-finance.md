# Verificar cobertura do Open Finance

A integração bancária depende de um provedor que consulte os dados com autorização no banco. A avaliação inicial usa a Pluggy. Confira o plano e a instituição participante que recebe o consentimento antes de ativar conexões reais.

| Instituição     | Confirmar no provedor                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Nubank          | Conta pessoal, saldo e transações                                                                       |
| Banco do Brasil | Conta pessoal, saldo e transações                                                                       |
| Mercado Pago    | Cartão de crédito, compras e faturas. Cobertura da conta de pagamento não comprova cobertura do cartão. |

Use o [painel de desenvolvedor da Pluggy](https://dashboard.pluggy.ai/) para verificar quais conectores oficiais de Open Finance o plano oferece. Os conectores precisam funcionar por redirecionamento e consentimento no banco. A avaliação não deve usar conectores que peçam senha bancária ao provedor nem produtos de iniciação de pagamentos.

## Caminho pessoal pelo MeuPluggy

Segundo o [guia oficial do MeuPluggy](https://github.com/pluggyai/meu-pluggy#how-to-setup-your-developer-access-to-your-data), o caminho pessoal permite a um aplicativo de desenvolvimento consultar as conexões próprias vinculadas pelo MeuPluggy. O guia descreve atualização diária e acesso após o período de teste do painel. Confirme se essa opção ainda está disponível na sua conta antes de contratar um plano.

1. Abra o [MeuPluggy](https://meu.pluggy.ai/). Escolha **Nubank** como primeiro teste e autorize só o compartilhamento de dados no próprio banco. Confira se a conexão e o extrato aparecem no MeuPluggy.
2. No painel de desenvolvedor, habilite o conector **MeuPluggy** na lista de conectores da aplicação. Abra o **Demo** dessa aplicação e escolha **MeuPluggy** para vincular a conexão já autorizada. Repita a vinculação uma vez por instituição, conforme o guia.
3. No Banco do Brasil, confira se aparecem saldo e transações. No Mercado Pago, confira se aparecem as compras e faturas do **cartão de crédito**. Ver a conta digital sozinha não confirma a cobertura do cartão.

O `Client ID` e o `Client Secret` são chaves da aplicação, não autorizações bancárias. Ao vincular cada instituição no Demo, abra os detalhes da conexão e guarde seu **Item ID**, identificador da conexão criada pela Pluggy. Use os dados da mesma aplicação de desenvolvimento. Não envie o `Client Secret`, tokens, Item IDs ou capturas do painel pelo chat.

## Ativar no seu servidor

Com o código da integração instalado e o Controle Renda servido por HTTPS, ajuste o arquivo `.env` **no servidor** e mantenha suas permissões restritas (`chmod 600 .env`). Preencha só as instituições que foram vinculadas no Demo. O e-mail do titular é o do login do **Controle Renda** que pode consultar os dados.

```dotenv
BANK_SYNC_ENABLED=true
PLUGGY_OWNER_EMAIL='email-do-titular-no-controle-renda'
PLUGGY_CLIENT_ID='id-da-aplicacao-da-pluggy'
PLUGGY_CLIENT_SECRET='segredo-da-aplicacao-da-pluggy'
PLUGGY_NUBANK_ITEM_ID='item-id-do-nubank'
# PLUGGY_BB_ITEM_ID='item-id-do-banco-do-brasil'
# PLUGGY_MERCADO_PAGO_ITEM_ID='item-id-do-mercado-pago'
```

Com o banco já em execução, recrie somente o aplicativo. Quem usa `cloudflared` mantém o túnel existente.

```sh
docker compose -f compose.yaml up -d --build --no-deps app
```

Entre no Controle Renda com o e-mail configurado e abra **Bancos**. O servidor lê os dados disponíveis no MeuPluggy ao iniciar e a cada 15 minutos. O horário do último envio do banco, quando informado pelo provedor, aparece separadamente da hora em que o Controle Renda consultou. A consulta dos saldos, faturas e movimentações fica em memória. A tela apresenta o saldo das contas em reais, até 25 movimentações por conta dos últimos 30 dias e até três faturas por cartão, quando o banco disponibiliza esses dados.

Se o titular precisar renovar a autorização, faça isso no MeuPluggy. Para desligar a leitura no Controle Renda, defina `BANK_SYNC_ENABLED=false` e recrie o aplicativo. Para parar o compartilhamento com o provedor, revogue também o consentimento no MeuPluggy ou no banco.

## Consulta técnica do catálogo

Com as chaves de aplicação `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` já disponíveis como variáveis de ambiente no terminal seguro, execute na raiz do repositório, em uma máquina com Node.js 22.12+ e acesso HTTPS a `api.pluggy.ai`:

```sh
node scripts/check-open-finance-coverage.mjs
```

O comando autentica a aplicação e consulta somente o catálogo de conectores. Ele não cria conexões bancárias, não lê extratos e não imprime chaves. O campo `connectors` vazio significa que o catálogo não retornou uma opção oficial com o nome pesquisado. O campo `missing` lista produtos que o catálogo não anuncia para aquele conector. Mesmo que o cartão apareça no catálogo, confirme a disponibilidade de **faturas e compras** no plano e na conta do titular.

Essa consulta filtra conectores oficiais de cada banco. Ela não verifica a cobertura de contas vinculadas pelo conector pessoal **MeuPluggy**. Para esse caminho, confira o que cada conexão pessoal disponibiliza no painel após a autorização.

## Conciliação com o orçamento

Em **Bancos**, abra o cartão e escolha quem fez cada compra. Você pode marcar **Eu**, **Minha mãe**, **Outra pessoa** ou escolher alguém já cadastrado no orçamento. Use **A identificar** para limpar a marcação. A escolha fica guardada com um identificador derivado, sem salvar novamente a compra. O backup completo do PostgreSQL inclui essas marcações. Os saldos e as compras listados em Bancos continuam separados do orçamento e das previsões.

Referência técnica do catálogo e da autenticação: [SDK oficial da Pluggy](https://github.com/pluggyai/pluggy-node).
