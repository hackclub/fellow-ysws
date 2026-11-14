import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { finishHackatime } from "@/lib/auth/flows";

export async function GET(req: NextRequest) {
  let to = "/apply?hackatime=failed";
  try {
    to = await finishHackatime(req.nextUrl.searchParams);
  } catch (e) {
    console.error("Hackatime connect failed", e instanceof Error ? e.message : e);
  }
  redirect(to);
}
