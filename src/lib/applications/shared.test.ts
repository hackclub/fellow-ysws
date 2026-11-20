import { describe, expect, it } from "vitest";
import {
  APPLICANT_LABEL,
  missingItems,
  normalizeGithubRepo,
  normalizeYouTubeUrl,
  validateApplication,
  validatePartnerProject,
  type ApplicationInput,
  type PartnerProjectInput,
} from "./shared";

const project: ApplicationInput = {
  kind: "project",
  hackatimeProject: "big-project",
  codeUrl: "https://github.com/orpheus/big-project",
  playableUrl: "https://big-project.example.com",
  description: "a thing that does stuff",
  videoUrl: "https://youtu.be/dQw4w9WgXcQ",
  heardFrom: "slack",
};

const aid: ApplicationInput = {
  kind: "aid",
  videoUrl: "https://youtu.be/dQw4w9WgXcQ",
  aidReason: "new to hack club, big idea",
  heardFrom: "a friend",
  ackNewToHackClub: true,
  ackOnceOnly: true,
  ackVideoContents: true,
};

describe("validateApplication — project path", () => {
  it("accepts a complete application and normalises the repo url", () => {
    const r = validateApplication({ ...project, codeUrl: "http://www.github.com/orpheus/big-project.git/" });
    expect(r).toEqual({
      ok: true,
      value: {
        kind: "project",
        content: { ...project, codeUrl: "https://github.com/orpheus/big-project", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", kind: undefined },
      },
    });
  });

  it.each([
    ["https://gitlab.com/orpheus/x"],
    ["https://github.com/orpheus"],
    ["github.com/orpheus/x"],
    ["https://github.com.evil.com/a/b"],
  ])("rejects non-GitHub-repo code url %s", (codeUrl) => {
    const r = validateApplication({ ...project, codeUrl });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.codeUrl).toMatch(/must be a github repository/);
  });

  it("rejects a non-http playable url", () => {
    const r = validateApplication({ ...project, playableUrl: "javascript:alert(1)" });
    expect(!r.ok && r.errors.playableUrl).toMatch(/http/);
  });

  it.each(["hackatimeProject", "codeUrl", "playableUrl", "description", "videoUrl", "heardFrom"] as const)(
    "points out a missing %s",
    (field) => {
      const r = validateApplication({ ...project, [field]: "  " });
      expect(r.ok).toBe(false);
      expect(!r.ok && r.errors[field]).toBeTruthy();
    },
  );
});

describe("validateApplication — aid path", () => {
  it("accepts a complete aid application with no project fields", () => {
    const r = validateApplication(aid);
    expect(r.ok && r.value).toEqual({
      kind: "aid",
      content: {
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        aidReason: aid.aidReason,
        heardFrom: aid.heardFrom,
        acknowledgements: { newToHackClub: true, onceOnly: true, videoContents: true },
      },
    });
  });

  it("rejects non-YouTube links", () => {
    const r = validateApplication({ ...aid, videoUrl: "https://vimeo.com/123" });
    expect(!r.ok && r.errors.videoUrl).toMatch(/youtube/);
  });

  it.each(["ackNewToHackClub", "ackOnceOnly", "ackVideoContents"] as const)("requires %s", (ack) => {
    const r = validateApplication({ ...aid, [ack]: false });
    expect(r.ok).toBe(false);
    expect(!r.ok && Object.keys(r.errors)).toEqual([ack]);
  });
});

describe("normalizeYouTubeUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc"],
    ["https://youtube.com/shorts/dQw4w9WgXcQ"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ"],
  ])("accepts %s", (url) => {
    expect(normalizeYouTubeUrl(url)).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it.each([["https://youtube.com/watch?v=short"], ["https://notyoutube.com/watch?v=dQw4w9WgXcQ"], ["nope"]])(
    "rejects %s",
    (url) => expect(normalizeYouTubeUrl(url)).toBeNull(),
  );
});

describe("normalizeGithubRepo", () => {
  it("strips paths after the repo", () => {
    expect(normalizeGithubRepo("https://github.com/a-b/c.d/tree/main")).toBe("https://github.com/a-b/c.d");
  });
});

describe("missingItems", () => {
  it("lists missing project items in plain words", () => {
    expect(missingItems({ kind: "project", playableUrl: "x", description: "y", heardFrom: "z" })).toEqual([
      "a hackatime project",
      "a code url",
      "your video link",
    ]);
  });

  it("counts unchecked acknowledgements on the aid path", () => {
    expect(missingItems({ ...aid, ackOnceOnly: false, ackVideoContents: false })).toEqual(["2 acknowledgements"]);
  });

  it("is empty when complete", () => {
    expect(missingItems(project)).toEqual([]);
    expect(missingItems(aid)).toEqual([]);
  });
});

describe("APPLICANT_LABEL", () => {
  it("shows malformed rejections as Needs changes", () => {
    expect(APPLICANT_LABEL).toEqual({
      submitted: "Under review",
      interview: "Interview",
      approved: "Accepted",
      rejected_cut: "Not accepted",
      rejected_malformed: "Needs changes",
      rejected_fraud: "Not accepted",
    });
  });
});

describe("validatePartnerProject", () => {
  const partner: PartnerProjectInput = {
    hackatimeProject: "side-thing",
    codeUrl: "https://github.com/ben/side-thing.git",
    playableUrl: "https://side-thing.example.com",
    description: "a smaller shipped project",
    heardFrom: "my teammate",
  };

  it("accepts a full project with no video and normalizes the repo", () => {
    const r = validatePartnerProject(partner);
    expect(r).toEqual({ ok: true, value: { ...partner, codeUrl: "https://github.com/ben/side-thing" } });
  });

  it("drops a video if one is posted", () => {
    const r = validatePartnerProject({ ...partner, videoUrl: "https://youtu.be/dQw4w9WgXcQ" } as PartnerProjectInput);
    expect(r.ok && "videoUrl" in r.value).toBe(false);
  });

  it("rejects a non-github code url", () => {
    const r = validatePartnerProject({ ...partner, codeUrl: "https://gitlab.com/ben/side-thing" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.codeUrl).toMatch(/github repository/);
  });

  it("requires a description and a playable url", () => {
    const r = validatePartnerProject({ ...partner, description: " ", playableUrl: "javascript:alert(1)" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.description).toBe("add a description");
      expect(r.errors.playableUrl).toMatch(/http/);
    }
  });
});
