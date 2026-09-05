import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc/client";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Watchtower",
  description: "Local on-chain intelligence console"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body><TRPCProvider><div className="min-h-screen md:flex">
        <aside className="w-full border-b border-slate-800 bg-slate-950 p-5 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
          <Link href="/" className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">Watchtower</Link>
          <nav aria-label="Primary navigation" className="mt-6 grid gap-2 text-sm text-slate-400">
            {["/", "/wallets", "/graph", "/radar", "/alerts", "/self", "/tokens", "/settings", "/health"].map((href) => <Link key={href} href={href} className="block rounded px-2 py-1.5 hover:bg-slate-900 hover:text-slate-100">{href === "/" ? "Dashboard" : href.slice(1).replace(/^./, (letter) => letter.toUpperCase())}</Link>)}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div></TRPCProvider></body>
    </html>
  );
}
