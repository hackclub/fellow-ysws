import type { InviteRefusal } from "./service";

/** What the join page says when a link can't be used, and where it points the visitor next. */
export const REFUSAL: Record<InviteRefusal, { title: string; body: string; next?: { href: string; label: string } }> = {
  invalid: {
    title: "This invite link doesn't work.",
    body: "it may have been replaced with a new one. ask the founder to send you their current link.",
  },
  full: {
    title: "This team is full.",
    body: "a team is a founder plus up to 3 partners, and every spot is taken.",
  },
  applied: {
    title: "This team has already applied.",
    body: "a team locks when its application is submitted, so it can't take new partners now.",
  },
  own_team: {
    title: "This is your own team.",
    body: "send this link to your partners. you can manage your team on the apply page.",
    next: { href: "/apply", label: "Go to your application" },
  },
  already_member: {
    title: "You're already on this team.",
    body: "you can follow the application on your submission page.",
    next: { href: "/submissions", label: "See your team" },
  },
  banned: {
    title: "You can't join this team.",
    body: "you can't take part in FELLOWS FUND™, so you can't join a team.",
  },
  has_application: {
    title: "You already have your own application.",
    body: "you can't join a team while you have an application of your own.",
    next: { href: "/submissions", label: "See your submission" },
  },
  founds_other_team: {
    title: "You've started your own team.",
    body: "to join this one instead, choose \"apply solo instead\" on your team first, then open this link again.",
    next: { href: "/apply", label: "Go to your team" },
  },
  on_other_team: {
    title: "You're already on another team.",
    body: "leave that team first, then open this link again.",
    next: { href: "/submissions", label: "See your team" },
  },
};
