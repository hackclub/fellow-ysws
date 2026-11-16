import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProjectPicker } from "./ProjectPicker";

describe("ProjectPicker", () => {
  it("lists projects with their logged time", async () => {
    const onChange = vi.fn();
    render(
      <ProjectPicker
        state={{ status: "ok", projects: [{ name: "big-project", totalSeconds: 5 * 3600 + 600 }] }}
        value=""
        onChange={onChange}
      />,
    );
    expect(screen.getByText("5h 10m logged")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /big-project/ }));
    expect(onChange).toHaveBeenCalledWith("big-project");
  });

  it("greys out projects below the team's fee and says how much they need", async () => {
    const onChange = vi.fn();
    render(
      <ProjectPicker
        state={{
          status: "ok",
          projects: [
            { name: "rocket-sim", totalSeconds: 14 * 3600 + 1200 },
            { name: "tiny-compiler", totalSeconds: 4 * 3600 + 1800 },
          ],
        }}
        value=""
        onChange={onChange}
        teamSize={3}
      />,
    );
    const short = screen.getByRole("radio", { name: /tiny-compiler/ });
    expect(short).toBeDisabled();
    expect(short).toHaveAccessibleDescription("needs 6h for a team of 3");
    expect(screen.getByRole("radio", { name: /rocket-sim/ })).toBeEnabled();
    await userEvent.click(short);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says when no project covers the team's fee", () => {
    render(
      <ProjectPicker
        state={{ status: "ok", projects: [{ name: "tiny-compiler", totalSeconds: 4 * 3600 }] }}
        value=""
        onChange={() => {}}
        teamSize={4}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("none of your projects cover 8h yet. keep building, or remove a partner.");
    expect(screen.getByRole("radio", { name: /tiny-compiler/ })).toBeDisabled();
  });

  it("explains the empty state and points at financial aid", () => {
    render(<ProjectPicker state={{ status: "ok", projects: [] }} value="" onChange={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent(/none of your hackatime projects have 2 hours/);
    expect(screen.getByRole("status")).toHaveTextContent(/financial aid/);
  });

  it("offers a retry when Hackatime is unavailable", () => {
    render(
      <ProjectPicker
        state={{ status: "error", message: "Hackatime is unavailable right now", reconnect: false }}
        value=""
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("hackatime is unavailable right now");
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/apply");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("asks to connect, explaining a denial", () => {
    render(<ProjectPicker state={{ status: "not_connected", denied: true }} value="" onChange={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent(/project path needs it/);
    expect(screen.getByRole("link", { name: "Connect Hackatime" })).toHaveAttribute("href", "/auth/hackatime/start");
  });
});
