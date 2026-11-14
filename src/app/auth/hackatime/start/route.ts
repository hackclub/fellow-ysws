import { redirect } from "next/navigation";
import { startHackatime } from "@/lib/auth/flows";

export async function GET() {
  redirect(await startHackatime());
}
