/**
 * Root Layout
 *
 * This wraps every page in the app. Changes here affect everything.
 *
 * We load two fonts via next/font/google (automatic subsetting + no layout shift):
 *   - Playfair Display: elegant serif for headings and display text
 *   - Inter: clean sans-serif for all UI text
 *
 * Both are exposed as CSS variables so any component can use them via
 * Tailwind's `font-[family-name:var(--font-playfair)]` or inline styles.
 */

import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";

// Playfair Display — headings, display, logo marks
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-playfair",
  display: "swap", // show fallback font while loading, swap when ready
});

// Inter — all body text, labels, buttons, UI copy
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ida Designer",
  description: "SaaS platform for interior design studios",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      {/*
       * We add both font variables to <html> so they're available everywhere.
       * The body uses Inter as the default — headings override with Playfair via
       * inline styles or Tailwind utilities on a per-component basis.
       */}
      <body
        className="antialiased"
        style={{ fontFamily: "var(--font-inter), sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
