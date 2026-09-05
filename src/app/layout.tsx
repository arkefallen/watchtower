import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc/client";
import { Sidebar } from "@/components/layout/Sidebar";

const geistSans = localFont({
  src: "../../public/fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "../../public/fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Watchtower | Onchain Intelligence Console",
  description: "Local, privacy-first EVM surveillance and recursive funding analysis console",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <body className="bg-[#101214] text-[#E8ECEF] min-h-screen antialiased selection:bg-[#D7A84B] selection:text-[#101214]">
        <TRPCProvider>
          <div className="min-h-screen flex flex-col md:flex-row bg-[#101214]">
            <Sidebar />
            <div className="min-w-0 flex-1 flex flex-col min-h-screen md:pl-60">
              {children}
            </div>
          </div>
        </TRPCProvider>
      </body>
    </html>
  );
}
