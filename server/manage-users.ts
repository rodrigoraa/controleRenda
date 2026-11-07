import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { z } from "zod";
import { createPool, migrate } from "./db";
import { PostgresRepository } from "./repository";
import { hashPassword } from "./security";
const mode = process.argv[2];
if (!["create", "reset-password"].includes(mode)) {
  console.log(
    "Uso: npm run user:create | npm run user:reset-password\nExecute em um terminal interativo. A senha não será exibida.",
  );
  if (mode !== "--help") process.exitCode = 1;
} else if (!process.stdin.isTTY) {
  console.error(
    "Abra um terminal interativo (docker compose exec app ...). A senha nunca deve ser passada em argumentos.",
  );
  process.exitCode = 1;
} else {
  if (!process.env.DATABASE_URL) throw new Error("Defina DATABASE_URL.");
  const pool = createPool(process.env.DATABASE_URL),
    repo = new PostgresRepository(pool);
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, done) {
      if (!muted) process.stdout.write(chunk);
      done();
    },
  });
  const input = createInterface({
    input: process.stdin,
    output,
    terminal: true,
  });
  async function secret(prompt: string) {
    const answer = input.question(prompt);
    muted = true;
    try {
      return await answer;
    } finally {
      muted = false;
      process.stdout.write("\n");
    }
  }
  try {
    await migrate(pool);
    const email = z
      .string()
      .trim()
      .toLowerCase()
      .email()
      .max(254)
      .parse(await input.question("E-mail da conta: "));
    const name =
      mode === "create"
        ? z
            .string()
            .trim()
            .min(1)
            .max(80)
            .parse(await input.question("Nome: "))
        : "";
    const account =
      mode === "reset-password" ? await repo.findAccount(email) : null;
    if (mode === "reset-password" && !account)
      throw new Error("Conta não encontrada.");
    const password = await secret(
        "Senha (12 a 256 caracteres, entrada oculta): ",
      ),
      confirmation = await secret("Confirme a senha: ");
    if (password !== confirmation) throw new Error("As senhas não conferem.");
    const hash = await hashPassword(password);
    if (mode === "create")
      await repo.createAccount(
        email,
        name,
        hash,
        new Date().toISOString().slice(0, 7),
      );
    else if (account && !(await repo.changePassword(account, hash)))
      throw new Error("A conta mudou durante a operação. Tente novamente.");
    console.log(
      mode === "create"
        ? "Conta criada. Você já pode entrar pelo domínio."
        : "Senha redefinida. Todas as sessões anteriores foram encerradas.",
    );
  } catch (error) {
    const code = (error as { code?: string }).code;
    console.error(
      code === "23505"
        ? "Já existe uma conta com esse e-mail."
        : error instanceof z.ZodError
          ? "Confira o e-mail e o nome informados."
          : error instanceof Error
            ? error.message
            : "Não foi possível concluir.",
    );
    process.exitCode = 1;
  } finally {
    muted = false;
    input.close();
    await pool.end();
  }
}
