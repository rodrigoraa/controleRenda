# Controle Renda

Sistema financeiro pessoal em português, com **login, PostgreSQL e instalação no seu servidor Linux**. Mostra quanto deve sobrar neste mês e no próximo, incluindo salário, bolsa, recebimentos mensais e cartão compartilhado com a mãe.

## Funcionalidades

- Receitas e despesas únicas ou mensais recorrentes.
- Compras parceladas, com valores exatos em centavos.
- Cartão com responsáveis: **eu**, **minha mãe** e **a identificar**.
- Fatura completa, parte de cada pessoa, repasses e pagamentos parciais.
- Saldo disponível separado das previsões; sobra acumulada para o mês seguinte e projeção de seis meses.
- Login privado, troca de senha, logout e revogação de sessões.
- Dados no PostgreSQL, acessíveis em diferentes aparelhos. Atualização ao voltar à aba ou a cada 30 segundos, quando não há formulário aberto.
- Proteção contra sobrescrever uma revisão mais nova em outro aparelho ou aba.
- Importação da versão local anterior e de backups JSON, com confirmação.
- Backup automático do PostgreSQL, scripts de backup/restauração e modo de exemplo separado dos dados reais.

## Instalar no servidor Linux

Requisitos: **Git, OpenSSL, Docker Engine e Docker Compose v2**. A instalação do Docker para cada distribuição está em [docs.docker.com/engine/install](https://docs.docker.com/engine/install/).

Aponte o DNS do domínio ou subdomínio para o IP do servidor. Para o HTTPS automático, deixe as portas **80 e 443** disponíveis para o Caddy.

```bash
git clone https://github.com/rodrigoraa/controleRenda.git
cd controleRenda
sh scripts/configure.sh
docker compose -f compose.yaml -f compose.https.yaml up -d --build
```

O configurador pede o domínio (por exemplo, `financas.seudominio.com`) e gera `.env` com duas senhas aleatórias independentes para o banco. Nenhuma senha é exibida. O arquivo é privado, ignorado pelo Git e preservado se o configurador for executado novamente.

O Caddy configura o certificado HTTPS automaticamente. O aplicativo aplica as migrações do banco ao iniciar.

Crie sua conta pelo terminal:

```bash
docker compose exec app npm run user:create
```

Informe nome, e-mail e senha de pelo menos 12 caracteres. A senha fica oculta. Abra **`https://SEU_DOMINIO`** e entre com essa conta. Não existe cadastro público.

Verifique a instalação:

```bash
docker compose -f compose.yaml -f compose.https.yaml ps
docker compose logs --tail=100 app
curl -f https://SEU_DOMINIO/api/health
```

A verificação de saúde deve responder `{"status":"ok"}`. O servidor Linux usa somente Docker para executar a aplicação; não precisa instalar Node.js no host.

### Se já existe Nginx, Traefik ou outro proxy

Use somente o compose principal, mantendo seu proxy atual:

```bash
docker compose up -d --build
```

A aplicação fica em `127.0.0.1:3000` (ajustável em `APP_PORT`). Configure o proxy para encaminhar seu domínio HTTPS para essa porta. `APP_ORIGIN` precisa ser exatamente a URL pública, sem barra final. O PostgreSQL não publica uma porta no host.

Exemplo do bloco `location` em um servidor HTTPS do Nginx:

```nginx
location / {
    client_max_body_size 6m;
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

A aplicação confia em um único salto de proxy e só está exposta na interface local e na rede interna do compose. O proxy deve substituir cabeçalhos de IP recebidos do cliente, como no exemplo. Preserve essa restrição ao mudar a instalação.

## Uso inicial

1. Em **Configurações e dados**, defina o mês, o cartão e o vencimento. Em **Início → Informar saldo de hoje**, informe o valor da conta.
2. Cadastre salário, bolsa e pagamento do sistema como **Receita → Todo mês**, conferindo a data do primeiro recebimento.
3. Cadastre contas e compras. No cartão, a data pertence ao mês da primeira fatura; informe o valor total para parcelar.
4. Identifique as compras da sua mãe e registre o Pix quando entrar. Registre o pagamento da fatura separadamente.
5. Consulte o saldo previsto e avance o mês para ver recorrências e parcelas.

Para usar o saldo que está na conta agora, confirme os movimentos já realizados antes de usar **Informar saldo de hoje**. Para uma renda que começa no próximo mês, crie uma receita com repetição **Todo mês** e toque em **A partir do próximo mês**. O saldo final previsto acumula os meses anteriores; o resultado de cada mês aparece separado. Veja o [guia de uso](docs/uso-no-celular.md).

Os dados da versão antiga podem ser trazidos com **Importar dados deste navegador**, quando existirem no mesmo endereço e navegador, ou com **Importar backup** usando um JSON exportado anteriormente. A importação substitui o orçamento da conta após confirmação; os dados locais antigos são preservados.

Cada conta criada tem seu próprio orçamento. Atribuir uma compra à mãe identifica o responsável financeiro; não dá acesso à conta nem compartilha o orçamento com outro login.

Também é possível cadastrar outras pessoas no campo de responsável e filtrar lançamentos por pessoa, situação e faixa de valor, com ordenação por maior/menor valor ou data. Na lixeira de uma compra parcelada, escolha excluir só a parcela ou a compra inteira. Veja o [guia de uso no celular](docs/uso-no-celular.md) para os passos e o tratamento dos repasses.

## Conta e senha

Troque a senha em **Configurações e dados → Minha conta**. A troca encerra as outras sessões. Sessões também expiram em 14 dias.

Se esquecer a senha, o administrador pode redefini-la no servidor:

```bash
docker compose exec app npm run user:reset-password
```

A redefinição pede e-mail e nova senha oculta e revoga todas as sessões. Recuperação por e-mail não é necessária para esta instalação privada e não está configurada.

## Backups

Existem dois tipos:

- **JSON pela interface:** exporta somente o orçamento da conta. Permite importar na mesma conta ou migrar seus dados.
- **PostgreSQL completo:** inclui contas, configurações e todos os orçamentos. É o backup usado para recuperar o servidor.

O serviço `backups` gera um dump consistente ao iniciar e a cada 24 horas, mantém aproximadamente 14 dias e tenta novamente após cinco minutos se falhar. Os arquivos ficam no volume Docker `backup_data`.

Para gerar uma cópia manual na pasta `backups/` do servidor:

```bash
sh scripts/backup.sh
```

Copie esses arquivos para um local privado fora do servidor. Os volumes locais não protegem contra perda do próprio servidor.

Para listar os backups automáticos e copiar um deles:

```bash
docker compose exec backups ls -lt /backups
mkdir -p backups
docker compose cp backups:/backups/NOME_DO_ARQUIVO.dump backups/
```

Para restaurar um dump:

```bash
sh scripts/restore-db.sh backups/NOME_DO_ARQUIVO.dump
```

O script pede a confirmação `RESTAURAR`, para a aplicação e os backups, restaura em uma transação e reinicia os serviços. Em caso de erro, a transação é revertida e a aplicação fica parada para conferência. Todas as sessões do backup são revogadas após a restauração.

Mantenha também uma cópia privada do `.env`. Não use `docker compose down -v` para atualizar: essa opção remove os volumes de dados.

## Atualizar

```bash
sh scripts/backup.sh
git pull --ff-only
docker compose -f compose.yaml -f compose.https.yaml up -d --build
```

Se usa um proxy existente, execute a última linha sem `-f compose.https.yaml`. Migrações são versionadas, verificadas por checksum e executadas sob bloqueio para evitar aplicação simultânea.

## Desenvolvimento e testes

Requer Node.js **22.12+** e PostgreSQL 16. Configure um banco de desenvolvimento e outro exclusivo de testes. Exemplos abaixo usam credenciais fictícias: substitua pelos dados dos seus bancos locais.

```bash
export DATABASE_URL='postgresql://usuario:senha@127.0.0.1:5432/controle_dev'
export APP_ORIGIN='http://localhost:5173'
export TEST_DATABASE_URL='postgresql://usuario:senha@127.0.0.1:5432/controle_test'
npm ci
npm run db:migrate
npm run build
npm run user:create
npm run dev
```

O Vite serve a interface na porta 5173 e encaminha `/api` para o backend na porta 3000. Não use `npm run preview` como servidor de produção: a instalação real usa `npm start` ou Docker, que atendem a API e o frontend no mesmo endereço.

```bash
npm test              # testes da interface, regras financeiras e API com PostgreSQL real
npm run test:unit     # somente os testes que não dependem de PostgreSQL
npm run test:server   # integração: exige TEST_DATABASE_URL
npm run build         # TypeScript + frontend + backend
```

Os testes de integração criam/removem apenas suas contas de teste, mas **TEST_DATABASE_URL deve apontar para um banco exclusivo de testes**. O GitHub Actions fornece PostgreSQL separado e executa a suíte completa e o build.

## Como as previsões funcionam

Todos os valores são inteiros em centavos. O saldo inicial é o valor no começo do mês inicial. O disponível considera somente movimentações confirmadas até hoje. O fechamento previsto considera entradas e saídas cadastradas até o fim de cada mês, inclusive pendências anteriores.

A compra no cartão compõe a fatura; o pagamento da fatura é a saída, sem descontar a compra novamente. O repasse da mãe entra separadamente, previsto no vencimento enquanto pendente e na data real quando registrado. Compras a identificar permanecem na fatura integral, sem gerar repasse fictício.

Novos gastos alteram as previsões. Mercado, combustível e outras despesas variáveis precisam ser cadastrados para entrar no cálculo. O fechamento positivo não garante saldo suficiente em todos os dias do mês.

## Estrutura

- `server/`: API, autenticação, repositório PostgreSQL, migrações e administração de contas.
- `src/Application.tsx`: sessão e acesso à aplicação.
- `src/App.tsx`: telas financeiras.
- `src/lib/finance.ts`: regras, calendário, parcelas e projeções.
- `src/lib/validation.ts`: validação compartilhada entre navegador e servidor.
- `src/lib/api.ts`: comunicação autenticada e controle de revisão.
- `src/lib/storage.ts`: compatibilidade para leitura/migração da versão local anterior.
- `scripts/`: configuração, backup e restauração.
- `tests/`: regras financeiras, interface e integração com PostgreSQL real.

As senhas são derivadas com scrypt; tokens de sessão são aleatórios e só seu hash fica no banco. Cookies usam HttpOnly, SameSite e Secure no domínio HTTPS. A API valida origem e dados, limita tentativas de login e isola cada orçamento pelo usuário autenticado. A conta do banco usada pela aplicação não é superusuária.

O registro dos testes executados e dos limites de verificação desta entrega está em [docs/validacao-servidor.md](docs/validacao-servidor.md).

## Uso no celular

Navegação inferior, inclusão rápida, lançamentos em cartões, controles maiores e formulários adaptados à área visível da tela. Veja o [guia e as imagens do celular](docs/uso-no-celular.md).
