const listEl = document.querySelector("#chore-list");
const emptyEl = document.querySelector("#empty-state");
const summaryEl = document.querySelector("#summary");
const form = document.querySelector("#add-form");
const formStatus = document.querySelector("#form-status");
const titleInput = document.querySelector("#title");
const assigneeInput = document.querySelector("#assignee");
const dueDateInput = document.querySelector("#dueDate");
const filterButtons = [...document.querySelectorAll(".filter")];

/** Base URL for this deploy (works on GitHub project Pages under /chores/). */
const BASE = new URL("./", import.meta.url);
const STORAGE_KEY = "chores.household.v1";
const CONFIG = window.CHORES_CONFIG ?? {};

let filter = "open";
let chores = [];
/** @type {"supabase" | "api" | "local"} */
let backend = "local";
/** @type {ReturnType<typeof setInterval> | null} */
let pollTimer = null;

const checkIcon = `
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M5 10.5 8.2 13.7 15 6.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

function formatDue(dueDate) {
  if (!dueDate) return null;
  const date = new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dueDate;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function setStatus(message) {
  formStatus.textContent = message;
}

function newChoreId() {
  return `chore_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function supabaseConfigured() {
  return Boolean(CONFIG.supabaseUrl?.trim() && CONFIG.supabaseAnonKey?.trim());
}

function supabaseHeaders(extra = {}) {
  const key = CONFIG.supabaseAnonKey.trim();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function rowToChore(row) {
  return {
    id: row.id,
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    ...(row.assignee ? { assignee: row.assignee } : {}),
    status: row.status,
    ...(row.due_date ? { dueDate: row.due_date } : {}),
    createdAt: row.created_at,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
  };
}

function choreToRow(chore) {
  return {
    id: chore.id,
    title: chore.title,
    description: chore.description ?? null,
    assignee: chore.assignee ?? null,
    status: chore.status,
    due_date: chore.dueDate ?? null,
    created_at: chore.createdAt,
    completed_at: chore.completedAt ?? null,
  };
}

async function supabaseRequest(path, options = {}) {
  const url = new URL(path, `${CONFIG.supabaseUrl.replace(/\/$/, "")}/rest/v1/`);
  const response = await fetch(url, {
    ...options,
    headers: supabaseHeaders(options.headers),
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data?.message || data?.error_description || data?.hint || `Supabase ${response.status}`;
    throw new Error(message);
  }
  return data;
}

async function listSupabase(status) {
  let path = "chores?select=*&order=created_at.desc";
  if (status !== "all") {
    path += `&status=eq.${encodeURIComponent(status)}`;
  }
  const rows = await supabaseRequest(path);
  return (rows ?? []).map(rowToChore);
}

async function addSupabase(input) {
  const chore = {
    id: newChoreId(),
    title: input.title.trim(),
    ...(input.assignee ? { assignee: input.assignee } : {}),
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    status: "open",
    createdAt: new Date().toISOString(),
  };
  const rows = await supabaseRequest("chores", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(choreToRow(chore)),
  });
  return rowToChore(rows[0]);
}

async function updateSupabase(id, patch) {
  const body = {};
  if (patch.status !== undefined) {
    body.status = patch.status;
    body.completed_at =
      patch.status === "done" ? new Date().toISOString() : null;
  }
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.assignee !== undefined) body.assignee = patch.assignee || null;
  if (patch.dueDate !== undefined) body.due_date = patch.dueDate || null;

  const rows = await supabaseRequest(
    `chores?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body),
    },
  );
  if (!rows?.length) throw new Error(`No chore with id ${id}`);
  return rowToChore(rows[0]);
}

function loadLocalStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { chores: [] };
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.chores) ? { chores: parsed.chores } : { chores: [] };
  } catch {
    return { chores: [] };
  }
}

function saveLocalStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function listLocal(status) {
  return loadLocalStore().chores.filter((chore) => {
    if (status !== "all" && chore.status !== status) return false;
    return true;
  });
}

async function api(path, options = {}) {
  const url = new URL(path.replace(/^\//, ""), BASE);
  const response = await fetch(url, {
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

async function detectBackend() {
  if (supabaseConfigured()) {
    try {
      await listSupabase("open");
      return "supabase";
    } catch (error) {
      const message = String(error?.message || error);
      if (/PGRST205|Could not find the table/i.test(message)) {
        setStatus(
          "Supabase is linked, but the chores table is missing — run supabase/schema.sql in the School Compass project.",
        );
      }
      console.warn("Supabase unavailable, falling back", error);
    }
  }
  try {
    const url = new URL("api/chores?status=open", BASE);
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (response.ok) {
      const data = await response.json();
      if (typeof data?.count === "number" && Array.isArray(data.chores)) {
        return "api";
      }
    }
  } catch {
    /* static host */
  }
  return "local";
}

function render() {
  listEl.innerHTML = "";
  emptyEl.classList.toggle("hidden", chores.length > 0);

  const openCount = chores.filter((chore) => chore.status === "open").length;
  if (filter === "open") {
    summaryEl.textContent =
      openCount === 0
        ? "All clear for now."
        : `${openCount} open ${openCount === 1 ? "task" : "tasks"} for the household.`;
  } else if (filter === "done") {
    summaryEl.textContent = "Recently finished work.";
  } else {
    summaryEl.textContent = "Everything on the household board.";
  }

  for (const chore of chores) {
    const li = document.createElement("li");
    li.className = `chore${chore.status === "done" ? " is-done" : ""}`;
    li.dataset.id = chore.id;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "check";
    button.setAttribute(
      "aria-pressed",
      chore.status === "done" ? "true" : "false",
    );
    button.setAttribute(
      "aria-label",
      chore.status === "done"
        ? `Mark ${chore.title} as open`
        : `Mark ${chore.title} as done`,
    );
    button.innerHTML = checkIcon;
    button.addEventListener("click", () => {
      void toggleChore(chore);
    });

    const body = document.createElement("div");
    const title = document.createElement("p");
    title.className = "chore-title";
    title.textContent = chore.title;

    const meta = document.createElement("div");
    meta.className = "chore-meta";
    if (chore.assignee) {
      const assignee = document.createElement("span");
      assignee.className = "meta-pill";
      assignee.textContent = chore.assignee;
      meta.append(assignee);
    }
    const dueLabel = formatDue(chore.dueDate);
    if (dueLabel) {
      const due = document.createElement("span");
      due.className = "meta-pill";
      due.textContent = `Due ${dueLabel}`;
      meta.append(due);
    }

    body.append(title);
    if (meta.childNodes.length > 0) body.append(meta);
    li.append(button, body);
    listEl.append(li);
  }
}

async function loadChores({ quiet = false } = {}) {
  if (backend === "supabase") {
    chores = await listSupabase(filter);
  } else if (backend === "api") {
    const data = await api(`api/chores?status=${encodeURIComponent(filter)}`);
    chores = data.chores ?? [];
  } else {
    chores = listLocal(filter);
  }
  render();
  if (!quiet && backend === "supabase") {
    setStatus("Synced with Supabase.");
  }
}

async function toggleChore(chore) {
  const nextStatus = chore.status === "done" ? "open" : "done";
  try {
    if (backend === "supabase") {
      await updateSupabase(chore.id, { status: nextStatus });
    } else if (backend === "api") {
      await api(`api/chores/${encodeURIComponent(chore.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
    } else {
      const store = loadLocalStore();
      const index = store.chores.findIndex((item) => item.id === chore.id);
      if (index < 0) throw new Error(`No chore with id ${chore.id}`);
      const next = { ...store.chores[index], status: nextStatus };
      if (nextStatus === "done") next.completedAt = new Date().toISOString();
      else delete next.completedAt;
      store.chores[index] = next;
      saveLocalStore(store);
    }
    setStatus(nextStatus === "done" ? "Marked done." : "Reopened.");
    await loadChores({ quiet: true });
  } catch (error) {
    setStatus(error.message);
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  const ms = Number(CONFIG.pollIntervalMs) || 10000;
  if (backend !== "supabase" || ms < 2000) return;

  pollTimer = setInterval(() => {
    if (document.visibilityState === "hidden") return;
    void loadChores({ quiet: true }).catch((error) => {
      console.warn("Poll failed", error);
    });
  }, ms);
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filter = button.dataset.filter || "open";
    filterButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", active ? "true" : "false");
    });
    void loadChores({ quiet: true }).catch((error) => setStatus(error.message));
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;

  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  setStatus("Saving…");
  try {
    const payload = {
      title,
      assignee: assigneeInput.value.trim() || undefined,
      dueDate: dueDateInput.value || undefined,
    };
    if (backend === "supabase") {
      await addSupabase(payload);
    } else if (backend === "api") {
      await api("api/chores", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } else {
      const store = loadLocalStore();
      store.chores.push({
        id: newChoreId(),
        title: payload.title,
        ...(payload.assignee ? { assignee: payload.assignee } : {}),
        ...(payload.dueDate ? { dueDate: payload.dueDate } : {}),
        status: "open",
        createdAt: new Date().toISOString(),
      });
      saveLocalStore(store);
    }
    form.reset();
    titleInput.focus();
    if (filter === "done") {
      filter = "open";
      filterButtons.forEach((item) => {
        const active = item.dataset.filter === "open";
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", active ? "true" : "false");
      });
    }
    setStatus(
      backend === "supabase"
        ? "Added (synced)."
        : backend === "local"
          ? "Added (saved on this device)."
          : "Added.",
    );
    await loadChores({ quiet: true });
  } catch (error) {
    setStatus(error.message);
  } finally {
    submit.disabled = false;
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && backend === "supabase") {
    void loadChores({ quiet: true }).catch(() => {});
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(new URL("sw.js", BASE), { scope: BASE.pathname })
      .catch(() => {});
  });
}

void (async () => {
  backend = await detectBackend();
  if (backend === "supabase") {
    setStatus("Connected to Supabase. Polling for updates…");
    startPolling();
  } else if (backend === "local") {
    setStatus("Saved on this device (no Supabase / API).");
  }
  await loadChores({ quiet: true });
})().catch((error) => {
  summaryEl.textContent = "Could not load chores.";
  setStatus(error.message);
});
