# ADR 015 — Spec Search: Vision Tags + Natural Language Search via Ida

**Status:** Accepted  
**Date:** 2026-04-11

## Context

The spec library had visible tag pills on every spec card and in the detail panel. These were decorative and noisy (the screenshot showed `source:https://...` URLs leaking into the UI, plus generic LLM-extracted tags like "interior design", "sophisticated design" that added no value to a user browsing specs).

Two related problems existed:
1. Tags were cluttering the UI without giving users a clear way to act on them
2. Search was a client-side string match with no understanding of natural language — "blue fabric, 100cm wide, geometric" would not find anything useful

## Decision

### Tags become an invisible search index

Tags are removed from all UI surfaces (spec detail modal, standalone spec page, list row pills, sidebar filter). They remain in `spec_tags` as before — no schema change — but serve only as a search index that Ida queries internally.

### Visual tag extraction at save time

When a user saves a spec with an image, `extractVisualTags()` runs Claude Haiku vision on the chosen image and appends structured lowercase tags covering:
- Colour (specific: "dusty rose", "charcoal", "ivory")
- Pattern ("geometric", "plain", "herringbone")
- Texture ("woven", "pile", "bouclé", "smooth")
- Material appearance ("fabric", "marble", "leather")
- Style feel ("contemporary", "natural", "minimal")

This runs at **save time, not scrape time** — because the user selects one image from up to 8 candidates, so we only analyse the image they actually chose. Maximum 8 tags returned; falls back silently on error.

### Natural language search via `searchSpecs` Ida skill

A new `searchSpecsTool` skill lets Ida translate natural language queries into structured criteria:
- `colors`, `patterns`, `materials`, `styles`, `uses` — matched against spec_tags
- `keywords` — text search against name/description
- `width_min_cm` / `width_max_cm` — parsed from spec_field_values
- `martindale_min` — parsed from spec_field_values
- `category_name` — hard filter

Scoring: +3 per matched tag, +2 for name keyword match, +2 for width/martindale in range, +1 for description match. Results sorted by score and returned as structured data for Ida to present conversationally.

This deliberately avoids raw NL→SQL translation (fragile and SQL injection risk). Claude Sonnet extracts structured intent; the tool builds safe parameterised queries.

### `maxSteps` stays at 5 in the streaming endpoint

Search results can sometimes trigger a follow-up (e.g. "here are the results, want me to add one?") within the same conversation turn. The existing `maxSteps: 5` handles this.

## Consequences

- Tags are now richer and more useful (visual + LLM-extracted) but completely hidden from the UI
- Existing specs without visual tags continue to work — search will just match on LLM-extracted tags only
- The Martindale / width field search depends on those values being stored in `spec_field_values` — if a supplier page didn't list them, they won't be searchable by those criteria
- Cost per save increases by ~£0.002 for the Haiku vision call (negligible)
- The sidebar tag filter is removed; browsing is now via category/supplier filters + Ida search
