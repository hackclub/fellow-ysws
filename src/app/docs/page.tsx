import Link from "next/link";
import { DocsNav } from "@/components/docs/DocsNav";
import { docSections } from "@/content/docs";

// Public: no auth guard, and nothing here reads the session.
export const metadata = {
  title: "Docs — Hack Club Fellows Fund™",
  description: "How Fellows Fund™ works, from Hackatime and the fee of 2 hours per person (paid by you, or by each teammate) to what happens after you apply.",
};

export default function DocsPage() {
  const nav = docSections.map(({ id, label }) => ({ id, label }));
  return (
    <main className="container docs page">
      <DocsNav items={nav} />
      <div className="docs-body">
        <header className="stack-sm">
          <h1>The docs.</h1>
          <p className="lede muted">everything about Fellows Fund™, one bite at a time.</p>
        </header>

        {docSections.map((s) => (
          <section key={s.id} id={s.id} className="doc-section" aria-labelledby={`${s.id}-title`}>
            <h2 id={`${s.id}-title`}>
              <a href={`#${s.id}`} className="doc-anchor">
                {s.title}
              </a>
            </h2>
            {s.body}
          </section>
        ))}

        <section className="doc-section doc-cta" aria-label="Apply">
          <h2>Ready?</h2>
          <div className="doc-cta-row">
            <Link href="/apply" className="button">
              Apply to FELLOWS FUND™
            </Link>
            <Link href="/#faq" className="text-link small">
              More questions? Read the FAQ
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
