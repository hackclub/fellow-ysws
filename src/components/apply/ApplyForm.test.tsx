import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/apply/actions", () => ({ submitAction: vi.fn(async () => null), formStartedAction: vi.fn(async () => {}) }));
const { ApplyForm } = await import("./ApplyForm");
const actions = await import("@/app/apply/actions");

const projects = { status: "ok" as const, projects: [{ name: "big-project", totalSeconds: 5 * 3600 + 600 }] };

describe("ApplyForm — still missing", () => {
  it("disables submit and lists everything missing on the project path", () => {
    render(<ApplyForm projects={projects} aidAvailable />);
    const submit = screen.getByRole("button", { name: "Pay 2 hours & submit" });
    expect(submit).toBeDisabled();
    expect(screen.getByTestId("still-missing")).toHaveTextContent(
      "still missing: a hackatime project, a code url, a playable url, a description, your video link, how you heard about us.",
    );
  });

  it("enables submit and hides the list once complete", async () => {
    render(<ApplyForm projects={projects} aidAvailable />);
    await userEvent.click(screen.getByRole("radio", { name: /big-project/ }));
    await userEvent.type(screen.getByLabelText("Code URL"), "https://github.com/a/b");
    expect(screen.getByTestId("still-missing")).toHaveTextContent("still missing: a playable url, a description, your video link, how you heard about us.");
    await userEvent.type(screen.getByLabelText("Playable URL"), "https://b.example.com");
    await userEvent.type(screen.getByLabelText("Description"), "a thing");
    await userEvent.type(screen.getByLabelText("YouTube link"), "https://youtu.be/dQw4w9WgXcQ");
    await userEvent.type(screen.getByLabelText("How'd you hear about us?"), "slack");
    expect(screen.getByRole("button", { name: "Pay 2 hours & submit" })).toBeEnabled();
    expect(screen.queryByTestId("still-missing")).not.toBeInTheDocument();
    expect(screen.getByText(/charged against big-project \(5h 10m logged\)/)).toBeInTheDocument();
    expect(actions.formStartedAction).toHaveBeenCalledTimes(1);
  });

  it("shows the project disclosures on the project path", () => {
    render(<ApplyForm projects={projects} aidAvailable />);
    expect(screen.getByText(/doesn't have to be your startup/)).toBeInTheDocument();
    expect(screen.getByText(/only takes 2 hours of credit/)).toBeInTheDocument();
    expect(screen.getByText(/still yours to reship to another program/)).toBeInTheDocument();
    expect(screen.getByText("we don't take money. we take time.")).toBeInTheDocument();
  });

  it("switches to the aid steps and counts unchecked acknowledgements", async () => {
    render(<ApplyForm projects={projects} aidAvailable />);
    await userEvent.click(screen.getByRole("checkbox", { name: /Request financial aid/ }));
    expect(screen.queryByLabelText("Code URL")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "1. Record a 1 minute video." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit application" })).toBeDisabled();
    expect(screen.getByTestId("still-missing")).toHaveTextContent("3 acknowledgements");
    await userEvent.click(screen.getByRole("checkbox", { name: /entirely new to hack club/ }));
    expect(screen.getByTestId("still-missing")).toHaveTextContent("2 acknowledgements");
  });

  it("disables the aid option with an explanation once aid is used", () => {
    render(<ApplyForm projects={projects} aidAvailable={false} />);
    expect(screen.getByRole("checkbox", { name: /Request financial aid/ })).toBeDisabled();
    expect(screen.getByText(/already used your one financial aid request/)).toBeInTheDocument();
  });
});
