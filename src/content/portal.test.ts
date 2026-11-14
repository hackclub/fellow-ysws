import { describe, expect, it } from "vitest";
import { letterBody } from "./portal";

describe("letterBody", () => {
  it("offers a spot in the admitted letter and tailors the review line by kind", () => {
    const aid = letterBody("admitted", "aid");
    expect(aid[0]).toContain("offer you a spot in FELLOWS FUND™");
    expect(aid.join(" ")).toContain("we watched your pitch");
    expect(letterBody("admitted", "project").join(" ")).toContain("we played what you built");
  });

  it("declines in the rejected letter and encourages reapplying", () => {
    const body = letterBody("rejected", "project").join(" ");
    expect(body).toContain("unable to offer you a spot");
    expect(body).toContain("we encourage you to reapply");
  });
});
