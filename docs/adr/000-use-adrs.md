# ADR 000 — Use Architecture Decision Records

**Status:** Accepted  
**Date:** 2026-04-08

## Context

Ida Designer is a product that will grow over time. Decisions made early — about the database schema, authentication approach, UI patterns, multi-tenancy model — will have long-lasting effects. Without a record of *why* we made each decision, future developers (or the same developer a year later) will waste time relitigating settled questions or unknowingly breaking assumptions.

## Decision

We will maintain Architecture Decision Records (ADRs) in `docs/adr/`. Every significant architectural, data model, or technology pattern decision must have a corresponding ADR file.

**What qualifies as significant:**
- Technology or library choices (framework, database, auth provider)
- Database schema decisions (table structure, relationships, tenancy model)
- Security decisions (how secrets are handled, RLS policies approach)
- UI patterns that will be reused across the app

**Format:**
- Files are numbered sequentially: `000-use-adrs.md`, `001-tech-stack.md`, etc.
- Each file contains: Status, Date, Context, Decision, Consequences
- Status is one of: Proposed / Accepted / Deprecated / Superseded

## Consequences

- There is a small overhead to writing an ADR for each decision.
- The codebase becomes much easier to navigate and change safely, especially as the team grows.
- New contributors can understand *why* the code is the way it is, not just *what* it does.
