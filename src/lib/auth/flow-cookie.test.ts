import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
const { safeNext } = await import("./flow-cookie");

describe("safeNext (post-sign-in return path)", () => {
  it("keeps internal paths, including invite links", () => {
    expect(safeNext("/join/AbC_123-xyz")).toBe("/join/AbC_123-xyz");
    expect(safeNext("/submissions?joined=1")).toBe("/submissions?joined=1");
  });

  it.each([
    "https://evil.example/join/x",
    "//evil.example/join/x",
    "/\\evil.example",
    "javascript:alert(1)",
    "join/x",
    "",
  ])("falls back to /apply for %j", (next) => {
    expect(safeNext(next)).toBe("/apply");
  });

  it("falls back when missing", () => {
    expect(safeNext(null)).toBe("/apply");
    expect(safeNext(undefined)).toBe("/apply");
  });
});
