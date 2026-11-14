import "server-only";
import { env } from "@/lib/env";

export type YouTubeCheck = "ok" | "not_found" | "unreachable";

/**
 * Confirms a canonical YouTube URL resolves to a viewable video via oEmbed.
 * Unlisted videos resolve; private or removed ones don't. We can't tell unlisted
 * from public, so that rule relies on the applicant's acknowledgement.
 */
export async function checkYouTubeVideo(canonicalUrl: string): Promise<YouTubeCheck> {
  const url = new URL(env().YOUTUBE_OEMBED_URL);
  url.searchParams.set("url", canonicalUrl);
  url.searchParams.set("format", "json");
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
  } catch {
    return "unreachable";
  }
  if (res.ok) return "ok";
  if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) return "not_found";
  return "unreachable";
}
