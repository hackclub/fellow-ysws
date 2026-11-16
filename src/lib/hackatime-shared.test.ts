import { describe, expect, it } from "vitest";
import { coversFee, eligibleProjects, feeSeconds, formatHours } from "./hackatime-shared";

describe("eligibleProjects", () => {
  it("hides projects under 2 hours and keeps exactly 2 hours", () => {
    const out = eligibleProjects([
      { name: "under", totalSeconds: 2 * 3600 - 60 },
      { name: "exact", totalSeconds: 2 * 3600 },
      { name: "big", totalSeconds: 5 * 3600 + 600 },
    ]);
    expect(out.map((p) => p.name)).toEqual(["big", "exact"]);
  });

  it("drops unnamed projects", () => {
    expect(eligibleProjects([{ name: " ", totalSeconds: 99_999 }])).toEqual([]);
  });
});

describe("formatHours", () => {
  it("formats hours and minutes", () => {
    expect(formatHours(5 * 3600 + 10 * 60 + 59)).toBe("5h 10m");
    expect(formatHours(14 * 3600 + 30 * 60)).toBe("14h 30m");
  });
});

describe("feeSeconds", () => {
  it("charges 2 hours per person on the team", () => {
    expect([1, 2, 3, 4].map(feeSeconds)).toEqual([2, 4, 6, 8].map((h) => h * 3600));
  });

  it("never charges less than one person's fee", () => {
    expect(feeSeconds(0)).toBe(2 * 3600);
  });
});

describe("coversFee", () => {
  const project = (h: number, m = 0) => ({ name: "p", totalSeconds: h * 3600 + m * 60 });

  it("is true at exactly the fee and false a minute under", () => {
    expect(coversFee(project(6), 3)).toBe(true);
    expect(coversFee(project(5, 59), 3)).toBe(false);
  });

  it("lets a listed 2h project cover a solo fee only", () => {
    expect(coversFee(project(2), 1)).toBe(true);
    expect(coversFee(project(2), 2)).toBe(false);
  });
});
