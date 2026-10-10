# chores

Household chore tracking with a **web-first UI for iPhone and iPad**, plus an optional BDK chat assistant.

Most people will use Safari (or Add to Home Screen) on Apple devices. The web app is a mobile-first PWA with large touch targets and safe-area padding for notched iPhones.

## Web UI (primary)

```bash
npm install
npm run web
```

Open `http://127.0.0.1:4173` on a phone/tablet on the same network, or use Safari → **Share → Add to Home Screen** for an app-like shell.

| API | Purpose |
| --- | --- |
| `GET /api/chores?status=open\|done\|all` | List chores |
| `POST /api/chores` | Create a chore |
| `PATCH /api/chores/:id` | Update / complete a chore |

Chore data for the web UI is stored in `.data/chores.json` (override with `CHORES_DATA_DIR`).

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
