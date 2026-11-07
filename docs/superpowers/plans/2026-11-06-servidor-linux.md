# Servidor Linux Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** entregar aplicação com autenticação e PostgreSQL, instalável no Linux e domínio próprios.
**Architecture:** preservar React e motor financeiro; API Fastify com cookie de sessão e PostgreSQL relacional. Adaptador de persistência remota, transações com revisão e migração explícita dos dados locais.
**Tech Stack:** Node.js 22+, TypeScript, Fastify, PostgreSQL 16, Docker Compose, Caddy opcional.
**Spec:** `docs/servidor-linux.md`.

## Global Constraints

- Sem cadastro público; cada conta tem orçamento isolado.
- Não gravar dados financeiros reais nem credenciais no Git.
- Gravação transacional com revisão; falhas não anunciam sucesso.
- Preservar valores inteiros em centavos e regras financeiras existentes.
- Configurar domínio e segredos por ambiente; não acessar servidor sem conexão autorizada.

## Review Focus

- Requisições anônimas não leem nem alteram orçamentos.
- Sessões revogadas e origens externas não permitem gravação.
- Duas gravações concorrentes não perdem dados.
- Reinicialização mantém registros e o backup restaura o PostgreSQL.
- Falha de rede não vira orçamento vazio nem salvamento local.

## Task 1 — Persistência e autenticação no servidor

**Files:** `server/{app,config,db,repository,security,index,manage-users}.ts`, `server/migrations/001_initial.sql`, `src/lib/validation.ts`, `tests/server/`.
**Interfaces:** `createServer(config, pool): Promise<FastifyInstance>`; `PostgresRepository.readBudget(userId)` e `.saveBudget(userId, state, revision)`; `BudgetSnapshot = {state, revision}`.

- [x] Escrever testes para login, cookies, acesso anônimo, isolamento, senha e revisão concorrente; executar e observar falhas.
- [x] Implementar esquema relacional, migrações transacionais, pool e persistência autenticada.
- [x] Implementar sessões, proteção de origem, limites e CLI; executar testes com PostgreSQL real.

## Task 2 — Interface conectada

**Files:** `src/{Application,App}.tsx`, `src/lib/{api,persistence}.ts`, `src/components/AccountPanel.tsx`, `tests/`.
**Interfaces:** `BudgetPersistence.initial`, `.load()`, `.save(state, expectedRevision)`; autenticação por `GET /api/auth/me`, `POST /api/auth/login`, `/logout`, `/password`.

- [x] Escrever testes de login, falha de rede, salvamento remoto e importação; observar falhas.
- [x] Substituir salvamento local por persistência remota, login e conta; preservar modo de exemplo.
- [x] Adicionar migração explícita do navegador e atualização entre dispositivos sem sobrescrever formulários.
- [x] Executar testes antigos e novos, TypeScript e build.

## Task 3 — Instalação e operação no Linux

**Files:** `Dockerfile`, `.dockerignore`, `compose.yaml`, `compose.https.yaml`, `Caddyfile`, `.env.example`, `scripts/`, `README.md`, `.github/workflows/ci.yml`.

- [x] Fornecer configuração de domínio, banco privado, armazenamento persistente e backup periódico.
- [x] Documentar instalação, criação de conta, troca de senha, atualização e restauração.
- [x] Validar compose e build da imagem; API testada com banco real. Smoke test dos contêineres, reinicialização e restauração ficaram limitados pelo disco do ambiente, conforme `docs/validacao-servidor.md`.
- [x] Solicitar revisão do resultado, corrigir problemas verificados, testar e enviar ao GitHub.
