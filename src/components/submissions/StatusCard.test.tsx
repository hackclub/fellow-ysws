import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ApplicationView } from "@/lib/applications/service";

vi.mock("@/app/submissions/actions", () => ({ deleteAction: vi.fn() }));
const { StatusCard } = await import("./StatusCard");

const base: ApplicationView = {
  id: "a1",
  kind: "project",
  status: "submitted",
  content: {
    hackatimeProject: "big-project",
    codeUrl: "https://github.com/a/b",
    playableUrl: "https://b.example.com",
    description: "desc",
    heardFrom: "slack",
  },
  note: null,
  hackatimeSecondsSnapshot: 9000,
  hackatimeId: null,
  creditedSeconds: 7200,
  createdAt: new Date("2026-11-01"),
  decidedAt: null,
};

describe("StatusCard", () => {
  it.each([
    ["submitted", "Under review"],
    ["approved", "Decision ready"],
    ["rejected_cut", "Decision ready"],
    ["rejected_malformed", "Needs changes"],
  ] as const)("labels %s as %s", (status, label) => {
    render(<StatusCard app={{ ...base, status, note: status.startsWith("rejected") ? "n" : null }} />);
    expect(screen.getByTestId("status-label")).toHaveTextContent(label);
  });

  it("shows the reviewer note when rejected_malformed", () => {
    render(<StatusCard app={{ ...base, status: "rejected_malformed", note: "your playable url 404s" }} />);
    expect(screen.getByTestId("reviewer-note")).toHaveTextContent("your playable url 404s");
  });

  it.each(["approved", "rejected_cut"] as const)("keeps the %s outcome and note for the letter", (status) => {
    render(<StatusCard app={{ ...base, status, note: "your playable url 404s", decidedAt: new Date("2026-11-13T12:00:00") }} />);
    expect(screen.getByRole("link", { name: "View your decision" })).toHaveAttribute("href", "/submissions/decision");
    expect(screen.getByText(/New update · November 13, 2026/)).toBeInTheDocument();
    expect(screen.queryByTestId("reviewer-note")).not.toBeInTheDocument();
    expect(screen.queryByText(/accepted|not accepted/i)).not.toBeInTheDocument();
  });

  it("offers delete only while under review, and resubmit only for Needs changes", () => {
    const { rerender } = render(<StatusCard app={base} />);
    expect(screen.getByRole("button", { name: "Delete application" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /resubmit/i })).not.toBeInTheDocument();

    rerender(<StatusCard app={{ ...base, status: "rejected_malformed", note: "n" }} />);
    expect(screen.queryByRole("button", { name: "Delete application" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /resubmit/i })).toHaveAttribute("href", "/apply");

    for (const status of ["approved", "rejected_cut"] as const) {
      rerender(<StatusCard app={{ ...base, status, note: "n" }} />);
      expect(screen.queryByRole("button", { name: "Delete application" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /resubmit/i })).not.toBeInTheDocument();
    }
  });

  it("shows logged and credited hours for project applications", () => {
    render(<StatusCard app={base} />);
    expect(screen.getByText(/2h 30m logged, 2h credited/)).toBeInTheDocument();
  });
});

describe("StatusCard — after the letter is read", () => {
  const decidedAt = new Date("2026-11-13T12:00:00");

  it("prompts a cut founder to apply again", () => {
    render(<StatusCard app={{ ...base, status: "rejected_cut", note: "n", decidedAt }} decisionSeen />);
    expect(screen.getByTestId("status-label")).toHaveTextContent("Apply again");
    expect(screen.getByRole("link", { name: "Start a new application" })).toHaveAttribute("href", "/apply");
    expect(screen.getByRole("link", { name: "Reread your letter" })).toHaveAttribute("href", "/submissions/decision");
  });

  it("tells a cut aid applicant the next application needs a project", () => {
    const aid = { ...base, kind: "aid" as const, content: { videoUrl: "https://youtu.be/x", aidReason: "r", heardFrom: "h", acknowledgements: { newToHackClub: true as const, onceOnly: true as const, videoContents: true as const } } };
    render(<StatusCard app={{ ...aid, status: "rejected_cut", note: "n", decidedAt }} decisionSeen />);
    expect(screen.getByText(/needs a hackatime project/)).toBeInTheDocument();
  });

  it("shows admitted applicants they're in", () => {
    render(<StatusCard app={{ ...base, status: "approved", decidedAt }} decisionSeen />);
    expect(screen.getByTestId("status-label")).toHaveTextContent("You're in");
    expect(screen.queryByRole("link", { name: "Start a new application" })).not.toBeInTheDocument();
  });
});

describe("StatusCard — teams", () => {
  const members = [
    { userId: "f", role: "founder" as const, name: "Fiona" },
    { userId: "p", role: "partner" as const, name: "Pat" },
  ];

  it("shows the team when there are partners", () => {
    render(<StatusCard app={base} members={members} />);
    expect(screen.getByTestId("team-members")).toHaveTextContent("Fiona");
    expect(screen.getByTestId("team-members")).toHaveTextContent("Pat");
  });

  it("hides the team list for solo applications", () => {
    render(<StatusCard app={base} members={[members[0]]} />);
    expect(screen.queryByTestId("team-members")).not.toBeInTheDocument();
  });

  it("gives partners the label, note and team but no delete or resubmit", () => {
    render(
      <StatusCard app={{ ...base, status: "rejected_malformed", note: "fix the team" }} members={members} viewer="partner" />,
    );
    expect(screen.getByTestId("status-label")).toHaveTextContent("Needs changes");
    expect(screen.getByTestId("reviewer-note")).toHaveTextContent("fix the team");
    expect(screen.getByTestId("team-members")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /resubmit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("gives partners no delete action while under review", () => {
    render(<StatusCard app={base} members={members} viewer="partner" />);
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });
});

