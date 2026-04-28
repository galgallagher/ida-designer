"use client";

import { useState, useTransition } from "react";
import { updateProjectCurrency } from "./actions";

const OPTIONS: { code: string; label: string }[] = [
  { code: "GBP", label: "GBP — British Pound" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "CHF", label: "CHF — Swiss Franc" },
  { code: "JPY", label: "JPY — Japanese Yen" },
  { code: "AED", label: "AED — UAE Dirham" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "HKD", label: "HKD — Hong Kong Dollar" },
  { code: "NZD", label: "NZD — New Zealand Dollar" },
  { code: "SEK", label: "SEK — Swedish Krona" },
  { code: "NOK", label: "NOK — Norwegian Krone" },
  { code: "DKK", label: "DKK — Danish Krone" },
  { code: "ZAR", label: "ZAR — South African Rand" },
];

export default function CurrencyField({
  projectId,
  current,
}: {
  projectId: string;
  current: string;
}) {
  const [value, setValue] = useState(current);
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function handleChange(next: string) {
    setValue(next);
    startTransition(async () => {
      const { error } = await updateProjectCurrency(projectId, next);
      if (error) {
        alert(error);
        setValue(current);
      } else {
        setSavedAt(Date.now());
      }
    });
  }

  return (
    <div style={{ backgroundColor: "#FFFFFF", borderRadius: 10, padding: "14px 16px", boxShadow: "0 1px 6px rgba(26,26,26,0.06)" }}>
      <label
        htmlFor="project-currency"
        style={{
          display: "block",
          fontFamily: "var(--font-inter), sans-serif",
          fontSize: 11,
          fontWeight: 600,
          color: "#9A9590",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          marginBottom: 6,
        }}
      >
        Currency
      </label>
      <select
        id="project-currency"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        style={{
          width: "100%",
          fontFamily: "var(--font-inter), sans-serif",
          fontSize: 14,
          color: "#1A1A1A",
          backgroundColor: "#FFFFFF",
          border: "1px solid #E4E1DC",
          borderRadius: 8,
          padding: "8px 10px",
        }}
      >
        {OPTIONS.map((o) => (
          <option key={o.code} value={o.code}>{o.label}</option>
        ))}
      </select>
      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#C0BEBB", marginTop: 6 }}>
        Used for prices and totals on the project schedule.
        {savedAt && <span style={{ color: "#22C55E", marginLeft: 6 }}>Saved.</span>}
      </p>
    </div>
  );
}
