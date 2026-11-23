import "dotenv/config";
import { readConfig } from "./config";
import { createPool, migrate } from "./db";
import { createServer } from "./app";
import { createBankFeed, readBankConfig } from "./bank-feed";
const config = readConfig(),
  pool = createPool(config.DATABASE_URL);
let app: Awaited<ReturnType<typeof createServer>> | undefined;
try {
  await migrate(pool);
  let bankFeed: ReturnType<typeof createBankFeed> | undefined;
  try {
    const bankConfig = readBankConfig(process.env);
    if (bankConfig) {
      if (!config.APP_ORIGIN.startsWith("https://")) throw new Error();
      bankFeed = createBankFeed(bankConfig);
    }
  } catch {
    console.warn(
      "Contas bancárias desativadas. Confira a configuração do MeuPluggy.",
    );
  }
  app = await createServer(config, pool, bankFeed);
  const stop = async () => {
    await app?.close();
    await pool.end();
  };
  process.once("SIGTERM", () => {
    void stop();
  });
  process.once("SIGINT", () => {
    void stop();
  });
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (error) {
  console.error(
    "Não foi possível iniciar o servidor.",
    error instanceof Error ? error.message : "Erro interno.",
  );
  await app?.close();
  await pool.end();
  process.exitCode = 1;
}
