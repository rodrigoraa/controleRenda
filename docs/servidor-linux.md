# Evolução para servidor Linux

Objetivo: hospedar o Controle Renda no servidor e domínio do proprietário, com PostgreSQL, login e orçamento acessível em diferentes dispositivos. A simplicidade dos fluxos financeiros existentes permanece.

Decisões de implementação: React/TypeScript existente; API Fastify/Node.js; PostgreSQL 16 com tabelas relacionais; implantação Docker Compose. Caddy opcional fornece HTTPS automático, ou a aplicação fica em uma porta local para Nginx/Traefik já existente. Essas escolhas são propostas técnicas do implementador; o usuário confirmou servidor Linux e pediu prosseguir com o desenvolvimento.

Contas são criadas pelo administrador via terminal, sem cadastro público. Cada conta tem seu orçamento isolado; atribuir uma compra à mãe continua sendo uma identificação financeira, sem conceder acesso à conta. Sessões usam cookies HttpOnly, tokens aleatórios com somente seu hash no banco, vencimento, logout e revogação na troca de senha. Senhas são derivadas com scrypt. Mudanças exigem origem autorizada e a API limita tentativas de login.

Persistência normalizada para configurações, lançamentos, ocorrências, pagamentos e repasses. Gravações transacionais com revisão impedem que uma aba ou aparelho sobrescreva uma versão mais nova. Não há fallback silencioso para localStorage quando o servidor falha. Dados locais antigos e backups podem ser importados com confirmação.

Entrega inclui migrações versionadas, CLI para criar contas/redefinir senha, Dockerfiles, compose, configuração de domínio/HTTPS, backup periódico do PostgreSQL e instruções de restauração. Testes de integração usam PostgreSQL real para login, isolamento, concorrência e persistência. O proprietário fornecerá domínio e fará a instalação no servidor; não há acesso SSH conectado nesta sessão.
