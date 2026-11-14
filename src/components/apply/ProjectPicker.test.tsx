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
