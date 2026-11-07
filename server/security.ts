import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
const parameters = { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
const derive = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 64, parameters, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 256)
    throw new Error("A senha deve ter entre 12 e 256 caracteres.");
  const salt = randomBytes(24),
    key = await derive(password, salt);
  return `scrypt$32768$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
}
export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  if (password.length > 256) return false;
  const pieces = encoded.split("$");
  if (
    pieces.length !== 6 ||
    pieces[0] !== "scrypt" ||
    pieces[1] !== "32768" ||
    pieces[2] !== "8" ||
    pieces[3] !== "1" ||
    !/^([a-f0-9]{48})$/.test(pieces[4]) ||
    !/^([a-f0-9]{128})$/.test(pieces[5])
  )
    return false;
  const actual = await derive(password, Buffer.from(pieces[4], "hex"));
  return timingSafeEqual(actual, Buffer.from(pieces[5], "hex"));
}
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newSessionToken = () => randomBytes(32).toString("base64url");
