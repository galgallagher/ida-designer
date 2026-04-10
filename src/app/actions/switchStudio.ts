"use server";

/**
 * switchStudio — Server Action
 *
 * Sets the current_studio_id cookie and redirects to /clients.
 * Called from the StudioSwitcher client component.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function switchStudio(studioId: string) {
  const cookieStore = await cookies();
  cookieStore.set("current_studio_id", studioId, {
    httpOnly: false, // readable client-side for the switcher UI
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  redirect("/clients");
}
