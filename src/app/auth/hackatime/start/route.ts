import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { startHackatime } from "@/lib/auth/flows";

export async function GET(req: NextRequest) {
  redirect(await startHackatime(req.nextUrl.searchParams.get("next")));
}
