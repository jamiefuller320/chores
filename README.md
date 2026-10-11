# chores

Household chore tracking with a **web-first UI for iPhone and iPad**.

Always-on: **GitHub Pages (UI) + School Compass Supabase (shared data)**.

## Piggyback setup (no new Supabase project)

We reuse the existing **School Compass** Supabase project (same one as
Comparison-tool / [schoolcompass.uk](https://schoolcompass.uk)) because the
free-tier project limit is full. Do **not** use the home_learning project.

### 1. Create the `chores` table (one-time)

1. Open the **School Compass** project in the Supabase dashboard  
2. **SQL → New query**  
3. Paste [`supabase/schema.sql`](supabase/schema.sql) → **Run**

Until that runs, the Pages app cannot sync (it will fall back to on-device storage).

### 2. Deploy the site

1. Repo **Settings → Pages → Source: GitHub Actions**  
2. Merge to `main` (or run **Deploy GitHub Pages**)  
3. Open **`https://jamiefuller320.github.io/chores/`**

`config.js` already points at the School Compass project URL + publishable key
(the same client key schoolcompass.uk uses). Optional Actions secrets
`SUPABASE_URL` / `SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_*`) override those defaults.

### Sync

Open tabs poll Supabase about every **10 seconds**, and refresh when you return
to the tab — so iPhone and iPad stay aligned without localhost.

## Backend priority

1. **Supabase** (School Compass project) when configured  
2. **Local API** — `npm run web`  
3. **localStorage** — offline / before the SQL migration

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
