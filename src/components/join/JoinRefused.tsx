import Link from "next/link";
import { REFUSAL } from "@/lib/teams/invite-copy";
import type { InviteRefusal } from "@/lib/teams/service";

/** Why an invite link can't be used, with where to go instead. */
export function JoinRefused({ reason }: { reason: InviteRefusal }) {
  const copy = REFUSAL[reason];
  return (
    <div className="stack-sm" data-testid="join-refused" data-reason={reason}>
      <h1>{copy.title}</h1>
      <p className="lede">{copy.body}</p>
      {copy.next && (
        <div>
          <Link href={copy.next.href} className="button">
            {copy.next.label}
          </Link>
        </div>
      )}
    </div>
  );
}
