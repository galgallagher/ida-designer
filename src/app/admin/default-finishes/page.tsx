import { createClient } from "@/lib/supabase/server";
import DefaultFinishesClient from "./DefaultFinishesClient";
import type { DefaultFinishRow } from "@/types/database";

export default async function DefaultFinishesAdminPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("default_finishes")
    .select("*")
    .order("category")
    .order("sort_order");

  const finishes = (data ?? []) as DefaultFinishRow[];

  return <DefaultFinishesClient finishes={finishes} />;
}
