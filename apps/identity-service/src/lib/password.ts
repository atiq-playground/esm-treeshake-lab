const ITERATIONS = 210_000;
const HASH_BITS = 256;

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...view].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** PBKDF2-SHA256 with random salt. Stored as `saltHex$hashHex`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    HASH_BITS,
  );
  return `${toHex(salt)}$${toHex(bits)}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [saltHex, hashHex] = stored.split("$");
  if (!saltHex || !hashHex) return false;

  const salt = fromHex(saltHex);
  const expected = fromHex(hashHex);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    HASH_BITS,
  );
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;

  // Constant-time compare
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual[i]! ^ expected[i]!;
  }
  return diff === 0;
}
