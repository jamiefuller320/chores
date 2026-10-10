const listEl = document.querySelector("#chore-list");
const emptyEl = document.querySelector("#empty-state");
const summaryEl = document.querySelector("#summary");
const form = document.querySelector("#add-form");
const formStatus = document.querySelector("#form-status");
const titleInput = document.querySelector("#title");
const assigneeInput = document.querySelector("#assignee");
const dueDateInput = document.querySelector("#dueDate");
const filterButtons = [...document.querySelectorAll(".filter")];

let filter = "open";
let chores = [];

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

async function api(path, options = {}) {
  const response = await fetch(path, {
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
  const data = await api(`/api/chores?status=${encodeURIComponent(filter)}`);
  chores = data.chores ?? [];
  render();
}

async function toggleChore(chore) {
  const nextStatus = chore.status === "done" ? "open" : "done";
  try {
    await api(`/api/chores/${encodeURIComponent(chore.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
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
    await api("/api/chores", {
      method: "POST",
      body: JSON.stringify({
        title,
        assignee: assigneeInput.value.trim() || undefined,
        dueDate: dueDateInput.value || undefined,
      }),
    });
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
    setStatus("Added.");
    await loadChores();
  } catch (error) {
    setStatus(error.message);
  } finally {
    submit.disabled = false;
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* optional on local/dev */
    });
  });
}

void loadChores().catch((error) => {
  summaryEl.textContent = "Could not reach the chores server.";
  setStatus(error.message);
});
