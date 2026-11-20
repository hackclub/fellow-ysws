import { describe, expect, it } from "vitest";
import { INTERVIEW_BOOKING_URL, interviewBookingUrl, letterBody } from "./portal";

describe("letterBody", () => {
  it("offers a spot in the admitted letter and tailors the review line by kind", () => {
    const aid = letterBody("admitted", "aid");
    expect(aid[0]).toContain("offer you a spot in FELLOWS FUND™");
    expect(aid.join(" ")).toContain("we watched your pitch");
    expect(letterBody("admitted", "project").join(" ")).toContain("we played what you built");
  });

  it("declines in the rejected letter and encourages reapplying", () => {
    const body = letterBody("rejected", "project").join(" ");
    expect(body).toContain("unable to offer you a spot");
    expect(body).toContain("we encourage you to reapply");
  });
});

describe("interview letter", () => {
  it("invites to a second round without offering a spot", () => {
    const body = letterBody("interview", "project").join(" ");
    expect(body).toContain("second round");
    expect(body).toContain("isn't an offer of a spot");
    expect(body).not.toContain("delighted to offer you a spot");
  });
});

describe("interviewBookingUrl", () => {
  it("prefills the founder's name and email and carries the application id", () => {
    const url = interviewBookingUrl({ name: "Ada Lovelace", email: "ada@example.com", applicationId: "app-1" });
    expect(url.startsWith(`${INTERVIEW_BOOKING_URL}?`)).toBe(true);
    expect(url).toContain("name=Ada%20Lovelace");
    expect(url).toContain("email=ada%40example.com");
    expect(url).toContain("utm_content=app-1");
  });

  it("leaves out a missing email or name", () => {
    const url = interviewBookingUrl({ name: null, email: " ", applicationId: "app-1" });
    expect(url).toBe(`${INTERVIEW_BOOKING_URL}?utm_content=app-1`);
  });
});
