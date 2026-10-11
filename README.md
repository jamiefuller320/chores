# chores

Household chore tracking with a **web-first UI for iPhone and iPad**.

Always-on hosting: **GitHub Pages (UI) + Supabase (shared API/data)**.

## Recommended setup (always available)

| Layer | Role |
| --- | --- |
| GitHub Pages | Serves the static PWA at `https://<user>.github.io/chores/` |
| Supabase | Shared chore database for every household device |
| Polling | Browser refreshes the list every ~10s while the tab is open |

### 1. Create the Supabase table

1. Create a free project at [supabase.com](https://supabase.com)
2. Open **SQL → New query**, paste [`supabase/schema.sql`](supabase/schema.sql), run it
3. Project **Settings → API**: copy **Project URL** and **anon public** key

### 2. Point GitHub Pages at Supabase

Repo **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |

Optional variable: `CHORES_POLL_MS` (default `10000`).

Also: **Settings → Pages → Source: GitHub Actions**.

### 3. Deploy

Merge to `main` or run the **Deploy GitHub Pages** workflow.

Open **`https://<user>.github.io/chores/`** on iPhone/iPad (Add to Home Screen works).

Any phone/tablet using that URL shares the same chore list via Supabase. Open tabs poll for updates about every 10 seconds (and refresh when you return to the tab).

### Local config (optional)

```bash
cp web/public/config.example.js web/public/config.js
# edit supabaseUrl + supabaseAnonKey
npm run web   # still works; prefers Supabase when configured
```

## Backend priority

1. **Supabase** — if `config.js` has URL + anon key  
2. **Local API** — `npm run web` (`.data/chores.json`)  
3. **localStorage** — offline / Pages without secrets (per device only)

## Chat assistant (optional)

BDK agent tools remain available for natural-language chore help:

```bash
npx @cursor/bdk validate --dir .
npx @cursor/bdk run --dir . --message "What's open?"
```

## Checks

```bash
npm run check
npx @cursor/bdk eval --dir . --tag smoke
```
