import { afterEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "./env";
import { DecryptionError, decrypt, encrypt, hcIdHash, keyVersionOf } from "./crypto";

const at = { table: "applications", column: "content_enc", rowId: "row-1" };

afterEach(() => {
  process.env.ENCRYPTION_ACTIVE_KEY_VERSION = "1";
  process.env.LOOKUP_KEY = Buffer.alloc(32, 9).toString("base64");
  resetEnvCache();
});

describe("encrypt/decrypt", () => {
  it("round-trips JSON values", () => {
    const value = { name: "Orpheus", urls: ["https://github.com/a/b"], n: 3 };
    const ct = encrypt(value, at);
    expect(ct).not.toContain("Orpheus");
    expect(decrypt(ct, at)).toEqual(value);
  });

  it("uses a fresh IV each time", () => {
    expect(encrypt("same", at)).not.toEqual(encrypt("same", at));
  });

  it("decrypts old data after rotating the active key", () => {
    const old = encrypt("secret", at);
    process.env.ENCRYPTION_ACTIVE_KEY_VERSION = "2";
    resetEnvCache();
    const fresh = encrypt("secret", at);
    expect(keyVersionOf(old)).toBe("1");
    expect(keyVersionOf(fresh)).toBe("2");
    expect(decrypt(old, at)).toBe("secret");
    expect(decrypt(fresh, at)).toBe("secret");
  });

  it("rejects tampered ciphertext", () => {
    const [v, iv, tag, ct] = encrypt({ a: 1 }, at).split(".");
    const flipped = Buffer.from(ct, "base64url");
    flipped[0] ^= 1;
    expect(() => decrypt([v, iv, tag, flipped.toString("base64url")].join("."), at)).toThrow(DecryptionError);
  });

  it("rejects ciphertext moved to another row or column", () => {
    const ct = encrypt("x", at);
    expect(() => decrypt(ct, { ...at, rowId: "row-2" })).toThrow(DecryptionError);
    expect(() => decrypt(ct, { ...at, column: "note_enc" })).toThrow(DecryptionError);
  });

  it("rejects malformed payloads and unknown key versions", () => {
    expect(() => decrypt("garbage", at)).toThrow(DecryptionError);
    const [, ...rest] = encrypt("x", at).split(".");
    expect(() => decrypt(["v9", ...rest].join("."), at)).toThrow(DecryptionError);
  });
});

describe("hcIdHash", () => {
  it("is deterministic and does not contain the id", () => {
    expect(hcIdHash("ident!abc")).toBe(hcIdHash("ident!abc"));
    expect(hcIdHash("ident!abc")).not.toContain("abc");
    expect(hcIdHash("ident!abc")).not.toBe(hcIdHash("ident!abd"));
  });

  it("changes under a different key", () => {
    const before = hcIdHash("ident!abc");
    process.env.LOOKUP_KEY = Buffer.alloc(32, 3).toString("base64");
    resetEnvCache();
    expect(hcIdHash("ident!abc")).not.toBe(before);
  });
});
