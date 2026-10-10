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

let filter = "open";
let chores = [];
/** @type {"api" | "local"} */
let backend = "local";

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

function listLocal(status, assignee) {
  const needle = assignee?.trim().toLowerCase();
  return loadLocalStore().chores.filter((chore) => {
    if (status !== "all" && chore.status !== status) return false;
    if (needle) return (chore.assignee ?? "").toLowerCase() === needle;
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
  try {
    const url = new URL(`api/chores?status=open`, BASE);
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
    /* static host (GitHub Pages) or offline */
  }
  return "local";
}

function render() {
  listEl.innerHTML = "";
  const visible = chores;
  emptyEl.classList.toggle("hidden", visible.length > 0);

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

  for (const chore of visible) {
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
    if (meta.childNodes.length > 0) {
      body.append(meta);
    }
    li.append(button, body);
    listEl.append(li);
  }
}

async function loadChores() {
  if (backend === "api") {
    const data = await api(`api/chores?status=${encodeURIComponent(filter)}`);
    chores = data.chores ?? [];
  } else {
    chores = listLocal(filter);
  }
  render();
}

async function toggleChore(chore) {
  const nextStatus = chore.status === "done" ? "open" : "done";
  try {
    if (backend === "api") {
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
    await loadChores();
  } catch (error) {
    setStatus(error.message);
  }
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filter = button.dataset.filter || "open";
    filterButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", active ? "true" : "false");
    });
    void loadChores().catch((error) => setStatus(error.message));
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
    if (backend === "api") {
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
    setStatus(backend === "local" ? "Added (saved on this device)." : "Added.");
    await loadChores();
  } catch (error) {
    setStatus(error.message);
  } finally {
    submit.disabled = false;
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(new URL("sw.js", BASE), { scope: BASE.pathname })
      .catch(() => {
        /* optional on local/dev */
      });
  });
}

void (async () => {
  backend = await detectBackend();
  if (backend === "local") {
    setStatus("Saved on this device (GitHub Pages / offline mode).");
  }
  await loadChores();
})().catch((error) => {
  summaryEl.textContent = "Could not load chores.";
  setStatus(error.message);
});
