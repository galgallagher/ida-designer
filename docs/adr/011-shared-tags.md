# ADR 011 — Free-Form Tags as Shared Vocabulary

**Status:** Accepted  
**Date:** 2026-04-10

## Context

Both specs and contacts need tagging. Tags let studios find things that cut across formal categories — e.g. "sustainable", "UK supplier", "premium", "project:mayfair". 

Two approaches were considered:

**Option A — Predefined taxonomy:** A `tags` table with fixed options. Studios pick from a list. Clean, consistent, but requires upfront work to define and rigid to maintain.

**Option B — Free-form strings:** Tags are just text stored alongside the record. Studios type whatever they want. A shared vocabulary emerges naturally as they reuse the same words.

## Decision

**Free-form strings, with autocomplete from existing usage.**

- `spec_tags`: `(spec_id, tag)` — one row per tag per spec
- `contact_tags`: `(company_id, tag)` — one row per tag per company
- No foreign key to a tags dictionary table — the string itself is the identity

**Autocomplete** pulls from the studio's existing tag pool:
- For contacts: `SELECT DISTINCT tag FROM contact_tags WHERE company_id IN (SELECT id FROM contact_companies WHERE studio_id = ?)` 
- This surfaces every tag the studio has ever used, so a shared vocabulary emerges without requiring upfront configuration

**Future:** Specs and contacts could share a single tag pool (autocomplete from both `spec_tags` and `contact_tags` combined), enabling queries like "show me all specs and suppliers tagged 'sustainable'". This is not implemented yet but the schema supports it.

## AI scraping integration (future)

When the "Add from URL" AI scraper is built, it will suggest tags based on the product page content. It should:
1. Pull the studio's existing tag vocabulary
2. Match suggested tags to existing ones (to avoid synonyms: "eco" vs "sustainable")
3. Propose new tags for the studio to accept/reject

This is deferred but the free-form model is the right foundation for it.

## Consequences

- No migration required when a new tag type is needed — just use it
- Studios get autocomplete suggestions from their own history — vocabulary is personalised
- Tags are case-sensitive strings — "Sustainable" and "sustainable" are different. Recommend lowercasing on input (not yet enforced in the UI)
- No tag management UI (rename, merge, delete orphans) — acceptable at current scale, needed eventually
- Deleting a spec/company cascades to its tags (FK with ON DELETE CASCADE)
