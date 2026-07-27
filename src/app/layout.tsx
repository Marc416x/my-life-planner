import type { Metadata } from "next";
import { Caveat, Nunito } from "next/font/google";
import "./globals.css";
// Original prototype styling, font-adapted (DM Sans/Nunito → Nunito, Caveat kept).
// This is what preserves the original look; imported after globals so it wins.
import "@/styles/legacy/base.css";
import "@/styles/legacy/themes.css";
import "@/styles/legacy/responsive.css";
import "@/styles/legacy/auth.css";
import { AppShell } from "@/components/app-shell";
import { ThemeInit } from "@/components/theme-init";
import { ProfileProvider } from "@/components/profile-provider";
import { ToastProvider } from "@/components/toast-provider";

// Body sans — rounded, friendly, readable. Populates --font-sans (the default body font).
const nunito = Nunito({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// Handwritten accent — for numbers, streaks, and levels (as in the original).
// Populates --font-caveat (used via the `font-accent` utility).
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MyLifePlanner — Nursing Academic OS",
  description:
    "The academic operating system for nursing students: planner, NCLEX tracker, drug tracker, GPA, and clinical hours — all in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="mode-light font-sans">
        <ThemeInit />
        <ToastProvider>
          <ProfileProvider>
            <AppShell>{children}</AppShell>
          </ProfileProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
