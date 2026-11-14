import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth/session";
import { clearHackatimeToken } from "@/lib/hackatime";

export async function POST() {
  await destroySession();
  await clearHackatimeToken();
  redirect("/");
}
