import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Binds a ciphertext to where it lives. Decrypting with a different binding fails,
 * so ciphertext copied between rows or columns is rejected.
 */
export type Binding = { table: string; column: string; rowId: string };

export class DecryptionError extends Error {
  constructor(message = "Stored data failed integrity check") {
    super(message);
    this.name = "DecryptionError";
  }
}

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

function aad(b: Binding) {
  return Buffer.from(`fellows-fund/v1|${b.table}|${b.column}|${b.rowId}`, "utf8");
}

function keyFor(version: string): Buffer {
  const encoded = env().ENCRYPTION_KEYS[version];
  if (!encoded) throw new DecryptionError(`Unknown encryption key version ${version}`);
  return Buffer.from(encoded, "base64");
}

/** Encrypts any JSON-serialisable value. Format: `v<version>.<iv>.<tag>.<ciphertext>` (base64url). */
export function encrypt(value: unknown, binding: Binding): string {
  const version = env().ENCRYPTION_ACTIVE_KEY_VERSION;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, keyFor(version), iv);
  cipher.setAAD(aad(binding));
  const ct = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v" + version, iv, tag, ct].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decrypt<T = unknown>(payload: string, binding: Binding): T {
  const parts = payload.split(".");
  if (parts.length !== 4 || !/^v\d+$/.test(parts[0])) throw new DecryptionError("Malformed ciphertext");
  const [v, iv, tag, ct] = parts;
  try {
    const decipher = createDecipheriv(ALGO, keyFor(v.slice(1)), Buffer.from(iv, "base64url"));
    decipher.setAAD(aad(binding));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const pt = Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]);
    return JSON.parse(pt.toString("utf8")) as T;
  } catch (e) {
    if (e instanceof DecryptionError) throw e;
    throw new DecryptionError();
  }
}

/** Key version a ciphertext was written with (for rotation tooling). */
export function keyVersionOf(payload: string): string {
  return payload.split(".")[0].slice(1);
}

/** Keyed hash of a Hack Club user id, used for lookups and uniqueness without storing the id. */
export function hcIdHash(hackclubUserId: string): string {
  return createHmac("sha256", Buffer.from(env().LOOKUP_KEY, "base64"))
    .update(`hackclub-id|${hackclubUserId}`, "utf8")
    .digest("base64url");
}

/** Hash for opaque tokens (session ids) — not secret-keyed, tokens are already high-entropy. */
export function tokenHash(token: string): string {
  return createHmac("sha256", "session-token").update(token).digest("base64url");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Keyed hash of a team invite token, used to find the team without storing the token in the clear. */
export function inviteTokenHash(token: string): string {
  return createHmac("sha256", Buffer.from(env().LOOKUP_KEY, "base64"))
    .update(`team-invite|${token}`, "utf8")
    .digest("base64url");
}
