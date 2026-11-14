"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLinks, type NavItem } from "./NavLinks";

/** The site header, or the admissions-office header inside the applicant portal. */
export function SiteHeader({ items }: { items: NavItem[] }) {
  const path = usePathname();
  if (path === "/submissions" || path.startsWith("/submissions/")) {
    return (
      <header className="container site-header portal-header">
        <Link href="/submissions" className="portal-office">
          <span className="portal-office-of">Hack Club office of</span>
          <span className="portal-office-name">FELLOWS FUND™ Admissions</span>
        </Link>
        <Link href="/" className="text-link muted">
          ← Return to FELLOWS FUND™
        </Link>
      </header>
    );
  }
  return (
    <header className="container site-header">
      <Link href="/" className="site-name">
        Hack Club Fellows Fund™
      </Link>
      <NavLinks items={items} />
    </header>
  );
}
