/**
 * Finishes Library — /finishes
 *
 * Studio-owned reference library of standard architectural materials
 * (wood, stone, metal, glass, concrete & plaster). Pre-seeded with ~50
 * standard materials. Studios can add, rename, re-image, and delete entries.
 *
 * Distinct from the drawing finish codes palette at /settings/finishes.
 */

import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import AppShell from "@/components/AppShell";
import FinishesClient from "./FinishesClient";
import type { StudioMaterialRow } from "@/types/database";

export default async function FinishesLibraryPage() {
  const supabase  = await createClient();
  const studioId  = await getCurrentStudioId();

  if (!studioId) {
    return (
      <AppShell>
        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}>
          No studio found.
        </p>
      </AppShell>
    );
  }

  const { data } = await supabase
    .from("studio_materials")
    .select("*")
    .eq("studio_id", studioId)
    .order("category")
    .order("sort_order");

  const materials = (data ?? []) as StudioMaterialRow[];

  return (
    <AppShell>
      <FinishesClient materials={materials} studioId={studioId} />
    </AppShell>
  );
}
