# Correção de retorno indevido ao login — 10 de novembro de 2026

Foram reproduzidos dois cenários que levavam ao login com uma sessão válida:

- Uma resposta 401 de uma requisição antiga chegava depois de um novo login e disparava o encerramento global da tela, antes de verificar se o acesso atual ainda era válido.
- Uma página antiga, aberta antes da identificação de conta exigida na API, recebia 401 por não enviar esse campo, mesmo com cookie e sessão válidos.

## Correção

A tela verifica a sessão atual antes de encerrar um orçamento aberto. Se a conta continua sendo a mesma, mantém o acesso e o formulário. Se essa verificação falha por conexão ou erro temporário do servidor, preserva a tela para tentar novamente. Uma sessão realmente expirada ou a troca para outra conta continua exigindo login, com uma mensagem explicando o motivo.

Respostas de carregamentos e verificações antigos não substituem um login mais recente. A identificação de conta continua obrigatória nas leituras e gravações: uma página desatualizada recebe 428 e a orientação **Atualizar página**, sem encerrar a sessão nem permitir a operação. Uma conta diferente continua sendo recusada.

## Validação

- 173 testes aprovados: 143 de domínio/interface e 30 com PostgreSQL real.
- 13 novos testes de sessão, incluindo respostas atrasadas, novo login, duas contas, falhas de verificação e página desatualizada.
- TypeScript, Vite e build do servidor aprovados.
- Chromium em 320, 390 e 1280 pixels, com Fastify e PostgreSQL reais e falhas/respostas atrasadas controladas: rascunho preservado, erro temporário sem logout, resposta antiga após novo login ignorada, expiração real levando ao login e isolamento de outra conta.
- Dados fictícios em banco separado; nenhum acesso autenticado à instalação real foi usado para reproduzir os casos.

## Atualizar o servidor

```bash
cd /var/www/controleRenda
sh scripts/backup.sh
git pull --ff-only
docker compose -f compose.yaml -f compose.tunnel.yaml up -d --build
```

Depois, recarregue as abas abertas. Não é necessária uma nova migração de banco; a duração da sessão permanece em 14 dias.
