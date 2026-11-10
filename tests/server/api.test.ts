import { beforeAll, beforeEach, afterEach, afterAll, it, expect } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { createPool, migrate } from "../../server/db";
import { createServer } from "../../server/app";
import { PostgresRepository } from "../../server/repository";
import { hashPassword, tokenHash } from "../../server/security";
import { createDemo } from "../../src/lib/demo";
import { readConfig } from "../../server/config";
const url = process.env.TEST_DATABASE_URL;
if (!url)
  throw new Error(
    "TEST_DATABASE_URL deve apontar para um banco exclusivo de testes.",
  );
const pool = createPool(url),
  repo = new PostgresRepository(pool),
  origin = "https://financas.example.test";
const config = readConfig({
  DATABASE_URL: url,
  APP_ORIGIN: origin,
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
});
let app: FastifyInstance;
let email: string;
let secondEmail: string;
let firstAccountId: string;
let secondAccountId: string;
let passwordHash: string;
const extraEmails: string[] = [];
const password = "senha de teste longa 2026";
const headers = { origin };
const accountHeaders = (cookie: string, accountId = firstAccountId) => ({
  ...headers,
  cookie,
  "x-controle-account": accountId,
});
async function freshAccount() {
  const address = `${randomUUID()}@api.example.test`;
  extraEmails.push(address);
  return repo.createAccount(address, "Teste", passwordHash, "2026-11");
}
async function login(address = email, pass = password) {
  const result = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers,
    payload: { email: address, password: pass },
  });
  expect(result.statusCode).toBe(200);
  return String(result.headers["set-cookie"]).split(";")[0];
}
beforeAll(async () => {
  await migrate(pool);
  passwordHash = await hashPassword(password);
  email = `${randomUUID()}@api.example.test`;
  secondEmail = `${randomUUID()}@api.example.test`;
  firstAccountId = (
    await repo.createAccount(email, "Rodrigo", passwordHash, "2026-11")
  ).id;
  secondAccountId = (
    await repo.createAccount(
      secondEmail,
      "Outra conta",
      passwordHash,
      "2026-11",
    )
  ).id;
});
beforeEach(async () => {
  app = await createServer(config, pool);
});
afterEach(async () => {
  await app.close();
});
afterAll(async () => {
  await pool.query("DELETE FROM users WHERE email=ANY($1::text[])", [
    [email, secondEmail, ...extraEmails],
  ]);
  await pool.end();
});
it("bloqueia leitura e gravação sem login", async () => {
  expect((await app.inject({ url: "/api/budget" })).statusCode).toBe(401);
  expect(
    (
      await app.inject({
        method: "PUT",
        url: "/api/budget",
        headers,
        payload: { state: createDemo("2026-11"), revision: 0 },
      })
    ).statusCode,
  ).toBe(401);
});
it("autentica com cookie seguro e não retorna hash de senha", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers,
    payload: { email, password },
  });
  expect(response.statusCode).toBe(200);
  const cookie = String(response.headers["set-cookie"]);
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("Secure");
  expect(cookie).toContain("SameSite=Strict");
  expect(response.json()).toEqual({
    user: { id: expect.any(String), email, name: "Rodrigo" },
  });
});
it("recusa senha errada com mensagem genérica e protege a origem", async () => {
  const bad = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers,
    payload: { email, password: "senha errada" },
  });
  expect(bad.statusCode).toBe(401);
  expect(bad.json().message).toBe("E-mail ou senha inválidos.");
  const cross = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { origin: "https://outro.example.test" },
    payload: { email, password },
  });
  expect(cross.statusCode).toBe(403);
});
it("salva no banco e mantém cada conta isolada", async () => {
  const cookie = await login();
  const first = await app.inject({
    url: "/api/budget",
    headers: accountHeaders(cookie),
  });
  expect(first.statusCode).toBe(200);
  const revision = first.json().revision;
  const saved = await app.inject({
    method: "PUT",
    url: "/api/budget",
    headers: accountHeaders(cookie),
    payload: { state: createDemo("2026-11"), revision },
  });
  expect(saved.statusCode).toBe(200);
  const reread = await app.inject({
    url: "/api/budget",
    headers: accountHeaders(cookie),
  });
  expect(reread.json().state.entries).toHaveLength(11);
  const otherCookie = await login(secondEmail);
  const other = await app.inject({
    url: "/api/budget",
    headers: accountHeaders(otherCookie, secondAccountId),
  });
  expect(other.json().state.entries).toHaveLength(0);
});
it("rejeita revisão desatualizada e estado inválido sem perder a versão salva", async () => {
  const cookie = await login();
  const before = (
    await app.inject({ url: "/api/budget", headers: accountHeaders(cookie) })
  ).json();
  const saved = await app.inject({
    method: "PUT",
    url: "/api/budget",
    headers: accountHeaders(cookie),
    payload: { state: before.state, revision: before.revision },
  });
  expect(saved.statusCode).toBe(200);
  const stale = await app.inject({
    method: "PUT",
    url: "/api/budget",
    headers: accountHeaders(cookie),
    payload: { state: createDemo("2026-11"), revision: before.revision },
  });
  expect(stale.statusCode).toBe(409);
  const invalid = await app.inject({
    method: "PUT",
    url: "/api/budget",
    headers: accountHeaders(cookie),
    payload: {
      state: {
        ...before.state,
        settings: { ...before.state.settings, invoiceDay: 55 },
      },
      revision: before.revision + 1,
    },
  });
  expect(invalid.statusCode).toBe(400);
});
it("impede que uma aba antiga substitua outra conta com a mesma revisão", async () => {
  const firstAccount = await freshAccount(),
    secondAccount = await freshAccount();
  const firstCookie = await login(firstAccount.email);
  const first = (
    await app.inject({
      url: "/api/budget",
      headers: accountHeaders(firstCookie, firstAccount.id),
    })
  ).json();
  const switchedCookie = await login(secondAccount.email);
  const before = await repo.readBudget(secondAccount.id);
  expect(first.revision).toBe(before.revision);
  const saved = await app.inject({
    method: "PUT",
    url: "/api/budget",
    headers: accountHeaders(switchedCookie, firstAccount.id),
    payload: { state: createDemo("2026-11"), revision: first.revision },
  });
  expect(saved.statusCode).toBe(401);
  expect(await repo.readBudget(secondAccount.id)).toEqual(before);
  expect(
    (
      await app.inject({
        url: "/api/budget",
        headers: accountHeaders(switchedCookie, firstAccount.id),
      })
    ).statusCode,
  ).toBe(401);
  expect(
    (
      await app.inject({
        url: "/api/budget",
        headers: accountHeaders(switchedCookie, secondAccount.id),
      })
    ).statusCode,
  ).toBe(200);
});
it.each([
  ["GET", "/api/budget"],
  ["PUT", "/api/budget"],
  ["POST", "/api/auth/password"],
  ["POST", "/api/auth/logout"],
] as const)(
  "exige atualizar %s %s sem a conta esperada",
  async (method, url) => {
    const account = await freshAccount(),
      cookie = await login(account.email);
    const before = await repo.readBudget(account.id);
    for (const binding of [undefined, ""]) {
      const response = await app.inject({
        method,
        url,
        headers: {
          ...headers,
          cookie,
          ...(binding === undefined ? {} : { "x-controle-account": binding }),
        },
        ...(method === "PUT"
          ? { payload: { state: createDemo("2026-11"), revision: 0 } }
          : {}),
        ...(url.endsWith("password")
          ? {
              payload: {
                currentPassword: password,
                newPassword: "nova senha sem vínculo 2026",
              },
            }
          : {}),
      });
      expect(response.statusCode).toBe(428);
      expect(response.json()).toEqual({
        message: "Atualize a página para continuar com segurança.",
      });
      expect(response.headers["set-cookie"]).toBeUndefined();
    }
    expect(await repo.readBudget(account.id)).toEqual(before);
    expect(
      (await app.inject({ url: "/api/auth/me", headers: { cookie } }))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          url: "/api/budget",
          headers: accountHeaders(cookie, account.id),
        })
      ).statusCode,
    ).toBe(200);
  },
);
it.each(["/api/auth/password", "/api/auth/logout"])(
  "recusa %s de uma aba ligada a outra conta",
  async (url) => {
    const displayed = await freshAccount(),
      current = await freshAccount();
    const cookie = await login(current.email);
    const response = await app.inject({
      method: "POST",
      url,
      headers: accountHeaders(cookie, displayed.id),
      ...(url.endsWith("password")
        ? {
            payload: {
              currentPassword: password,
              newPassword: "nova senha de outra conta 2026",
            },
          }
        : {}),
    });
    expect(response.statusCode).toBe(401);
    expect(
      (await app.inject({ url: "/api/auth/me", headers: { cookie } }))
        .statusCode,
    ).toBe(200);
    await login(current.email);
  },
);
it("encerra a sessão no logout", async () => {
  const cookie = await login();
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/auth/logout",
        headers: accountHeaders(cookie),
      })
    ).statusCode,
  ).toBe(204);
  expect(
    (await app.inject({ url: "/api/auth/me", headers: { cookie } })).statusCode,
  ).toBe(401);
});
it("não aceita uma sessão vencida", async () => {
  const cookie = await login();
  await pool.query(
    "UPDATE sessions SET expires_at=now()-interval '1 minute' WHERE token_hash=$1",
    [tokenHash(cookie.split("=")[1])],
  );
  expect(
    (await app.inject({ url: "/api/auth/me", headers: { cookie } })).statusCode,
  ).toBe(401);
});
it("limita tentativas de login", async () => {
  const statuses = [];
  for (let i = 0; i < 9; i++)
    statuses.push(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/login",
          headers,
          payload: { email, password: "incorreta" },
        })
      ).statusCode,
    );
  expect(statuses.slice(0, 8)).toEqual(Array(8).fill(401));
  expect(statuses[8]).toBe(429);
});
it("troca a senha, revoga outras sessões e mantém uma sessão nova", async () => {
  const oldCookie = await login(),
    otherCookie = await login();
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/password",
    headers: accountHeaders(oldCookie),
    payload: {
      currentPassword: password,
      newPassword: "nova senha longa para teste 2026",
    },
  });
  expect(response.statusCode).toBe(200);
  expect(
    (
      await app.inject({
        url: "/api/auth/me",
        headers: { cookie: otherCookie },
      })
    ).statusCode,
  ).toBe(401);
  const updatedCookie = String(response.headers["set-cookie"]).split(";")[0];
  expect(
    (
      await app.inject({
        url: "/api/auth/me",
        headers: { cookie: updatedCookie },
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers,
        payload: { email, password },
      })
    ).statusCode,
  ).toBe(401);
});
it("não permite burlar o limite de login mudando um prefixo de IP encaminhado", async () => {
  await app.close();
  app = await createServer({ ...config, TRUST_PROXY: "true" }, pool);
  const statuses = [];
  for (let i = 0; i < 9; i++)
    statuses.push(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/login",
          headers: {
            origin,
            "x-forwarded-for": `198.51.100.${i + 1}, 203.0.113.10`,
          },
          payload: { email, password: "incorreta" },
        })
      ).statusCode,
    );
  expect(statuses.slice(0, 8)).toEqual(Array(8).fill(401));
  expect(statuses[8]).toBe(429);
});
