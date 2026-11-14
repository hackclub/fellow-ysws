import { describe, expect, it } from "vitest";
import { eligibleProjects, formatHours } from "./hackatime-shared";

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
