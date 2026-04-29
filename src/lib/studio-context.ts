/**
 * studio-context.ts
 *
 * Thin shim over `getUserContext()` (see ADR 029) — kept so existing callers
 * across the codebase don't all need to change their import. New code should
 * call `getUserContext()` directly to also get profile, role, etc. without
 * paying for additional queries (the underlying call is request-cached).
 */

import { getUserContext } from "@/lib/user-context";

export async function getCurrentStudioId(): Promise<string | null> {
  return (await getUserContext()).currentStudioId;
}
