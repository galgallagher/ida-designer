# ADR 014 — Ida AI Design Assistant Architecture

**Status:** Accepted  
**Date:** 2026-04-11

## Context

We want a persistent AI assistant called Ida that lives in the app at all times and can help studio teams with tasks — starting with extracting product specs from supplier URLs. Ida needs to:

- Be present on every page, always aware of page context
- Perform multi-step agentic tasks (scrape → identify → extract → save)
- Be extensible — new skills added without restructuring the whole system
- Be configurable by the studio owner without touching code
- Never expose the Anthropic API key to the browser

## Decision

### Widget

A floating chat bubble (bottom-right) rendered once in `AppShell.tsx`. Uses the Vercel AI SDK `useChat` hook. Sends `pathname` and relevant page context as metadata with every message. Streams Claude's responses token by token.

### API Route

`/api/ida/route.ts` — single server-side endpoint. Receives messages + context. Assembles system prompt + relevant tools for the current page. Calls Claude via `@ai-sdk/anthropic`. Returns a streaming response.

### Skill Architecture

Each skill lives in `src/lib/ida/skills/*.ts` and exports:
- `tool` — the Vercel AI SDK tool definition (name, description, Zod parameter schema)  
- `handler` — the server-side function that executes when Claude calls the tool

The route assembles skills based on page context. Claude decides when to call them. Skills can call each other's handlers directly (e.g. `scrape-spec` skill can call `create-category` handler).

```
src/lib/ida/
  skills/
    scrape-spec.ts
    create-category.ts
    save-spec.ts
  context.ts        — builds the context object from pathname + DB queries
  system-prompt.ts  — Ida's persona, tone, constraints
  tools.ts          — assembles tool list by page
src/app/api/ida/
  route.ts
```

### Scraping Pipeline

1. URL received in `scrape-spec` tool handler
2. **Jina Reader** (`https://r.jina.ai/{url}`) fetches page as clean Markdown — handles JS-rendered pages, free
3. Markdown + studio categories passed to **Claude Haiku** for structured extraction (cheapest model, fast)
4. Image URLs extracted from Jina output, filtered by cheap heuristics (no SVG, no tiny icons, no logos)
5. Up to 8 candidate images returned; Claude suggests likely primary based on URL/alt text
6. User picks image in chat UI, reviews extracted fields, confirms → `save-spec` tool writes to DB

### Category Matching

Studio categories always injected into the system prompt at scrape time. If the identified category doesn't match any existing one, Ida proposes creating it and calls `create-category` tool after user confirmation.

### Collections

Not built now. The DB can absorb a `spec_collections` table later (add `collection_id` FK to `specs`) with no breaking changes. For now, collection name stored as a tag.

### Config Page

`/settings/ida` — owner-only page to view and edit skill system prompts, enable/disable skills, see token usage per skill. Built after the core skills are working. Gives Gal control over Ida's behaviour without touching code.

### Model Strategy

| Use | Model | Reason |
|---|---|---|
| Conversation | Claude Sonnet | Natural, warm, good reasoning |
| Extraction | Claude Haiku | Structured JSON, cheap, fast |
| Tool calls | Haiku or Sonnet depending on complexity | |

## Consequences

- **Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`) added as dependencies — well-maintained, streaming built in, tool-calling support, `useChat` hook
- `ANTHROPIC_API_KEY` is server-only, never `NEXT_PUBLIC_`
- Skills are independently testable — each handler is just an async function
- Config page deferred but planned — prompts are hardcoded strings initially, designed to be extracted to DB later
- Jina Reader is free but rate-limited for heavy use — Firecrawl is the upgrade path
