/**
 * System-defined schedule type definitions.
 *
 * These are the built-in schedule classifications. Import from here rather
 * than from page.tsx files (Next.js prohibits non-page named exports from
 * page.tsx).
 */

export const SYSTEM_SCHEDULES: { type: string; label: string }[] = [
  { type: "ffe",              label: "FF&E" },
  { type: "joinery",         label: "Joinery" },
  { type: "ironmongery",     label: "Ironmongery" },
  { type: "sanitaryware",    label: "Sanitaryware" },
  { type: "arch_id_finishes", label: "Arch ID Finishes" },
  { type: "joinery_finishes", label: "Joinery Finishes" },
  { type: "ffe_finishes",    label: "FF&E Finishes" },
];

export const SYSTEM_TYPE_SET = new Set(SYSTEM_SCHEDULES.map((s) => s.type));

export const SYSTEM_LABEL_MAP = new Map(SYSTEM_SCHEDULES.map((s) => [s.type, s.label]));
