import "server-only";
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with scrypt from Node's standard library: a memory-hard function
 * recommended by OWASP, so no native bcrypt/argon2 module is needed.
 * Parameters are stored inside each hash, so the cost can be raised later
 * without invalidating existing passwords.
 *
 * Format: scrypt$<log2 N>$<r>$<p>$<salt>$<hash>
 */
const LOG2_N = 17; // N = 131072, r = 8, p = 1: OWASP's minimum recommendation
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = 64;

function deriveKey(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // maxmem must exceed 128 * N * r bytes (128 MiB here); Node's 32 MiB default is too small.
    scrypt(password, salt, keyLength, { ...options, maxmem: 256 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, KEY_LENGTH, { N: 2 ** LOG2_N, r: BLOCK_SIZE, p: PARALLELISM });
  return ["scrypt", LOG2_N, BLOCK_SIZE, PARALLELISM, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, log2N, r, p, saltB64, keyB64] = stored.split("$");
  if (algorithm !== "scrypt" || !saltB64 || !keyB64) return false;

  const expected = Buffer.from(keyB64, "base64");
  const actual = await deriveKey(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: 2 ** Number(log2N),
    r: Number(r),
    p: Number(p),
  });
  // Constant-time comparison: response time doesn't reveal how many bytes matched.
  return timingSafeEqual(actual, expected);
}
