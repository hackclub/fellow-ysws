import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const valid = { ...process.env } as Record<string, string>;

describe("parseEnv", () => {
  it("accepts the test configuration and parses admin ids", () => {
    const env = parseEnv({ ...valid, ADMIN_HACKCLUB_IDS: " ident!a , ident!b ,," });
    expect([...env.adminIds]).toEqual(["ident!a", "ident!b"]);
  });

  it("lists every missing variable in one readable error", () => {
    const broken = { ...valid };
    delete broken.DATABASE_URL;
    delete broken.LOOKUP_KEY;
    expect(() => parseEnv(broken)).toThrowError(/DATABASE_URL[\s\S]*LOOKUP_KEY[\s\S]*\.env\.example/);
  });

  it("rejects keys that are not 32 bytes", () => {
    expect(() => parseEnv({ ...valid, LOOKUP_KEY: Buffer.alloc(16).toString("base64") })).toThrow(/LOOKUP_KEY: must be 32 bytes/);
  });

  it("rejects an active key version that does not exist", () => {
    expect(() => parseEnv({ ...valid, ENCRYPTION_ACTIVE_KEY_VERSION: "7" })).toThrow(/ENCRYPTION_ACTIVE_KEY_VERSION/);
  });

  it("rejects malformed ENCRYPTION_KEYS", () => {
    expect(() => parseEnv({ ...valid, ENCRYPTION_KEYS: "not json" })).toThrow(/ENCRYPTION_KEYS/);
  });
});
