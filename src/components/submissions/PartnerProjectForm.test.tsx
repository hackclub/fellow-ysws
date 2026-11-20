import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/submissions/project-actions", () => ({ savePartnerProjectAction: vi.fn(async () => null) }));
const { PartnerProjectForm } = await import("./PartnerProjectForm");

const projects = {
  status: "ok" as const,
  projects: [{ name: "side-thing", totalSeconds: 2 * 3600 + 300 }],
};

describe("PartnerProjectForm", () => {
  it("asks for the project fields but no video, and lists what's missing", () => {
    render(<PartnerProjectForm founderName="Ana" projects={projects} saved={null} />);
    expect(screen.getByText(/Ana chose “everyone pays for themselves”/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/YouTube/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save my project" })).toBeDisabled();
    expect(screen.getByTestId("partner-still-missing")).toHaveTextContent(
      "still missing: a hackatime project, a code url, a playable url, a description, how you heard about us.",
    );
  });

  it("lets a 2-hour project be picked and enables save once complete", async () => {
    render(<PartnerProjectForm founderName="Ana" projects={projects} saved={null} />);
    await userEvent.click(screen.getByRole("radio", { name: /side-thing/ }));
    await userEvent.type(screen.getByLabelText("Code URL"), "https://github.com/ben/side-thing");
    await userEvent.type(screen.getByLabelText("Playable URL"), "https://side.example.com");
    await userEvent.type(screen.getByLabelText("Description"), "a thing");
    await userEvent.type(screen.getByLabelText("How'd you hear about us?"), "Ana");
    expect(screen.getByRole("button", { name: "Save my project" })).toBeEnabled();
    expect(screen.queryByTestId("partner-still-missing")).not.toBeInTheDocument();
  });

  it("prefills a saved project and offers to update it", () => {
    const content = {
      hackatimeProject: "side-thing",
      codeUrl: "https://github.com/ben/side-thing",
      playableUrl: "https://side.example.com",
      description: "a thing",
      heardFrom: "Ana",
    };
    render(<PartnerProjectForm founderName="Ana" projects={projects} saved={{ content, seconds: 7500 }} />);
    expect(screen.getByTestId("partner-project-saved")).toHaveTextContent("saved: side-thing (2h 05m logged)");
    expect(screen.getByLabelText("Code URL")).toHaveValue("https://github.com/ben/side-thing");
    expect(screen.getByRole("radio", { name: /side-thing/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Update my project" })).toBeEnabled();
  });

  it("sends the Hackatime connect flow back to the portal", () => {
    render(<PartnerProjectForm founderName="Ana" projects={{ status: "not_connected" }} saved={null} />);
    expect(screen.getByRole("link", { name: "Connect Hackatime" })).toHaveAttribute(
      "href",
      "/auth/hackatime/start?next=%2Fsubmissions",
    );
  });
});
