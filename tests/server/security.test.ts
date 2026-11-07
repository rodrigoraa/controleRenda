import { it, expect } from "vitest";
import { hashPassword, verifyPassword, tokenHash } from "../../server/security";
it("deriva senhas com sal independente e verifica sem guardar a senha original", async () => {
  const first = await hashPassword("minha senha de teste 2026"),
    second = await hashPassword("minha senha de teste 2026");
  expect(first).not.toBe(second);
  expect(first).not.toContain("minha senha");
  expect(await verifyPassword("minha senha de teste 2026", first)).toBe(true);
  expect(await verifyPassword("outra senha", first)).toBe(false);
  expect(await verifyPassword("minha senha de teste 2026", "invalid")).toBe(
    false,
  );
});
it("recusa senha curta e limita trabalho com entradas grandes", async () => {
  await expect(hashPassword("123")).rejects.toThrow();
  await expect(hashPassword("x".repeat(300))).rejects.toThrow();
});
it("guarda só o hash do token de sessão e distingue tokens diferentes", () => {
  expect(tokenHash("token-a")).toHaveLength(64);
  expect(tokenHash("token-a")).not.toBe(tokenHash("token-b"));
});
