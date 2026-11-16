"use client";

import { useEffect, useRef, useState } from "react";

export type DocsNavItem = { id: string; label: string };

/**
 * Docs table of contents. A sticky sidebar on wide screens, a sticky scrolling strip on phones.
 * Highlights the section currently being read.
 */
export function DocsNav({ items }: { items: DocsNavItem[] }) {
  const [active, setActive] = useState(items[0]?.id);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const sections = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => !!el);
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        // The first section (in page order) inside the reading band wins.
        const first = items.find((i) => visible.has(i.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-15% 0px -60% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [items]);

  // On phones the strip scrolls sideways: keep the active link in view without moving the page.
  useEffect(() => {
    const list = listRef.current;
    const link = list?.querySelector<HTMLElement>(`a[href="#${active}"]`);
    if (!list || !link || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: link.offsetLeft - 16, behavior: "smooth" });
  }, [active]);

  return (
    <nav className="docs-nav" aria-label="Docs">
      <p className="docs-nav-title">On this page</p>
      <ol ref={listRef}>
        {items.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              aria-current={active === i.id ? "location" : undefined}
              onClick={() => setActive(i.id)}
            >
              {i.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
