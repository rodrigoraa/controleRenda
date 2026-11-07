# Validação da versão para servidor

- 48 testes aprovados: 30 testes de regras financeiras, persistência/validação e interface; 18 testes de autenticação e persistência com PostgreSQL 16 real.
- TypeScript, build Vite e empacotamento do backend aprovados.
- Imagem final do Dockerfile construída em Node.js 22, incluindo a instalação das dependências de produção.
- Auditoria npm completa: nenhuma vulnerabilidade conhecida reportada na execução desta entrega.
- Compose principal e variante HTTPS validados; scripts de operação passaram na verificação sintática do shell.
- Configurador executado em diretório temporário: gera duas senhas independentes, normaliza o domínio, grava `.env` com permissão 600 e preserva configuração preexistente.

A revisão encontrou e corrigiu três problemas com testes de regressão: uma sessão antiga concorrente com troca de senha, a possibilidade de falsificar a identidade usada pelo limite de requisições atrás do proxy e uma confirmação que retinha revisão antiga após conflito. Também foram reforçadas as referências e a unicidade das ocorrências importadas antes da persistência relacional.

A execução integrada dos serviços de produção em Compose ficou limitada pelo disco de 8 GB e pelo driver VFS do ambiente de desenvolvimento. A imagem foi construída, mas não foi possível manter todos os contêineres simultaneamente para verificar o fluxo HTTP do contêiner, reinicialização e restauração. Esses procedimentos estão no README para execução no servidor de destino. O banco real usado pelos testes é separado de qualquer ambiente do proprietário.

Não houve instalação no servidor do proprietário, configuração de DNS ou emissão de certificado para seu domínio. A conferência visual no navegador também não ficou disponível. O Caddy emitirá o certificado na instalação quando o domínio estiver apontado e as portas necessárias estiverem disponíveis.

Dados locais anteriores com JSON inválido continuam preservados no navegador, mas precisam de recuperação manual ou de um backup válido para importação. A aplicação atual não sobrescreve esses dados automaticamente.
