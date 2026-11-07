import { z } from "zod";
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (v) => v.startsWith("postgresql://") || v.startsWith("postgres://"),
    ),
  APP_ORIGIN: z.string().url(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z
    .enum(["silent", "fatal", "error", "warn", "info", "debug"])
    .default("info"),
  TRUST_PROXY: z.enum(["true", "false", "1"]).default("false"),
});
export type Config = z.infer<typeof schema>;
export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = schema.safeParse(env);
  if (!result.success)
    throw new Error(
      `Configuração inválida: ${result.error.issues.map((i) => i.path.join(".")).join(", ")}. Confira o arquivo .env.`,
    );
  const config = result.data,
    url = new URL(config.APP_ORIGIN);
  if (
    url.origin !== config.APP_ORIGIN ||
    !["http:", "https:"].includes(url.protocol)
  )
    throw new Error(
      "APP_ORIGIN deve conter somente protocolo e domínio, sem barra final.",
    );
  if (config.NODE_ENV === "production" && url.protocol !== "https:")
    throw new Error("Use HTTPS em APP_ORIGIN para produção.");
  return config;
}
