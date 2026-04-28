/**
 * Liveblocks client configuration and typed room context for the project canvas.
 *
 * Presence: cursor position + display info for each connected user.
 * Storage:  all tldraw records (shapes, pages, bindings, assets) as a LiveMap.
 *
 * Room naming: canvas-{studioId}-{canvasId}
 * Auth is enforced in /api/liveblocks-auth — only studio members can access
 * rooms belonging to their studio.
 */

import { createClient, LiveMap, type JsonObject } from "@liveblocks/client";
export type { JsonObject };
import { createRoomContext } from "@liveblocks/react";

const client = createClient({
  authEndpoint: "/api/liveblocks-auth",
});

export type Presence = {
  cursor: { x: number; y: number } | null;
  name: string;
  color: string;
};

// TLRecord doesn't satisfy Liveblocks' Lson constraint (no index signature),
// so we store records as JsonObject and cast to/from TLRecord at the usage points.
export type Storage = {
  records: LiveMap<string, JsonObject>;
};

export { LiveMap };

export const {
  RoomProvider,
  useStorage,
  useMutation,
  useMyPresence,
  useOthers,
} = createRoomContext<Presence, Storage>(client);
