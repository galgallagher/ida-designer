# Ida Designer — Project CLAUDE.md

## What is this project?

A SaaS platform for interior design studios. Studios manage clients, projects, drawings (floor plans), specifications (materials/products), and contacts (suppliers, contractors, consultants). Key feature: interactive drawing viewer with hotspots that link drawings or pin specs to floor plan locations.

**Dev server:** `npm run dev` → http://localhost:3001
**Supabase project:** set `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15, App Router |
| Database | Supabase (Postgres + Auth + RLS + Storage) |
| Auth | Supabase Auth + @supabase/ssr@0.10.2 (cookie sessions) |
| CSS | Tailwind CSS + inline style tokens + shadcn/ui (Radix primitives) |
| Language | TypeScript (strict — zero `as any`, zero `@ts-ignore`) |
| AI | Anthropic Claude via Vercel AI SDK (`src/lib/ida/`) |

## Memory & ADRs — read these first

- **`memory/MEMORY.md`** — full project context, schema, file structure, design tokens, known debt
- **`memory/NEXT-SESSION.md`** — prioritised next steps
- **`docs/adr/`** — 15 ADRs covering every major architectural decision (000–015)

Always read existing ADRs before making architectural changes.

## Key rules for this codebase

### Multi-tenancy
Every table has `studio_id`. RLS enforces studio isolation — never query without it. The helper `auth_user_studio_ids()` is a SECURITY DEFINER function that breaks RLS recursion (see ADR 007).

### TypeScript types
Types live in `src/types/database.ts` — hand-written, do NOT replace with CLI-generated types. Uses `Insertable<T>` pattern for optional nullable columns. See ADR 012.

### Studio context
Always resolve via `getCurrentStudioId()` in `src/lib/studio-context.ts` — reads from cookie server-side.

### Secrets — server only
- `ANTHROPIC_API_KEY` — never `NEXT_PUBLIC_`, never client-side
- `SUPABASE_SERVICE_ROLE_KEY` — server-only
- All AI calls go through `/api/ida/` routes, never directly from the browser

### Modal / panel patterns
All modals use shadcn/Radix primitives (`src/components/ui/`). Do not roll custom modal/dialog/sheet implementations. Escape, backdrop, focus trap, scroll lock all handled automatically. See ADR 006.

### Ida AI assistant
Persistent chat widget in `AppShell`. Skills in `src/lib/ida/skills/`. Each skill is a standalone file exporting a `tool()` definition. Assembled in `/api/ida/route.ts`. See ADR 014.

Current skills: `scrape-spec`, `save-spec`, `create-category`, `search-specs`

Visual tag extraction: `src/lib/ida/extract-visual-tags.ts` — runs Haiku vision at save time on the chosen image.

### Design tokens
```
Background:    #EDEDED    Cards:       #FFFFFF
Yellow CTA:    #FFDE28    Near-black:  #1A1A1A
Secondary:     #9A9590    Muted:       #C0BEBB
Border:        #E4E1DC    Radius:      14px (cards), 8–10px (buttons)
Fonts:         Playfair Display (headings), Inter (UI)
Shadow:        0 2px 12px rgba(26,26,26,0.08)
```

## What NOT to do without planning first

- Drop or rename the `/specs/[id]` standalone page
- Change modal animation patterns
- Merge clients + contacts CRM (intentionally separate — see ADRs 008 + 010)
- Replace hand-written `database.ts` with CLI-generated types
- Add new tables without RLS policies
- Use `NEXT_PUBLIC_` for anything secret
