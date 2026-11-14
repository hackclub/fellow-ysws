import { Button } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/session";
import { JoinRefused } from "@/components/join/JoinRefused";
import { inspectInvite } from "@/lib/teams/service";
import { joinAction } from "./actions";

export const metadata = { title: "Join a team — Hack Club Fellows Fund™" };

const TOKEN = /^[A-Za-z0-9_-]{20,100}$/;

export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token: raw } = await params;
  const token = TOKEN.test(raw) ? raw : "";

  // Check the link before asking anyone to sign in, so a dead link says so right away.
  const viewer = await getCurrentUser();
  // A refused join comes back here, and re-checking shows why (e.g. someone took the last spot).
  const check = await inspectInvite(token, viewer?.id ?? null);
  if (check.ok && !viewer) {
    await requireUser(`/join/${token}`);
  }

  return (
    <main className="container page">
      <div className="stack narrow" style={{ gap: 28 }}>
        {check.ok ? (
          <form action={joinAction} className="stack">
            <input type="hidden" name="token" value={token} />
            <h1>Join {check.founderName}&apos;s team.</h1>
            <p className="lede">
              you&apos;ll be a partner on their fellows fund™ application. {check.partnerSpotsLeft} of 3 partner spots
              left.
            </p>
            <ul className="bullets small">
              <li>partners don&apos;t pay hours. the founder covers the 2 hour fee.</li>
              <li>you&apos;ll see the application&apos;s status and any note from the reviewers.</li>
              <li>
                while you&apos;re on this team you can&apos;t apply on your own or join another team. you&apos;re free again
                once it&apos;s decided, or if you leave before it&apos;s submitted.
              </li>
            </ul>
            <div>
              <Button type="submit">Join the team</Button>
            </div>
          </form>
        ) : (
          <JoinRefused reason={check.reason} />
        )}
      </div>
    </main>
  );
}
