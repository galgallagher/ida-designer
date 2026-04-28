/**
 * POST /api/liveblocks-auth
 *
 * Issues a Liveblocks session token for the authenticated user.
 * Enforces that the requested room belongs to the user's studio:
 * rooms are named canvas-{studioId}-{canvasId}, and we verify the
 * studioId segment matches the user's current studio before granting access.
 */

import { NextResponse } from "next/server";
import { Liveblocks } from "@liveblocks/node";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY!,
});

const USER_COLORS = [
  "#E63946", "#2A9D8F", "#457B9D", "#E9C46A",
  "#F4A261", "#A8DADC", "#6A4C93", "#1982C4",
];

function stableColor(userId: string): string {
  const hash = [...userId].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return USER_COLORS[hash % USER_COLORS.length];
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studioId = await getCurrentStudioId();
  if (!studioId) {
    return NextResponse.json({ error: "No studio context" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { room?: string } | null;
  const room = body?.room;
  if (!room) {
    return NextResponse.json({ error: "Missing room" }, { status: 400 });
  }

  // Enforce studio isolation: room must start with canvas-{studioId}-
  if (!room.startsWith(`canvas-${studioId}-`)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const displayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email ??
    "Studio user";

  const session = liveblocks.prepareSession(user.id, {
    userInfo: {
      name: displayName,
      color: stableColor(user.id),
    },
  });

  session.allow(room, session.FULL_ACCESS);

  const { status, body: responseBody } = await session.authorize();
  return new NextResponse(responseBody, { status });
}
