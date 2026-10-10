# chores

Household chore tracking with a **web-first UI for iPhone and iPad**, plus an optional BDK chat assistant.

Most people will use Safari (or Add to Home Screen) on Apple devices. The web app is a mobile-first PWA with large touch targets and safe-area padding for notched iPhones.

## GitHub Pages (static)

Yes — the UI can run on GitHub Pages.

GitHub Pages only serves static files, so there is **no Node API** there. On Pages the app automatically uses **browser `localStorage`** (per device / browser). That is fine for a personal iPhone or iPad home-screen app; it does **not** sync across devices by itself.

1. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**
2. Merge to `main` (or run the **Deploy GitHub Pages** workflow)
3. Open `https://<user>.github.io/chores/`

Workflow: [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) publishes `web/public/`.

For shared household sync across phones/tablets, keep using `npm run web` (or another hosted API) instead of Pages-only mode.

## Web UI (local server)

```bash
npm install
npm run web
```

Open `http://127.0.0.1:4173` on a phone/tablet on the same network, or use Safari → **Share → Add to Home Screen** for an app-like shell.

When the API is reachable, chores persist in `.data/chores.json`. When it is not (Pages / offline), the same UI falls back to `localStorage`.

| API | Purpose |
| --- | --- |
| `GET /api/chores?status=open\|done\|all` | List chores |
| `POST /api/chores` | Create a chore |
| `PATCH /api/chores/:id` | Update / complete a chore |

## Chat assistant (optional)

```bash
npx @cursor/bdk validate --dir .
npx @cursor/bdk run --dir . --message "What's open?"
npx @cursor/bdk dev
```

| Tool | Effect | Purpose |
| --- | --- | --- |
| `list_chores` | read | List chores by status / assignee |
| `add_chore` | write | Create a chore |
| `update_chore` | write | Edit, reassign, or mark done |

Agent tool state lives in `ctx.host.kv` under `household/chores`. Model turns need a Cursor credential.

## Checks

```bash
npm run check
npx @cursor/bdk eval --dir . --tag smoke
```
