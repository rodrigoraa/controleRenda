# Auditoria da lógica — 9 de novembro de 2026

Revisão do sistema a partir da versão `d9e0091`, com testes e correções no código. Foram usados dados fictícios e PostgreSQL separado; a instalação real não foi acessada.

## Problemas confirmados e corrigidos

1. **Troca de conta entre abas.** Uma aba antiga podia enviar o orçamento da conta anterior usando o cookie da conta atual. Se as revisões coincidissem, a gravação era aceita. Leituras, gravações, troca de senha e logout agora ficam vinculados à conta exibida. Se a sessão mudou, a operação é recusada e a aba retorna ao login.
2. **Edição antiga sobrescrevendo dados novos.** A proteção anterior verificava data e responsável, mas deixava passar mudanças concorrentes de valor, descrição ou categoria. A edição agora detecta também esses campos e exige reabrir o item atualizado.
3. **Confirmações desatualizadas.** Uma confirmação podia mostrar R$ 100 e, depois de uma atualização de outra aba ou de um salvamento lento na mesma aba, confirmar R$ 200 ou substituir uma data já confirmada. Confirmações financeiras e configurações baseadas na revisão anterior são fechadas depois da atualização, inclusive se a recarga for lenta. Novos rascunhos de lançamento são preservados.
4. **Salvamento antigo fechando outro formulário.** Fechar um formulário enquanto ele salvava e abrir outro podia perder o novo rascunho quando o primeiro terminava. O resultado de cada operação agora fecha somente a janela que a iniciou.
5. **Operações pendentes atravessando o modo de exemplo.** Um arquivo de backup que terminasse de ser lido após uma troca de modo podia abrir uma confirmação antiga. A leitura é descartada quando o modo muda, e a troca de modo aguarda salvamentos em andamento.

## Áreas conferidas

| Área | Conferência |
| --- | --- |
| Saldo e previsão | Saldo atual, resultado mensal, saldo acumulado e conciliação com o banco |
| Datas | Primeiro mês, virada do ano, fevereiro/dia 31 e datas reais diferentes das previstas |
| Cartão | Pagamentos parciais, antecipados e atrasados, sem duplicar a fatura |
| Repasses | Repasse da mãe parcial, antecipado ou atrasado; outras pessoas por identificação e receita manual |
| Recorrências e parcelas | Início/fim, exceção de um mês, distribuição de centavos, responsável do grupo e exclusão individual/total |
| Pessoas e filtros | Persistência por orçamento, nomes/IDs válidos, filtros combinados e ordenação numérica |
| Persistência | Revisões concorrentes, rollback, isolamento de contas, importação/exportação e migrações existentes |
| Interface | Novos rascunhos, confirmações, erros, recarga entre abas e separação do modo de exemplo |

Nos cenários financeiros calculados de forma independente, os valores existentes corresponderam ao esperado. As correções desta revisão se concentram nas operações concorrentes e no vínculo entre a tela e a sessão.

## Validação

- A suíte anterior passou antes das correções: 125 testes.
- Suíte final: 160 testes aprovados, sendo 130 de domínio/interface e 30 com PostgreSQL real; TypeScript e builds da interface e do servidor aprovados.
- Os problemas corrigidos tiveram reproduções e testes que falharam antes das correções.
- Foram acrescentados seis cenários financeiros com resultados numéricos independentes: antecipações além do horizonte, pagamentos/repasses parciais e atrasados, pessoas adicionais, conciliação e recorrências/parcelas.
- Chromium em 320, 390 e 1280 pixels usando Fastify e PostgreSQL reais: confirmação após conflito, pagamentos, repasses, filtros, exclusão de parcelas e troca de conta antes de ler/gravar. A segunda conta permaneceu intacta e as operações da aba antiga foram recusadas.
- Safari/iOS em aparelho físico não foi executado.

## Atualizar

```bash
cd /var/www/controleRenda
sh scripts/backup.sh
git pull --ff-only
docker compose -f compose.yaml -f compose.tunnel.yaml up -d --build
```

Recarregue as abas abertas depois da atualização. A nova proteção recusa solicitações de versões antigas que ainda não identificam a conta exibida. Não foi necessária uma nova migração de banco nesta auditoria.
