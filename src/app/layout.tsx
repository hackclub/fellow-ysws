import type { Metadata } from "next";
import { Instrument_Serif, Pinyon_Script } from "next/font/google";
import { SiteShell } from "@/components/SiteShell";
import { getCurrentUser } from "@/lib/auth/session";
import "./globals.css";

const serif = Instrument_Serif({
  variable: "--font-instrument",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const script = Pinyon_Script({
  variable: "--font-script",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hack Club Fellows Fund™",
  description: "We back teenage hackers like you. Ten weeks, nine online, one in San Francisco.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className={`${serif.variable} ${script.variable}`}>
      <body>
        <SiteShell isAdmin={!!user?.isAdmin}>{children}</SiteShell>
      </body>
    </html>
  );
}
