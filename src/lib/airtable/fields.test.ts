import { describe, expect, it } from "vitest";
import { buildFields, githubOwner, splitName } from "./fields";

const content = {
  hackatimeProject: "big-project",
  codeUrl: "https://github.com/orpheus/big-project",
  playableUrl: "https://big.example.com",
  description: "a game",
  heardFrom: "slack",
};
const pii = { hcId: "ident!x", name: "Orpheus the Dino", email: "o@example.com", slackId: "U1" };

describe("buildFields", () => {
  it("maps a project review onto the YSWS table, capping hours at 2", () => {
    const f = buildFields({
      content,
      pii,
      hackatimeId: "8997",
      loggedSeconds: 5 * 3600 + 30 * 60,
      cappedSeconds: 7200,
      submittedAt: new Date("2026-11-11T10:00:00Z"),
      justification: "solid demo",
    });
    expect(f).toMatchObject({
      "Code URL": content.codeUrl,
      "Playable URL": content.playableUrl,
      "How did you hear about this?": "slack",
      "First Name": "Orpheus",
      "Last Name": "the Dino",
      Email: "o@example.com",
      Description: "a game",
      "GitHub Username": "orpheus",
      "Optional - Override Hours Spent": 2,
      "Justification - Submitter Hackatime ID": "8997",
      "Justification - Hackatime Project Name(s) + Date Range(s)": "big-project (all time, through 2026-11-11)",
      "Justification - Additional Justification": "solid demo",
    });
    const why = f["Optional - Override Hours Spent Justification"] as string;
    expect(why).toContain("Hackatime ID: 8997");
    expect(why).toContain("5.5h logged");
    expect(why).toContain("Reviewer justification:\nsolid demo");
  });

  it("never ticks the Unified YSWS submit box and leaves unknown fields out", () => {
    const f = buildFields({ content, pii: { ...pii, email: null }, hackatimeId: null, loggedSeconds: 7200, cappedSeconds: 7200, submittedAt: new Date(), justification: null });
    expect(f).not.toHaveProperty("Automation - Submit to Unified YSWS");
    for (const k of ["Email", "Birthday", "City", "Justification - Submitter Hackatime ID", "Justification - Additional Justification"]) {
      expect(f).not.toHaveProperty(k);
    }
  });

  it("uses Hack Club Auth's address, birthday and name parts when present", () => {
    const f = buildFields({
      content,
      pii: {
        ...pii,
        givenName: "Orph",
        familyName: "Eus",
        birthdate: "2009-04-01",
        address: { line1: "15 Falls Rd", line2: null, city: "Shelburne", state: "VT", postalCode: "05482", country: "US" },
      },
      hackatimeId: "1",
      loggedSeconds: 7200,
      cappedSeconds: 7200,
      submittedAt: new Date(),
      justification: "ok",
    });
    expect(f).toMatchObject({
      "First Name": "Orph",
      "Last Name": "Eus",
      Birthday: "2009-04-01",
      "Address (Line 1)": "15 Falls Rd",
      City: "Shelburne",
      "State / Province": "VT",
      "ZIP / Postal Code": "05482",
      Country: "US",
    });
    expect(f).not.toHaveProperty("Address (Line 2)");
  });
});

describe("helpers", () => {
  it("splits names and reads GitHub owners", () => {
    expect(splitName({ ...pii, name: "Ada" })).toEqual({ first: "Ada", last: null });
    expect(splitName({ ...pii, name: null })).toEqual({ first: null, last: null });
    expect(githubOwner("https://github.com/hackclub/site.git")).toBe("hackclub");
    expect(githubOwner("https://gitlab.com/a/b")).toBeNull();
  });
});
