# chores

Household chore assistant built with [`@cursor/bdk`](https://www.npmjs.com/package/@cursor/bdk).

Track open chores, assignees, and due dates from the playground or HTTP API.

## Quick start

```bash
npm install
npx @cursor/bdk validate --dir .
npx @cursor/bdk info --dir . --json
npx @cursor/bdk call add_chore --dir . --input '{"title":"Take out trash","assignee":"Alex","dueDate":"2026-10-11"}'
npx @cursor/bdk call list_chores --dir . --input '{"status":"open"}'
npx @cursor/bdk dev
```

Open the playground at `http://127.0.0.1:3000/playground` (port may vary).

Model turns need a Cursor credential (`CURSOR_API_KEY`, `bdk login`, or a service account key).

## Tools

| Tool | Effect | Purpose |
| --- | --- | --- |
| `list_chores` | read | List chores by status / assignee |
| `add_chore` | write | Create a chore |
| `update_chore` | write | Edit, reassign, or mark done |

State is stored in `ctx.host.kv` under `household/chores`.

## Checks

```bash
npm run check
npx @cursor/bdk eval --dir . --list
npx @cursor/bdk eval --dir . --tag smoke
```
