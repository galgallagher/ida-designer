/**
 * Login Page — Server Component
 *
 * Renders the split-panel login screen matching the Ida Designer visual design.
 * The actual form interaction is handled by LoginForm.tsx (a Client Component).
 *
 * Layout:
 * ┌──────────────────┬──────────────────────────────┐
 * │  Left panel      │  Right panel                 │
 * │  520px           │  flex-1                      │
 * │  Dark + photo bg │  Light grey, centred card    │
 * │  Logo + tagline  │  Login form                  │
 * └──────────────────┴──────────────────────────────┘
 */

import { Playfair_Display, Inter } from "next/font/google";
import LoginForm from "./LoginForm";

// Load fonts — these are subset and optimised by Next.js automatically
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-playfair",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

export default function LoginPage() {
  return (
    <div
      className={`${playfair.variable} ${inter.variable} flex min-h-screen`}
      style={{ fontFamily: "var(--font-inter), sans-serif" }}
    >
      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      {/* Dark background with a warm gradient simulating an interior photo */}
      <div
        className="hidden lg:flex flex-col justify-between p-10 relative overflow-hidden"
        style={{
          width: "520px",
          flexShrink: 0,
          background:
            "linear-gradient(160deg, #2C2118 0%, #1F1812 40%, #1A1A1A 100%)",
        }}
      >
        {/* Subtle warm texture overlay */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              radial-gradient(ellipse at 20% 50%, rgba(180, 120, 60, 0.3) 0%, transparent 60%),
              radial-gradient(ellipse at 80% 20%, rgba(120, 80, 40, 0.2) 0%, transparent 50%)
            `,
          }}
          aria-hidden="true"
        />

        {/* Top-left: Logo mark + wordmark */}
        <div className="relative z-10 flex items-center gap-3">
          {/* Yellow "i" square logo mark */}
          <div
            className="flex items-center justify-center rounded"
            style={{
              width: 36,
              height: 36,
              backgroundColor: "#FFDE28",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-playfair), serif",
                fontSize: 20,
                fontWeight: 600,
                color: "#1A1A1A",
                lineHeight: 1,
              }}
            >
              i
            </span>
          </div>
          {/* Wordmark */}
          <span
            className="text-white text-sm font-medium tracking-wide"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            Ida Designer
          </span>
        </div>

        {/* Bottom-left: Tagline */}
        <div className="relative z-10 space-y-3">
          <h2
            className="text-white leading-tight"
            style={{
              fontFamily: "var(--font-playfair), serif",
              fontSize: 42,
              fontWeight: 400,
              letterSpacing: "-0.02em",
            }}
          >
            Your studio,
            <br />
            organised.
          </h2>
          <p
            className="text-sm leading-relaxed max-w-xs"
            style={{ color: "#9A9590" }}
          >
            Manage clients, projects, drawings, and specifications — all in one
            beautifully considered place.
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col items-center justify-center p-6"
        style={{ backgroundColor: "#F7F6F4" }}
      >
        {/* Mobile-only logo (shown when left panel is hidden) */}
        <div className="lg:hidden flex items-center gap-2 mb-10">
          <div
            className="flex items-center justify-center rounded"
            style={{ width: 32, height: 32, backgroundColor: "#FFDE28" }}
          >
            <span
              style={{
                fontFamily: "var(--font-playfair), serif",
                fontSize: 18,
                fontWeight: 600,
                color: "#1A1A1A",
              }}
            >
              i
            </span>
          </div>
          <span
            className="text-sm font-medium text-[#1A1A1A] tracking-wide"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            Ida Designer
          </span>
        </div>

        {/* White login card */}
        <div
          className="w-full max-w-sm bg-white shadow-sm p-8 space-y-6"
          style={{ borderRadius: 14 }}
        >
          {/* Card header */}
          <div className="space-y-1">
            <h1
              className="text-[#1A1A1A]"
              style={{
                fontFamily: "var(--font-playfair), serif",
                fontSize: 28,
                fontWeight: 500,
                letterSpacing: "-0.01em",
              }}
            >
              Welcome back
            </h1>
            <p
              className="text-sm"
              style={{
                color: "#9A9590",
                fontFamily: "var(--font-inter), sans-serif",
              }}
            >
              Sign in to your studio workspace
            </p>
          </div>

          {/* The actual form — client component for interactivity */}
          <LoginForm />
        </div>

        {/* Footer note */}
        <p
          className="mt-8 text-xs text-center"
          style={{ color: "#9A9590", fontFamily: "var(--font-inter), sans-serif" }}
        >
          No studio account?{" "}
          <a
            href="mailto:hello@idadesigner.com"
            className="font-medium hover:text-[#1A1A1A] transition-colors"
            style={{ color: "#1A1A1A" }}
          >
            Contact Ida Designer →
          </a>
        </p>
      </div>
    </div>
  );
}
