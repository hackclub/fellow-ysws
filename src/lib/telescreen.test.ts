import { describe, expect, it } from "vitest";
import { telescreenUrl } from "./telescreen";

describe("telescreenUrl", () => {
  it("builds the hackatime overview link with the project and hackatime id", () => {
    expect(telescreenUrl("8997", "My project", "https://telescreen.hackclub.com")).toBe(
      "https://telescreen.hackclub.com/workbench/hackatime/overview?p=My+project&u=8997",
    );
  });

  it("encodes project names safely", () => {
    const url = new URL(telescreenUrl("1", "a&b=c/d #1", "https://telescreen.hackclub.com"));
    expect(url.searchParams.get("p")).toBe("a&b=c/d #1");
    expect(url.searchParams.get("u")).toBe("1");
  });
});
