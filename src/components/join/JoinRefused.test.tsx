import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JoinRefused } from "./JoinRefused";

describe("JoinRefused", () => {
  it.each([
    ["invalid", "This invite link doesn't work.", /replaced with a new one/, null],
    ["full", "This team is full.", /up to 3 partners/, null],
    ["applied", "This team has already applied.", /can't take new partners/, null],
    ["own_team", "This is your own team.", /send this link to your partners/, "/apply"],
    ["already_member", "You're already on this team.", /submission page/, "/submissions"],
    ["has_application", "You already have your own application.", /application of your own/, "/submissions"],
    ["founds_other_team", "You've started your own team.", /apply solo instead/, "/apply"],
    ["on_other_team", "You're already on another team.", /leave that team first/, "/submissions"],
  ] as const)("explains %s", (reason, title, body, href) => {
    render(<JoinRefused reason={reason} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
    expect(screen.getByText(body)).toBeInTheDocument();
    if (href) expect(screen.getByRole("link")).toHaveAttribute("href", href);
    else expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
