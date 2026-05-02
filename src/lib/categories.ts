import type { LibraryCategoryRow } from "@/types/database";

/**
 * Builds a human-readable label for a spec category.
 * Returns "Parent · Child" for sub-categories, or just "Parent" for top-level.
 * Returns null if the category ID isn't found.
 */
export function getCategoryLabel(
  catId: string | null,
  categories: LibraryCategoryRow[]
): string | null {
  if (!catId) return null;
  const cat = categories.find((c) => c.id === catId);
  if (!cat) return null;
  if (cat.parent_id) {
    const parent = categories.find((c) => c.id === cat.parent_id);
    return parent ? `${parent.name} · ${cat.name}` : cat.name;
  }
  return cat.name;
}
