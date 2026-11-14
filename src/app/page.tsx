import Link from "next/link";
import { Accordion } from "@/components/Accordion";
import { Panel, PhotoStrip } from "@/components/ui";
import { faq, howItWorks, whyFellows } from "@/content/landing";
import { recordVisit } from "@/lib/funnel";

const photos = Array.from({ length: 5 }, (_, i) => ({
  src: `/fellows/fellow-${i + 1}.webp`,
  alt: `Fellow photo ${i + 1}`,
}));

export default async function Home() {
  await recordVisit();
  return (
    <main className="container page">
      <PhotoStrip photos={photos} />

      <h1>
        We back teenage hackers like <em>you</em>.
      </h1>

      <section className="stack" aria-labelledby="why">
        <h2 id="why">Why Fellows?</h2>
        <ul className="bullets">
          {whyFellows.map((line) => (
            <li key={line}>{line}</li>
          ))}
          <li>
            <a href="#faq" className="text-link accent">
              Fellows Fund™
            </a>
          </li>
        </ul>
        <div>
          <Link href="/apply" className="button">
            Apply to FELLOWS FUND™
          </Link>
        </div>
      </section>

      <section className="stack" aria-labelledby="how">
        <h2 id="how">How it works:</h2>
        <ol className="cards" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {howItWorks.map((step) => (
            <li key={step.eyebrow}>
              <Panel className="card">
                <span className="card-eyebrow">{step.eyebrow}</span>
                <span className="card-title">{step.title}</span>
                <p className="small">{step.body}</p>
              </Panel>
            </li>
          ))}
        </ol>
      </section>

      <section className="stack" aria-labelledby="faq-title" id="faq" style={{ scrollMarginTop: 24 }}>
        <h2 id="faq-title">Asked and answered:</h2>
        <Accordion entries={faq} />
      </section>
    </main>
  );
}
