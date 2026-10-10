import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  addChore,
  emptyStore,
  listChores,
  updateChore,
  type ChoreStore,
} from "../bot/lib/chores.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.resolve(
  process.env.CHORES_DATA_DIR ?? path.join(__dirname, "..", ".data"),
);
const DATA_FILE = path.join(DATA_DIR, "chores.json");
const PORT = Number(process.env.PORT ?? 4173);
const HOST = process.env.HOST ?? "0.0.0.0";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
};

async function loadFileStore(): Promise<ChoreStore> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as { chores?: unknown };
    if (!Array.isArray(parsed.chores)) {
      return emptyStore();
    }
    return { chores: parsed.chores as ChoreStore["chores"] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyStore();
    }
    throw error;
  }
}

async function saveFileStore(store: ChoreStore): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(payload);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

async function serveStatic(
  res: ServerResponse,
  urlPath: string,
): Promise<boolean> {
  const relative =
    urlPath === "/" ? "/index.html" : decodeURIComponent(urlPath);
  const filePath = path.normalize(path.join(PUBLIC_DIR, relative));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "forbidden" });
    return true;
  }
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "content-type": MIME[ext] ?? "application/octet-stream",
      "cache-control":
        ext === ".html" ? "no-cache" : "public, max-age=3600",
    });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  if (req.method === "GET" && url.pathname === "/api/chores") {
    const store = await loadFileStore();
    const statusParam = url.searchParams.get("status") ?? "open";
    const status =
      statusParam === "done" || statusParam === "all" || statusParam === "open"
        ? statusParam
        : "open";
    const assignee = url.searchParams.get("assignee") ?? undefined;
    const chores = listChores(store, { status, assignee });
    sendJson(res, 200, { count: chores.length, chores });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/chores") {
    const body = (await readJson(req)) as {
      title?: string;
      description?: string;
      assignee?: string;
      dueDate?: string;
    };
    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      sendJson(res, 400, { error: "title is required" });
      return;
    }
    const store = await loadFileStore();
    const { store: next, chore } = addChore(store, {
      title: body.title,
      description: body.description,
      assignee: body.assignee,
      dueDate: body.dueDate,
    });
    await saveFileStore(next);
    sendJson(res, 201, { ok: true, chore });
    return;
  }

  const patchMatch = url.pathname.match(/^\/api\/chores\/([^/]+)$/);
  if (req.method === "PATCH" && patchMatch) {
    const id = decodeURIComponent(patchMatch[1]!);
    const body = (await readJson(req)) as {
      title?: string;
      description?: string;
      assignee?: string;
      dueDate?: string;
      status?: "open" | "done";
    };
    const store = await loadFileStore();
    const result = updateChore(store, { id, ...body });
    if (!result.ok) {
      sendJson(res, 404, { ok: false, error: result.error });
      return;
    }
    await saveFileStore(result.store);
    sendJson(res, 200, { ok: true, chore: result.chore });
    return;
  }

  sendJson(res, 404, { error: "not found" });
}

const server = createServer(async (req, res) => {
  try {
    const host = req.headers.host ?? `${HOST}:${PORT}`;
    const url = new URL(req.url ?? "/", `http://${host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    const served = await serveStatic(res, url.pathname);
    if (!served) {
      await serveStatic(res, "/");
    }
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "internal_error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Chores web UI: http://127.0.0.1:${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
});
