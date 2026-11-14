import { env } from "@/lib/env";

/** Telescreen's Hackatime overview for one user's project. */
export function telescreenUrl(hackatimeId: string, project: string, base: string = env().TELESCREEN_URL): string {
  const url = new URL("/workbench/hackatime/overview", base);
  url.searchParams.set("p", project);
  url.searchParams.set("u", hackatimeId);
  return url.toString();
}
