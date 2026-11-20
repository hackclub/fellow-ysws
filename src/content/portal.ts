// Applicant portal and decision letter copy. Bracketed values are placeholders to fill in
// before decisions go out.

export const COHORT_NAME = "[COHORT NAME]";
export const NEXT_COHORT_DATE = "[NEXT COHORT DATE]";
export const SIGNER_NAME = "Sebastian Hernandez-Tavares";
export const SIGNER_TITLE = "Hack Club Gap Year";

export const PROGRAM_SUMMARY = "10 weeks · 9 online · 1 in san francisco";

export const HERO_PHOTO = {
  src: "/portal-hero.webp",
  credit: "Hu Nhu",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Gold_Gate_Poppy.jpg",
};

export type LetterOutcome = "interview" | "admitted" | "rejected";

/** Where an invited founder books the second-round interview. */
export const INTERVIEW_BOOKING_URL = "https://calendly.com/sebastianhernandez-hackclub/2nd-round-hack-club-fellows";

/**
 * The booking link, prefilled for the founder. `utm_content` carries the application id so a
 * booking can be matched to its application. Empty values are left out rather than sent blank.
 */
export function interviewBookingUrl({
  name,
  email,
  applicationId,
}: {
  name: string | null;
  email: string | null;
  applicationId: string;
}): string {
  const q = new URLSearchParams();
  if (name?.trim()) q.set("name", name.trim());
  if (email?.trim()) q.set("email", email.trim());
  q.set("utm_content", applicationId);
  // URLSearchParams writes spaces as "+"; Calendly reads %20 reliably.
  return `${INTERVIEW_BOOKING_URL}?${q.toString().replace(/\+/g, "%20")}`;
}

/** Paragraphs of the letter body. `kind` tailors the line about what we reviewed. */
export function letterBody(outcome: LetterOutcome, kind: "project" | "aid"): string[] {
  if (outcome === "interview") {
    const reviewed =
      kind === "aid"
        ? "we watched your pitch, and we liked the idea and the team behind it."
        : "we played what you built, read your code, and saw the hours you logged.";
    return [
      "good news: you made it to the second round of FELLOWS FUND™.",
      `${reviewed} before we make our final decision, we'd like to meet your team on a short call.`,
      "the founder books one time for the whole team, so coordinate with one another to make sure everyone can make it.",
      "this isn't an offer of a spot yet. we'll post our final decision on this page after the interview.",
    ];
  }
  if (outcome === "rejected") {
    return [
      `i'm sorry to let you know that we are unable to offer you a spot in the FELLOWS FUND™. this decision says nothing about the work that went into your application. we could tell it was made with care.`,
      "we watched every pitch, and we were struck by the ideas, the late nights and the hours you logged just to get here. simply put, we wish we had more seats on the flight to san francisco.",
      "we encourage you to reapply since most iterate on their idea before getting in.",
      "every application is read and every video is watched before it goes to the full team. these are hard calls, made with care, and we don't run an appeals process since you can always reapply after taking our feedback",
      `this isn't the end of your project. keep building, keep logging hours, and apply again once you think you're ready.`,
      "thank you for applying to FELLOWS FUND™. we enjoyed learning about you and what you're making, and we know you'll ship wherever you go next.",
    ];
  }
  const reviewed =
    kind === "aid"
      ? "we watched your pitch, and we were struck by the idea, the team behind it and how clearly you made your case."
      : "we played what you built, read your code, and saw the hours you logged just to get here. it shows.";
  return [
    `congratulations! i'm delighted to offer you a spot in FELLOWS FUND™.`,
    `${reviewed} out of a pile of applications made with real care, yours stood out.`,
    "over the next ten weeks you'll be mentored with your cohort online, then join us in san francisco for the final week in person.",
    "we'll reach out on slack soon with next steps, from onboarding to travel. keep an eye on your dms.",
    "welcome to FELLOWS FUND™. we're proud to back you, and we can't wait to see what you make.",
  ];
}

export const LETTER_CLOSING: Record<LetterOutcome, string> = {
  interview: "Talk soon,",
  admitted: "See you in san francisco,",
  rejected: "With very best wishes,",
};
