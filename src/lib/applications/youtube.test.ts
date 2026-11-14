import { afterEach, describe, expect, it, vi } from "vitest";
import { checkYouTubeVideo } from "./youtube";

const URL_ = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

afterEach(() => vi.unstubAllGlobals());

describe("checkYouTubeVideo", () => {
  it("asks oEmbed about the canonical url", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", f);
    expect(await checkYouTubeVideo(URL_)).toBe("ok");
    const called = new URL(String((f.mock.calls[0] as unknown[])[0]));
    expect(called.origin + called.pathname).toBe("https://www.youtube.com/oembed");
    expect(called.searchParams.get("url")).toBe(URL_);
  });

  it.each([401, 403, 404])("treats %i as not found (private or removed)", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status })));
    expect(await checkYouTubeVideo(URL_)).toBe("not_found");
  });

  it("fails closed when YouTube can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("network"); }));
    expect(await checkYouTubeVideo(URL_)).toBe("unreachable");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    expect(await checkYouTubeVideo(URL_)).toBe("unreachable");
  });
});
