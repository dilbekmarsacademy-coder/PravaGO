import { Algorithm, hash, verify } from "@node-rs/argon2";

// argon2id, OWASP tavsiyasi (m=19 MiB, t=2, p=1).
const OPTIONS = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashSecret(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifySecret(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}

/** Login topilmaganda ham vaqt bir xil bo'lishi uchun solishtiriladigan soxta xesh. */
let dummyHash: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashSecret("dummy-password-for-timing");
  return dummyHash;
}
