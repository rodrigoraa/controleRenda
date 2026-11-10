import Fastify, { type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import staticFiles from "@fastify/static";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type pg from "pg";
import type { Config } from "./config";
import { PostgresRepository, ConflictError, NotFoundError } from "./repository";
import {
  hashPassword,
  newSessionToken,
  tokenHash,
  verifyPassword,
} from "./security";
import { parseBackup } from "../src/lib/validation";
const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(256),
  })
  .strict();
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1).max(256),
    newPassword: z.string().min(12).max(256),
  })
  .strict();
const writeSchema = z
  .object({
    state: z.unknown(),
    revision: z.number().int().min(0).max(2_000_000_000),
  })
  .strict();
class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
const sessionName = "cr_session",
  sessionLifetime = 14 * 24 * 60 * 60;
const publicUser = (user: { id: string; email: string; name: string }) => ({
  id: user.id,
  email: user.email,
  name: user.name,
});
export async function createServer(config: Config, pool: pg.Pool) {
  const app = Fastify({
    logger:
      config.LOG_LEVEL === "silent"
        ? false
        : {
            level: config.LOG_LEVEL,
            redact: [
              "req.headers.cookie",
              "req.headers.authorization",
              'res.headers["set-cookie"]',
            ],
          },
    trustProxy:
      config.TRUST_PROXY === "false"
        ? false
        : (_address: string, hop: number) => hop === 0,
    bodyLimit: 5_100_000,
    requestTimeout: 30000,
  });
  const repository = new PostgresRepository(pool);
  const dummyHash = await hashPassword("dummy-credential-never-used-for-login");
  const cookieOptions = {
    httpOnly: true,
    secure: config.APP_ORIGIN.startsWith("https://"),
    sameSite: "strict" as const,
    path: "/",
    maxAge: sessionLifetime,
  };
  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: config.NODE_ENV === "production" ? [] : null,
      },
    },
  });
  await app.register(rateLimit, {
    global: true,
    max: 180,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      statusCode: 429,
      message: "Muitas tentativas. Aguarde um pouco e tente novamente.",
    }),
  });
  app.addHook("onRequest", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) &&
      request.headers.origin !== config.APP_ORIGIN
    )
      throw new HttpError(403, "Origem da requisição não autorizada.");
  });
  app.setErrorHandler((error, request, reply) => {
    const failure = error as { statusCode?: number; code?: string };
    if (error instanceof HttpError)
      return reply.code(error.statusCode).send({ message: error.message });
    if (error instanceof ConflictError)
      return reply.code(409).send({ message: error.message });
    if (error instanceof NotFoundError)
      return reply.code(404).send({ message: error.message });
    if (error instanceof z.ZodError || failure.statusCode === 400)
      return reply
        .code(400)
        .send({ message: "Dados inválidos. Confira os campos informados." });
    if (failure.statusCode === 429)
      return reply.code(429).send({
        message: "Muitas tentativas. Aguarde um pouco e tente novamente.",
      });
    if (failure.statusCode === 413)
      return reply.code(413).send({
        message: "O arquivo ou orçamento ultrapassa o limite de 5 MB.",
      });
    request.log.error(
      { code: failure.code, requestId: request.id },
      "Falha interna ao processar a solicitação.",
    );
    return reply.code(500).send({
      message: "Não foi possível concluir a solicitação. Tente novamente.",
    });
  });
  const sessionToken = (request: FastifyRequest) => {
    const token = request.cookies[sessionName];
    return token && /^[\w-]{43}$/.test(token) ? token : null;
  };
  async function requireUser(request: FastifyRequest) {
    const token = sessionToken(request);
    const user = token
      ? await repository.sessionAccount(tokenHash(token))
      : null;
    if (!user) throw new HttpError(401, "Sua sessão expirou. Entre novamente.");
    return user;
  }
  async function requireAccount(request: FastifyRequest) {
    const user = await requireUser(request);
    const accountId = request.headers["x-controle-account"];
    if (!accountId)
      throw new HttpError(
        428,
        "Atualize a página para continuar com segurança.",
      );
    // Tabs share cookies, so the rendered account must match this request's session.
    if (accountId !== user.id)
      throw new HttpError(
        401,
        "Sua conta mudou em outra aba. Entre novamente para continuar.",
      );
    return user;
  }
  app.get("/api/health", async (_request, reply) => {
    try {
      await pool.query("SELECT 1");
      return { status: "ok" };
    } catch {
      return reply.code(503).send({ status: "unavailable" });
    }
  });
  app.post(
    "/api/auth/login",
    { config: { rateLimit: { max: 8, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const input = loginSchema.parse(request.body),
        user = await repository.findAccount(input.email);
      const valid = await verifyPassword(
        input.password,
        user?.password_hash ?? dummyHash,
      );
      if (!user || !valid)
        throw new HttpError(401, "E-mail ou senha inválidos.");
      const token = newSessionToken(),
        expires = new Date(Date.now() + sessionLifetime * 1000);
      if (!(await repository.createSession(user, tokenHash(token), expires)))
        throw new HttpError(401, "E-mail ou senha inválidos.");
      reply.setCookie(sessionName, token, cookieOptions);
      return { user: publicUser(user) };
    },
  );
  app.get("/api/auth/me", async (request) => ({
    user: publicUser(await requireUser(request)),
  }));
  app.post("/api/auth/logout", async (request, reply) => {
    await requireAccount(request);
    const token = sessionToken(request);
    if (token) await repository.deleteSession(tokenHash(token));
    reply.clearCookie(sessionName, {
      path: "/",
      secure: cookieOptions.secure,
      httpOnly: true,
      sameSite: "strict",
    });
    return reply.code(204).send();
  });
  app.post(
    "/api/auth/password",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const user = await requireAccount(request),
        input = passwordSchema.parse(request.body);
      if (!(await verifyPassword(input.currentPassword, user.password_hash)))
        throw new HttpError(400, "A senha atual está incorreta.");
      const token = newSessionToken(),
        expires = new Date(Date.now() + sessionLifetime * 1000);
      if (
        !(await repository.changePassword(
          user,
          await hashPassword(input.newPassword),
          tokenHash(token),
          expires,
        ))
      )
        throw new HttpError(
          409,
          "Sua senha mudou em outra sessão. Entre novamente.",
        );
      reply.setCookie(sessionName, token, cookieOptions);
      return { message: "Senha alterada. As outras sessões foram encerradas." };
    },
  );
  app.get("/api/budget", async (request, reply) => {
    const user = await requireAccount(request),
      budget = await repository.readBudget(user.id);
    reply.header("ETag", `"${budget.revision}"`);
    return budget;
  });
  app.put("/api/budget", async (request, reply) => {
    const user = await requireAccount(request),
      input = writeSchema.parse(request.body);
    let state;
    try {
      state = parseBackup(JSON.stringify(input.state));
    } catch {
      throw new HttpError(
        400,
        "Orçamento inválido. Confira os dados ou o arquivo de backup.",
      );
    }
    const saved = await repository.saveBudget(user.id, state, input.revision);
    reply.header("ETag", `"${saved.revision}"`);
    return saved;
  });
  const root = resolve("dist");
  if (existsSync(resolve(root, "index.html")))
    await app.register(staticFiles, { root, wildcard: false, index: false });
  app.setNotFoundHandler((request, reply) => {
    if (
      request.method === "GET" &&
      !request.url.startsWith("/api/") &&
      !request.url.split("?")[0].split("/").at(-1)?.includes(".") &&
      request.headers.accept?.includes("text/html") &&
      existsSync(resolve(root, "index.html"))
    )
      return reply.type("text/html").sendFile("index.html");
    return reply
      .code(404)
      .send({ message: "Página ou recurso não encontrado." });
  });
  return app;
}
