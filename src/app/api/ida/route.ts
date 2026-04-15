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
import { anthropic } from "@ai-sdk/anthropic";
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
        .from("spec_categories")
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
  });

  return result.toDataStreamResponse();
}
