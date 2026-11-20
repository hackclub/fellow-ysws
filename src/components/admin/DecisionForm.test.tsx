import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/actions", () => ({ decideAction: vi.fn() }));
const { DecisionForm } = await import("./DecisionForm");

const choices = () => screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value);

describe("DecisionForm", () => {
  it("offers the four first-pass decisions, with approve inviting to interview", () => {
    render(<DecisionForm id="a1" />);
    expect(choices()).toEqual(["approve", "reject_cut", "reject_malformed", "reject_fraud"]);
    expect(screen.getByText(/invites them to a second-round interview/)).toBeInTheDocument();
  });

  it("offers select, cut and fraud after the interview, with no Needs changes", () => {
    render(<DecisionForm id="a1" round={2} />);
    expect(choices()).toEqual(["select", "reject_cut", "reject_fraud"]);
    expect(screen.queryByText(/Needs changes/)).not.toBeInTheDocument();
    expect(screen.getByText("Decision after the interview")).toBeInTheDocument();
  });
});
