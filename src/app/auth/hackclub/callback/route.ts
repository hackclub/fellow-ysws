import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { finishHackClub } from "@/lib/auth/flows";

export async function GET(req: NextRequest) {
  let to = "/?signin=failed";
  try {
    to = await finishHackClub(req.nextUrl.searchParams);
  } catch (e) {
    console.error("Hack Club sign-in failed", e instanceof Error ? e.message : e);
  }
  redirect(to);
}
