import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata = { title: "Review — Hack Club Fellows Fund™", robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <main className="container page" style={{ gap: 28 }}>
      <nav aria-label="Review" style={{ display: "flex", gap: 16 }} className="small">
        <Link href="/admin" className="text-link">Applications</Link>
        <Link href="/admin/funnel" className="text-link">Funnel</Link>
      </nav>
      {children}
    </main>
  );
}
