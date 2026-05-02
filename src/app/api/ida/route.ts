/**
 * /api/ida — Ida AI Design Assistant streaming endpoint
 *
 * Security:
 *   - ANTHROPIC_API_KEY is server-only (no NEXT_PUBLIC_ prefix)
 *   - User must be authenticated — unauthenticated requests are rejected
 *   - Studio context resolved server-side from session cookie
 *
 * Architecture:
 *   - Uses Vercel AI SDK v4 streamText with multi-step tool calling
 *   - Claude Sonnet handles conversation; Haiku is used inside tool handlers for extraction
 *   - Skills (tools) assembled here; see src/lib/ida/skills/
 */

import { streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";
import { buildSystemPrompt } from "@/lib/ida/system-prompt";
import { scrapeSpecTool } from "@/lib/ida/skills/scrape-spec";
import { createCategoryTool } from "@/lib/ida/skills/create-category";
import { saveSpecTool } from "@/lib/ida/skills/save-spec";
import { searchSpecsTool } from "@/lib/ida/skills/search-specs";

export const maxDuration = 60; // Allow up to 60s for scraping + extraction

export async function POST(req: Request) {
  // ── Auth check ─────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorised", { status: 401 });
  }

  // ── Anthropic client (explicit key — auto-detection from process.env is
  // unreliable across Next.js bundling/edge contexts; pass it explicitly so a
  // missing key fails fast and visibly) ─────────────────────────────────────
  // Reject empty-string env values too — some shells (e.g. Claude Code's bash)
  // export ANTHROPIC_API_KEY="" which prevents Next.js from loading the value
  // from .env.local. Treat empty as missing so the failure is visible.
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!anthropicKey) {
    return new Response("ANTHROPIC_API_KEY is not configured", { status: 500 });
  }
  const anthropic = createAnthropic({ apiKey: anthropicKey });

  // ── Parse request ──────────────────────────────────────────────────────
  const body = await req.json() as {
    messages: { role: string; content: string }[];
    context?: { pathname: string; projectId?: string; projectName?: string };
  };

  const { messages, context } = body;

  // ── Build studio context ───────────────────────────────────────────────
  const studioId = await getCurrentStudioId();
  let studioName = "your studio";
  let categoryNames: string[] = [];
  let userName: string | undefined;

  if (studioId) {
    const [{ data: studio }, { data: categories }, { data: profile }] = await Promise.all([
      supabase.from("studios").select("name").eq("id", studioId).single(),
      supabase
        .from("library_categories")
        .select("name")
        .eq("studio_id", studioId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase.from("profiles").select("first_name").eq("id", user.id).single(),
    ]);

    if (studio?.name) studioName = studio.name;
    if (categories) categoryNames = categories.map((c) => c.name);
    if (profile?.first_name) userName = profile.first_name;
  }

  const systemPrompt = buildSystemPrompt({
    pathname: context?.pathname ?? "/",
    studioName,
    categoryNames,
    userName,
    projectId: context?.projectId,
    projectName: context?.projectName,
  });

  // ── Stream response ──────────────────────────────────────────────────
  const result = streamText({
    model: anthropic("claude-sonnet-4-5-20250929"),
    system: systemPrompt,
    messages: messages as Parameters<typeof streamText>[0]["messages"],
    tools: {
      scrapeSpec: scrapeSpecTool(categoryNames),
      createCategory: createCategoryTool(),
      saveSpec: saveSpecTool(),
      searchSpecs: searchSpecsTool(),
    },
    maxSteps: 5,
    // Surface streaming errors to server logs — the AI SDK swallows these by
    // default and the client only ever sees the generic "An error occurred".
    onError({ error }) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      console.error("[/api/ida] streamText error:", message, "\n", stack);
    },
  });

  // Include real error messages in the stream so Ida's widget shows something
  // meaningful instead of the generic chip. Fine for dev + alpha; revisit for
  // production to avoid leaking internal details.
  return result.toDataStreamResponse({
    getErrorMessage(error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Ida hit an error: ${message}`;
    },
  });
}
