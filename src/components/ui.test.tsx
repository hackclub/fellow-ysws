import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Accordion } from "./Accordion";
import { Button, Field } from "./ui";

describe("Button", () => {
  it("does not fire when disabled", async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Pay 2 hours &amp; submit</Button>);
    const btn = screen.getByRole("button", { name: "Pay 2 hours & submit" });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Field", () => {
  it("links label, hint and error to the input", () => {
    render(<Field label="Code URL" hint="a github repo" error="must be a GitHub repository" />);
    const input = screen.getByLabelText("Code URL");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("a github repo must be a GitHub repository");
  });
});

describe("Accordion", () => {
  const entries = [
    { question: "What is Fellows Fund™?", answer: <p>A ten week program.</p> },
    { question: "Why does it cost 2 hours?", answer: <p>Because time.</p> },
  ];

  it("starts collapsed and toggles with the mouse", async () => {
    render(<Accordion entries={entries} />);
    const trigger = screen.getByRole("button", { name: /What is Fellows Fund/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("A ten week program.")).not.toBeVisible();
    expect(trigger).toHaveTextContent("Open");
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveTextContent("Close");
    expect(screen.getByText("A ten week program.")).toBeVisible();
  });

  it("toggles with Enter and Space", async () => {
    render(<Accordion entries={entries} />);
    const trigger = screen.getByRole("button", { name: /Why does it cost/ });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard(" ");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
