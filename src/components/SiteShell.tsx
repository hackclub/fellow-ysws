import type { ReactNode } from "react";
import type { NavItem } from "./NavLinks";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function navItems(isAdmin: boolean): NavItem[] {
  const items: NavItem[] = [
    { href: "/apply", label: "Apply" },
    { href: "/submissions", label: "Submissions" },
    { href: "/#faq", label: "FAQ" },
  ];
  if (isAdmin) items.push({ href: "/admin", label: "Review" });
  return items;
}

export function SiteShell({ isAdmin, children }: { isAdmin: boolean; children: ReactNode }) {
  return (
    <>
      <SiteHeader items={navItems(isAdmin)} />
      {children}
      <SiteFooter />
    </>
  );
}
