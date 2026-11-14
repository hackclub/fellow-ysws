"use client";

import { useId, useState, type ReactNode } from "react";

export type AccordionEntry = { question: string; answer: ReactNode };

function Item({ entry }: { entry: AccordionEntry }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="accordion-item">
      <h3 style={{ fontSize: "inherit" }}>
        <button
          type="button"
          className="accordion-trigger"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          id={`${id}-trigger`}
          onClick={() => setOpen((o) => !o)}
        >
          <span>{entry.question}</span>
          <span className="accordion-control" aria-hidden="true">
            {open ? "Close" : "Open"}
          </span>
        </button>
      </h3>
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-trigger`}
        className="accordion-panel"
        hidden={!open}
      >
        {entry.answer}
      </div>
    </div>
  );
}

export function Accordion({ entries }: { entries: AccordionEntry[] }) {
  return (
    <div className="accordion">
      {entries.map((e) => (
        <Item key={e.question} entry={e} />
      ))}
    </div>
  );
}
