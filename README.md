# chores

Household chore tracking with a **web-first UI for iPhone and iPad**.

Always-on: **GitHub Pages (UI) + School Compass Supabase (shared data)**.

## Piggyback setup (no new Supabase project)

We reuse the existing **School Compass** Supabase project (same one as
Comparison-tool / [schoolcompass.uk](https://schoolcompass.uk)) because the
free-tier project limit is full. Do **not** use the home_learning project.

### 1. Apply schema (one-time / when schema changes)

1. Open the **School Compass** project in the Supabase dashboard  
2. **SQL → New query**  
3. Paste [`supabase/schema.sql`](supabase/schema.sql) → **Run**

This creates:

| Object | Purpose |
| --- | --- |
| `public.chores` | Legacy flat board (kept for compatibility) |
| `public.people` | Household members |
| `public.task_templates` | Recurring kinds + ordered **steps** + **reference photo** path |
| `public.task_instances` | Open / assigned / done work (self-assign lives here) |
| `public.completion_events` | Completion history + optional **proof photo** (temporary) |
| Storage bucket `chore-photos` | Reference (durable) + proof (TTL) images |

If the Storage bucket insert fails on your plan, create a **public** bucket named
`chore-photos` in **Storage → New bucket** (5 MB, image MIME types).

Until the SQL runs, the Pages app falls back to the legacy `chores` table or
on-device storage.

### 2. Deploy the site

1. Repo **Settings → Pages → Source: GitHub Actions**  
2. Merge to `main` (or run **Deploy GitHub Pages**)  
3. Open **`https://jamiefuller320.github.io/chores/`**

`config.js` already points at the School Compass project URL + publishable key.
Optional Actions secrets `SUPABASE_URL` / `SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_*`)
override those defaults.

### Sync

Open tabs poll Supabase about every **10 seconds**, and refresh when you return
to the tab — so iPhone and iPad stay aligned without localhost.

## Product slice (current)

- **Self-assign** — pick “I am …” then **I’ll do it** on an open task (assign-by-name still works).
- **Template steps** + **reference photo** — “what good looks like” on add (under *Steps & standard photo*).
- **Proof photo** on complete — optional; retained **~7 days** or until the next completion for that template (whichever first).

## Backend priority

1. **Supabase rich model** (`people` / templates / instances) when schema is applied  
2. **Supabase legacy** `chores` table only  
3. **Local API** — `npm run web`  
4. **localStorage** — offline / before the SQL migration

## Bot ↔ Supabase credentials

| Surface | Key |
| --- | --- |
| Pages | Anon / publishable (browser) |
| BDK bot tools | Prefer **`SUPABASE_SERVICE_ROLE_KEY`** + `SUPABASE_URL` on the host |

Until the service role is configured, tools keep using `host.kv`
(`household/chores`). Adapter stub: `bot/lib/supabase.ts`.

## Local

```bash
npm install
npm run web   # http://127.0.0.1:4173
```

## Chat assistant (optional)

```bash
npx @cursor/bdk validate --dir .
npx @cursor/bdk run --dir . --message "What's open?"
```

## Checks

```bash
npm run check
npx @cursor/bdk eval --dir . --tag smoke
```
