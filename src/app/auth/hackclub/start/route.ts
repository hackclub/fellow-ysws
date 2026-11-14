import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { startHackClub } from "@/lib/auth/flows";

export async function GET(req: NextRequest) {
  redirect(await startHackClub(req.nextUrl.searchParams.get("next")));
}
