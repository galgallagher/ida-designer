/**
 * Finish Palette — /settings/finishes
 *
 * Studio-wide finish code management. Finishes are reusable across all
 * projects and can be assigned to drawings. They are not project-scoped.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import AppShell from "@/components/AppShell";
import FinishesClient from "./FinishesClient";

export default async function FinishesPage() {
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) redirect("/settings");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: finishesData } = await supabase
    .from("studio_finishes")
    .select("*")
    .eq("studio_id", studioId)
    .order("code");

  return (
    <AppShell>
      <FinishesClient finishes={finishesData ?? []} />
    </AppShell>
  );
}
