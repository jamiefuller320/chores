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

This creates / updates:

| Object | Purpose |
| --- | --- |
| `public.chores` | Legacy flat board (kept for compatibility) |
| `public.people` | Household members (`parent` = **admin**, `child`, `other`) |
| `public.task_templates` | Kinds + **recurrence** (default periodic **4 weeks**) + **points** + steps + reference photo |
| `public.task_instances` | Open / assigned / done / waiting work. `complete_by` holds an assignee until that time, then the task is released |
| `public.completion_events` | Completions + proof photo TTL + **assessment** / **points_awarded** |
| Storage bucket `chore-photos` | Reference (durable) + proof (TTL) images |

**Re-run this SQL on School Compass** whenever schema columns change (safe to
re-run). Latest additive column: `task_instances.complete_by` (timestamptz) —
the assignee holds the task only until that time. Also present from earlier
slices: `recurrence_interval`, `recurrence_unit`, `points` on templates;
`assessment_status`, `points_awarded`, `assessed_by_person_id`,
`assessed_at` on completion events.

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
to the tab — so iPhone and iPad stay aligned without localhost. The UI also
keeps a **local cache** of open tasks and scores for a fast first paint, then
reconciles with Supabase in the background.

## Product slice (current)

- **Admin UI mode (v1)** — the Pages UI is full parent/admin for now: edit tasks, set points, manage people, assess. “I am …” still picks who claims/completes. **Auth later:** separate logins + parent password-reset (not built yet; anon RLS still allows writes).
- **List layout** — open list shows **titles only** (scrollable); tap a title for the full task card (details, Edit, Mark done). **New task** is a single collapsed button until opened.
- **Assign with a complete-by time** — naming an assignee (New task or Edit) requires a complete-by date and time. Until then the task stays assigned to that person. After that time, if it is still not done, the app clears the assignee on load and when the page renders, and anyone can mark it done with the name picker.
- **Edit any task** — **Edit** on a task card updates title, description, steps, points, recurrence, assignee, complete-by, kind, due date, reference photo.
- **People** — **People** tab: add name + role (`parent` / `child` / `other`), list and change roles.
- **Points** — point value is on the add form (not buried) and editable per task; **Scores** tab shows approved totals.
- **Fast load** — open tasks / scoreboard paint from a localStorage cache first, then revalidate against Supabase (stale-while-revalidate).
- **Mark done** — tap the check on an open task → popup asks **who did it**, optional **in-page camera** evidence (fallback: photo library / `capture`), and optional how-long / how-hard. No separate “I’ll do it” claim step. Assign-by-name on add/edit still works; “I am …” pre-fills the name picker.
- **Template steps** + **reference photo** — “what good looks like” on add/edit (camera helper available).
- **Proof photo** on complete — optional; retained **~7 days** or until the next completion for that template (whichever first).
- **Recurrence** — periodic tasks default to **every 4 weeks**; custom every **N days** or **N weeks**. Completing a recurring task schedules the next cycle (`waiting` until due).
- **Assessment** — completing a task leaves it **pending**; points count only after **approve** (or reject).

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

`npm run web` serves the legacy flat API. For the rich localStorage UI without
Supabase, open with `?local=1` (or set `localStorage.chores.forceLocal = "1"`).
GitHub Pages uses Supabase when the schema is applied, else on-device storage.

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
