import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamView } from "@/lib/teams/service";

vi.mock("@/app/apply/team-actions", () => ({
  formTeamAction: vi.fn(),
  replaceInviteAction: vi.fn(),
  kickPartnerAction: vi.fn(),
  dissolveTeamAction: vi.fn(),
  refreshTeamAction: vi.fn(),
}));
const actions = vi.mocked(await import("@/app/apply/team-actions"));
const { TeamSection } = await import("./TeamSection");

const team = (over: Partial<TeamView> = {}): TeamView => ({
  id: "t1",
  version: 3,
  open: true,
  members: [
    { userId: "f", role: "founder", name: "Fiona" },
    { userId: "p1", role: "partner", name: "Pat" },
  ],
  partnerSpotsLeft: 2,
  inviteToken: "TOKEN123",
  ...over,
});

function Harness({ initial }: { initial: TeamView | null }) {
  const [t, setT] = useState(initial);
  return (
    <form data-testid="form">
      <TeamSection step={3} team={t} onTeam={setT} appUrl="https://fellows.test" />
    </form>
  );
}

beforeEach(() => vi.clearAllMocks());

describe("Team section contents", () => {
  it("offers to add partners when there's no team, and sends no team version", async () => {
    render(<Harness initial={null} />);
    expect(screen.getByRole("heading", { name: "3. Bring your team." })).toBeInTheDocument();
    expect(screen.getByText(/each person on the team adds 2 hours to the project fee. partners don't pay hours; only you do./)).toBeInTheDocument();
    expect(new FormData(screen.getByTestId("form") as HTMLFormElement).get("teamVersion")).toBe("");

    actions.formTeamAction.mockResolvedValue({ team: team({ members: [team().members[0]], partnerSpotsLeft: 3 }) });
    await userEvent.click(screen.getByRole("button", { name: "Add partners" }));
    expect(await screen.findByLabelText("Invite link")).toHaveValue("https://fellows.test/join/TOKEN123");
    expect(screen.getByTestId("spots-left")).toHaveTextContent("3 of 3 partner spots left.");
  });

  it("lists members, the invite link, replace and remove actions, and spots left", () => {
    render(<Harness initial={team()} />);
    const list = screen.getByRole("list", { name: "Team members" });
    expect(list).toHaveTextContent("Fiona");
    expect(list).toHaveTextContent("founder (you)");
    expect(list).toHaveTextContent("Pat");
    expect(screen.getByRole("button", { name: "Remove Pat" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Fiona" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Invite link")).toHaveValue("https://fellows.test/join/TOKEN123");
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New link" })).toBeInTheDocument();
    expect(screen.getByTestId("spots-left")).toHaveTextContent("2 of 3 partner spots left.");
    expect(new FormData(screen.getByTestId("form") as HTMLFormElement).get("teamVersion")).toBe("3");
  });

  it("says when the team is full", () => {
    render(<Harness initial={team({ partnerSpotsLeft: 0 })} />);
    expect(screen.getByTestId("spots-left")).toHaveTextContent("your team is full.");
  });

  it("removes a partner and shows the new link", async () => {
    actions.kickPartnerAction.mockResolvedValue({
      team: team({ members: [team().members[0]], version: 4, inviteToken: "NEWTOKEN", partnerSpotsLeft: 3 }),
    });
    render(<Harness initial={team()} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove Pat" }));
    expect(actions.kickPartnerAction).toHaveBeenCalledWith("p1");
    await waitFor(() => expect(screen.getByLabelText("Invite link")).toHaveValue("https://fellows.test/join/NEWTOKEN"));
    expect(screen.queryByText("Pat")).not.toBeInTheDocument();
  });

  it("shows action errors", async () => {
    actions.replaceInviteAction.mockResolvedValue({ team: team(), error: "your team is locked because your application is in review" });
    render(<Harness initial={team()} />);
    await userEvent.click(screen.getByRole("button", { name: "New link" }));
    expect(await screen.findByTestId("team-error")).toHaveTextContent(/locked/);
  });
});
