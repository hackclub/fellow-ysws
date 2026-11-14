import { expect, type Page } from "@playwright/test";
import { Pool } from "pg";
import { E2E_DB } from "./global-setup";

export async function resetDb() {
  const pool = new Pool({ connectionString: E2E_DB });
  await pool.query("TRUNCATE funnel_events, sessions, application_members, team_members, applications, teams, aid_claims, users RESTART IDENTITY CASCADE");
  await pool.end();
}

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const pool = new Pool({ connectionString: E2E_DB });
  try {
    return (await pool.query(text, params)).rows as T[];
  } finally {
    await pool.end();
  }
}

/** Approves the mock Hack Club / Hackatime consent screen as the given identity. */
export async function approveAs(page: Page, sub: string) {
  await expect(page.getByRole("heading", { name: /^Mock / })).toBeVisible();
  await page.getByLabel("Hack Club id").fill(sub);
  await page.getByRole("button", { name: "Approve" }).click();
}

export async function signIn(page: Page, sub: string, path = "/apply") {
  await page.goto(path);
  await approveAs(page, sub);
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}

export async function connectHackatime(page: Page, sub: string) {
  await page.getByRole("link", { name: "Connect Hackatime" }).click();
  await approveAs(page, sub);
  await expect(page).toHaveURL(/\/apply$/);
}

export async function setProjects(page: Page, sub: string, projects: { name: string; total_seconds: number }[]) {
  await page.request.post("/test-oauth/hackatime/control", {
    form: { json: JSON.stringify({ sub, projects }) },
  });
}

export async function submitProject(page: Page, sub: string) {
  await signIn(page, sub);
  await connectHackatime(page, sub);
  await page.getByRole("radio", { name: /big-project/ }).check();
  await page.getByLabel("Code URL").fill("https://github.com/orpheus/big-project");
  await page.getByLabel("Playable URL").fill("https://big-project.example.com");
  await page.getByLabel("Description").fill("it plays music from your keyboard");
  await page.getByLabel("YouTube link").fill("https://youtu.be/dQw4w9WgXcQ");
  await page.getByLabel("How'd you hear about us?").fill("slack");
  await page.getByRole("button", { name: "Pay 2 hours & submit" }).click();
  await expect(page).toHaveURL(/\/submissions\?submitted=1/);
}

export async function submitAid(page: Page, sub: string, videoUrl = "https://youtu.be/dQw4w9WgXcQ") {
  await signIn(page, sub);
  await fillAndSubmitAid(page, videoUrl);
}

/** Fills the aid form on the current /apply page and submits it. */
export async function fillAndSubmitAid(page: Page, videoUrl = "https://youtu.be/dQw4w9WgXcQ") {
  await page.getByRole("checkbox", { name: /Request financial aid/ }).check();
  await page.getByLabel("YouTube link").fill(videoUrl);
  await page.getByLabel("Why are you asking for financial aid?").fill("first time building anything, huge idea");
  await page.getByLabel("How'd you hear about us?").fill("a friend");
  await page.getByRole("checkbox", { name: /entirely new to hack club/ }).check();
  await page.getByRole("checkbox", { name: /only ask for financial aid once/ }).check();
  await page.getByRole("checkbox", { name: /team behind the idea/ }).check();
  await page.getByRole("button", { name: "Submit application" }).click();
}

export async function signOut(page: Page) {
  await page.goto("/submissions");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
}
