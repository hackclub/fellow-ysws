import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Accordion } from "@/components/Accordion";
import { Button, Checkbox, Field, Panel, PhotoStrip, TextArea, TextLink } from "@/components/ui";
import { devPagesEnabled } from "@/lib/test-mode";

const swatches = [
  "--topbar", "--ink", "--ink-muted", "--panel", "--line", "--accent", "--cta-from", "--cta-to", "--danger",
];

export default async function Styleguide() {
  await connection();
  if (!devPagesEnabled()) notFound();
  return (
    <main className="container page">
      <h1>Styleguide™.</h1>
      <section className="stack">
        <h2>Type</h2>
        <p style={{ fontSize: "var(--text-xl)" }} className="caps">Apply to Fellows Fund™.</p>
        <p className="lede">ten weeks. nine online, one in san francisco. three steps to get in the pile.</p>
        <p className="muted small">still missing: a project name, your idea, a pitch video.</p>
      </section>
      <section className="stack">
        <h2>Color</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {swatches.map((s) => (
            <div key={s} className="small" style={{ width: 96 }}>
              <div style={{ height: 40, background: `var(${s})`, border: "1px solid var(--line)" }} />
              {s}
            </div>
          ))}
        </div>
      </section>
      <section className="stack narrow">
        <h2>Controls</h2>
        <Field label="Project name" placeholder="something short" />
        <Field label="Code URL" defaultValue="gitlab.com/x" error="must be a GitHub repository" />
        <TextArea label="The idea, in one sentence" placeholder="it's like… but for…" hint="keep it short." />
        <Checkbox defaultChecked>charge 2 hours per person on the team to this application.</Checkbox>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <Button>Pay 2 hours &amp; submit</Button>
          <Button disabled>Pay 6 hours &amp; submit</Button>
          <Button variant="quiet">Cancel</Button>
        </div>
        <p>
          <TextLink>Start recording</TextLink> <span className="muted">or</span> <TextLink tone="accent" href="#">Upload a video</TextLink>
        </p>
        <Panel>
          <div className="panel-row">
            <span>Application fee</span>
            <span>2 hours</span>
          </div>
        </Panel>
      </section>
      <section className="stack">
        <h2>Accordion</h2>
        <Accordion entries={[{ question: "What is Fellows Fund™?", answer: <p>An answer.</p> }]} />
      </section>
      <section className="stack">
        <h2>Photo strip</h2>
        <PhotoStrip photos={Array.from({ length: 8 }, (_, i) => ({ alt: `Fellow ${i + 1}` }))} />
      </section>
    </main>
  );
}
