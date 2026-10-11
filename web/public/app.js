const listEl = document.querySelector("#chore-list");
const emptyEl = document.querySelector("#empty-state");
const summaryEl = document.querySelector("#summary");
const form = document.querySelector("#add-form");
const formStatus = document.querySelector("#form-status");
const titleInput = document.querySelector("#title");
const assigneeInput = document.querySelector("#assignee");
const dueDateInput = document.querySelector("#dueDate");
const kindInput = document.querySelector("#kind");
const stepsInput = document.querySelector("#steps");
const referencePhotoInput = document.querySelector("#referencePhoto");
const meSelect = document.querySelector("#me-person");
const filterButtons = [...document.querySelectorAll(".filter")];
const completeDialog = document.querySelector("#complete-dialog");
const completeForm = document.querySelector("#complete-form");
const completeTitleEl = document.querySelector("#complete-title");
const proofPhotoInput = document.querySelector("#proofPhoto");

/** Base URL for this deploy (works on GitHub project Pages under /chores/). */
const BASE = new URL("./", import.meta.url);
const STORAGE_KEY_V1 = "chores.household.v1";
const STORAGE_KEY_V2 = "chores.household.v2";
const ME_KEY = "chores.me.personId";
const CONFIG = window.CHORES_CONFIG ?? {};
const PROOF_TTL_DAYS = 7;
const PHOTO_BUCKET = "chore-photos";

let filter = "open";
/** @type {Array<Record<string, unknown>>} */
let chores = [];
/** @type {Array<{id: string, displayName: string, role: string}>} */
let people = [];
/** @type {Map<string, Record<string, unknown>>} */
let templatesById = new Map();
/** @type {"supabase-rich" | "supabase" | "api" | "local"} */
let backend = "local";
/** @type {ReturnType<typeof setInterval> | null} */
let pollTimer = null;
/** @type {Record<string, unknown> | null} */
let pendingComplete = null;

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

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseSteps(raw) {
  if (!raw?.trim()) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, index) => ({ ordinal: index + 1, text }));
}

function proofExpiresAt(iso) {
  const ms = Date.parse(iso);
  const base = Number.isNaN(ms) ? Date.now() : ms;
  return new Date(base + PROOF_TTL_DAYS * 86400000).toISOString();
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

function storagePublicUrl(path) {
  if (!path) return null;
  if (/^(https?:|data:)/i.test(path)) return path;
  if (!CONFIG.supabaseUrl) return path;
  const base = CONFIG.supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${path.replace(/^\//, "")}`;
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

async function uploadPhoto(file, folder) {
  if (!file) return null;
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${folder}/${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.${ext || "jpg"}`;
  const url = new URL(
    `storage/v1/object/${PHOTO_BUCKET}/${path}`,
    `${CONFIG.supabaseUrl.replace(/\/$/, "")}/`,
  );
  const key = CONFIG.supabaseAnonKey.trim();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": file.type || "image/jpeg",
      "x-upsert": "true",
    },
    body: file,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || `Photo upload failed (${response.status})`);
  }
  return path;
}

function rowToLegacyChore(row) {
  return {
    id: row.id,
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    ...(row.assignee ? { assignee: row.assignee } : {}),
    status: row.status,
    ...(row.due_date ? { dueDate: row.due_date } : {}),
    createdAt: row.created_at,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    mode: "legacy",
  };
}

function instanceToView(row, template) {
  const status = row.status;
  const openLike =
    status === "noticed" || status === "open" || status === "assigned";
  const steps = Array.isArray(template?.steps) ? template.steps : [];
  return {
    id: row.id,
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    ...(row.assignee ? { assignee: row.assignee } : {}),
    status: openLike ? "open" : "done",
    instanceStatus: status,
    ...(row.due_date ? { dueDate: row.due_date } : {}),
    createdAt: row.created_at,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    templateId: row.template_id ?? undefined,
    assigneePersonId: row.assignee_person_id ?? undefined,
    steps,
    referencePhotoPath: template?.reference_photo_path || undefined,
    kind: template?.kind || "once",
    mode: "instance",
  };
}

async function listLegacySupabase(status) {
  let path = "chores?select=*&order=created_at.desc";
  if (status !== "all") {
    path += `&status=eq.${encodeURIComponent(status)}`;
  }
  const rows = await supabaseRequest(path);
  return (rows ?? []).map(rowToLegacyChore);
}

async function listRichSupabase(status) {
  const [instanceRows, templateRows, peopleRows] = await Promise.all([
    supabaseRequest("task_instances?select=*&order=created_at.desc"),
    supabaseRequest("task_templates?select=*&order=created_at.desc"),
    supabaseRequest("people?select=*&order=display_name.asc"),
  ]);
  people = (peopleRows ?? []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    role: row.role,
  }));
  templatesById = new Map((templateRows ?? []).map((row) => [row.id, row]));
  const views = (instanceRows ?? []).map((row) =>
    instanceToView(row, row.template_id ? templatesById.get(row.template_id) : null),
  );
  if (status === "all") return views;
  if (status === "done") return views.filter((c) => c.status === "done");
  return views.filter((c) => c.status === "open");
}

async function findOrCreatePerson(name) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existing = people.find(
    (p) => p.displayName.toLowerCase() === trimmed.toLowerCase(),
  );
  if (existing) return existing;
  if (backend === "supabase-rich") {
    const id = newId("person");
    const rows = await supabaseRequest("people", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        id,
        display_name: trimmed,
        role: "child",
        active: true,
        created_at: new Date().toISOString(),
      }),
    });
    const person = {
      id: rows[0].id,
      displayName: rows[0].display_name,
      role: rows[0].role,
    };
    people = [...people, person].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
    return person;
  }
  const person = { id: newId("person"), displayName: trimmed, role: "child" };
  people = [...people, person];
  return person;
}

async function addRichSupabase(input) {
  const now = new Date().toISOString();
  const person = input.assignee
    ? await findOrCreatePerson(input.assignee)
    : null;
  let referencePath = null;
  if (input.referenceFile) {
    referencePath = await uploadPhoto(input.referenceFile, "reference");
  }
  const templateId = newId("tmpl");
  const instanceId = newId("inst");
  await supabaseRequest("task_templates", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      id: templateId,
      title: input.title.trim(),
      kind: input.kind || "once",
      estimated_minutes: 10,
      effort_weight: 1,
      steps: input.steps ?? [],
      reference_photo_path: referencePath,
      default_assignee_person_id: person?.id ?? null,
      created_from: "manual",
      active: true,
      created_at: now,
    }),
  });
  const rows = await supabaseRequest("task_instances", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id: instanceId,
      template_id: templateId,
      title: input.title.trim(),
      estimated_minutes: 10,
      status: person ? "assigned" : "open",
      assignee_person_id: person?.id ?? null,
      assignee: person?.displayName ?? null,
      opened_at: now,
      assigned_at: person ? now : null,
      due_date: input.dueDate || null,
      source: "manual",
      created_at: now,
    }),
  });
  // Mirror into legacy chores for older clients / fallback readers.
  try {
    await supabaseRequest("chores", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        id: instanceId,
        title: input.title.trim(),
        assignee: person?.displayName ?? null,
        status: "open",
        due_date: input.dueDate || null,
        created_at: now,
        completed_at: null,
      }),
    });
  } catch {
    /* legacy mirror optional */
  }
  return instanceToView(rows[0], {
    steps: input.steps ?? [],
    reference_photo_path: referencePath,
    kind: input.kind || "once",
  });
}

async function addLegacySupabase(input) {
  const chore = {
    id: newId("chore"),
    title: input.title.trim(),
    ...(input.assignee ? { assignee: input.assignee } : {}),
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    status: "open",
    createdAt: new Date().toISOString(),
    mode: "legacy",
  };
  const rows = await supabaseRequest("chores", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id: chore.id,
      title: chore.title,
      description: null,
      assignee: chore.assignee ?? null,
      status: chore.status,
      due_date: chore.dueDate ?? null,
      created_at: chore.createdAt,
      completed_at: null,
    }),
  });
  return rowToLegacyChore(rows[0]);
}

async function selfAssignRich(chore) {
  const meId = meSelect.value;
  if (!meId) throw new Error("Pick who you are first (I am…).");
  const person = people.find((p) => p.id === meId);
  if (!person) throw new Error("Unknown person — refresh and try again.");
  const now = new Date().toISOString();
  const rows = await supabaseRequest(
    `task_instances?id=eq.${encodeURIComponent(chore.id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        status: "assigned",
        assignee_person_id: person.id,
        assignee: person.displayName,
        assigned_at: now,
      }),
    },
  );
  if (!rows?.length) throw new Error(`No task with id ${chore.id}`);
  try {
    await supabaseRequest(`chores?id=eq.${encodeURIComponent(chore.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ assignee: person.displayName }),
    });
  } catch {
    /* optional mirror */
  }
  return instanceToView(rows[0], templatesById.get(rows[0].template_id));
}

async function completeRich(chore, proofFile) {
  const now = new Date().toISOString();
  let proofPath = null;
  if (proofFile) {
    proofPath = await uploadPhoto(proofFile, "proof");
  }
  const meId = meSelect.value || chore.assigneePersonId || null;
  const completionId = newId("comp");
  await supabaseRequest(
    `task_instances?id=eq.${encodeURIComponent(chore.id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "done",
        completed_at: now,
      }),
    },
  );
  await supabaseRequest("completion_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      id: completionId,
      instance_id: chore.id,
      template_id: chore.templateId ?? null,
      person_id: meId,
      completed_at: now,
      proof_photo_path: proofPath,
      proof_expires_at: proofPath ? proofExpiresAt(now) : null,
      created_at: now,
    }),
  });
  // Expire prior proofs for same template (next-cycle rule).
  if (chore.templateId) {
    try {
      await supabaseRequest(
        `completion_events?template_id=eq.${encodeURIComponent(chore.templateId)}&id=neq.${encodeURIComponent(completionId)}&proof_photo_path=not.is.null`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ proof_expires_at: now }),
        },
      );
    } catch {
      /* best-effort */
    }
  }
  try {
    await supabaseRequest(`chores?id=eq.${encodeURIComponent(chore.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "done", completed_at: now }),
    });
  } catch {
    /* optional */
  }
}

async function reopenRich(chore) {
  const rows = await supabaseRequest(
    `task_instances?id=eq.${encodeURIComponent(chore.id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        status: chore.assigneePersonId ? "assigned" : "open",
        completed_at: null,
      }),
    },
  );
  try {
    await supabaseRequest(`chores?id=eq.${encodeURIComponent(chore.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "open", completed_at: null }),
    });
  } catch {
    /* optional */
  }
  return instanceToView(rows[0], templatesById.get(rows[0].template_id));
}

async function updateLegacySupabase(id, patch) {
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
  return rowToLegacyChore(rows[0]);
}

function loadLocalV2() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V2);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        people: Array.isArray(parsed.people) ? parsed.people : [],
        templates: Array.isArray(parsed.templates) ? parsed.templates : [],
        instances: Array.isArray(parsed.instances) ? parsed.instances : [],
        completions: Array.isArray(parsed.completions) ? parsed.completions : [],
      };
    }
  } catch {
    /* fall through */
  }
  // Migrate v1 chores → instances
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V1);
    if (!raw) {
      return { people: [], templates: [], instances: [], completions: [] };
    }
    const parsed = JSON.parse(raw);
    const legacy = Array.isArray(parsed?.chores) ? parsed.chores : [];
    const instances = legacy.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      status: c.status === "done" ? "done" : c.assignee ? "assigned" : "open",
      assignee: c.assignee,
      due_date: c.dueDate,
      created_at: c.createdAt,
      completed_at: c.completedAt,
      template_id: null,
      source: "manual",
    }));
    return { people: [], templates: [], instances, completions: [] };
  } catch {
    return { people: [], templates: [], instances: [], completions: [] };
  }
}

function saveLocalV2(store) {
  localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(store));
}

function listLocal(status) {
  const store = loadLocalV2();
  people = store.people.map((p) => ({
    id: p.id,
    displayName: p.displayName ?? p.display_name,
    role: p.role ?? "child",
  }));
  templatesById = new Map(
    store.templates.map((t) => [
      t.id,
      {
        ...t,
        steps: t.steps ?? [],
        reference_photo_path: t.referencePhotoPath ?? t.reference_photo_path,
        kind: t.kind ?? "once",
      },
    ]),
  );
  const views = store.instances.map((row) => {
    const normalized = {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      assignee: row.assignee,
      assignee_person_id: row.assigneePersonId ?? row.assignee_person_id,
      due_date: row.dueDate ?? row.due_date,
      created_at: row.createdAt ?? row.created_at,
      completed_at: row.completedAt ?? row.completed_at,
      template_id: row.templateId ?? row.template_id,
    };
    return instanceToView(
      normalized,
      normalized.template_id ? templatesById.get(normalized.template_id) : null,
    );
  });
  if (status === "all") return views;
  if (status === "done") return views.filter((c) => c.status === "done");
  return views.filter((c) => c.status === "open");
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
      await supabaseRequest("people?select=id&limit=1");
      await supabaseRequest("task_instances?select=id&limit=1");
      return "supabase-rich";
    } catch (error) {
      console.warn("Rich schema unavailable", error);
    }
    try {
      await listLegacySupabase("open");
      return "supabase";
    } catch (error) {
      const message = String(error?.message || error);
      if (/PGRST205|Could not find the table/i.test(message)) {
        setStatus(
          "Supabase is linked, but tables are missing — run supabase/schema.sql in the School Compass project.",
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

function fillMeSelect() {
  const previous = localStorage.getItem(ME_KEY) || meSelect.value || "";
  meSelect.innerHTML = `<option value="">Someone…</option>`;
  for (const person of people) {
    const opt = document.createElement("option");
    opt.value = person.id;
    opt.textContent = person.displayName;
    meSelect.append(opt);
  }
  if (previous && people.some((p) => p.id === previous)) {
    meSelect.value = previous;
  }
}

function render() {
  listEl.innerHTML = "";
  emptyEl.classList.toggle("hidden", chores.length > 0);
  fillMeSelect();

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
      void onCheckClick(chore);
    });

    const body = document.createElement("div");
    body.className = "chore-body";
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
    if (chore.kind && chore.kind !== "once") {
      const kind = document.createElement("span");
      kind.className = "meta-pill";
      kind.textContent = chore.kind === "daily" ? "Daily" : "Repeats";
      meta.append(kind);
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

    if (Array.isArray(chore.steps) && chore.steps.length > 0) {
      const ol = document.createElement("ol");
      ol.className = "chore-steps";
      for (const step of [...chore.steps].sort(
        (a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0),
      )) {
        const liStep = document.createElement("li");
        liStep.textContent = step.text;
        ol.append(liStep);
      }
      body.append(ol);
    }

    if (chore.referencePhotoPath) {
      const figure = document.createElement("figure");
      figure.className = "chore-ref";
      const img = document.createElement("img");
      img.src = storagePublicUrl(chore.referencePhotoPath) || chore.referencePhotoPath;
      img.alt = "What good looks like";
      img.loading = "lazy";
      const caption = document.createElement("figcaption");
      caption.textContent = "What good looks like";
      figure.append(img, caption);
      body.append(figure);
    }

    if (chore.status === "open" && backend !== "api") {
      const actions = document.createElement("div");
      actions.className = "chore-actions";
      const claim = document.createElement("button");
      claim.type = "button";
      claim.className = "text-btn";
      claim.textContent = chore.assignee ? "Reclaim" : "I’ll do it";
      claim.addEventListener("click", () => {
        void claimChore(chore);
      });
      actions.append(claim);
      body.append(actions);
    }

    li.append(button, body);
    listEl.append(li);
  }
}

async function loadChores({ quiet = false } = {}) {
  if (backend === "supabase-rich") {
    chores = await listRichSupabase(filter);
  } else if (backend === "supabase") {
    chores = await listLegacySupabase(filter);
  } else if (backend === "api") {
    const data = await api(`api/chores?status=${encodeURIComponent(filter)}`);
    chores = (data.chores ?? []).map((c) => ({ ...c, mode: "legacy" }));
  } else {
    chores = listLocal(filter);
  }
  render();
  if (!quiet && (backend === "supabase" || backend === "supabase-rich")) {
    setStatus(
      backend === "supabase-rich"
        ? "Synced (templates + self-assign)."
        : "Synced with Supabase.",
    );
  }
}

async function ensureMePerson() {
  let meId = meSelect.value;
  if (meId) {
    const person = people.find((p) => p.id === meId);
    if (person) return person;
  }
  const name = prompt("Your name (for self-assign)?")?.trim();
  if (!name) throw new Error("Pick who you are first (I am…).");

  if (backend === "supabase-rich") {
    const person = await findOrCreatePerson(name);
    fillMeSelect();
    meSelect.value = person.id;
    localStorage.setItem(ME_KEY, person.id);
    return person;
  }

  if (backend === "local") {
    const store = loadLocalV2();
    let person = store.people.find(
      (p) =>
        (p.displayName || p.display_name || "").toLowerCase() ===
        name.toLowerCase(),
    );
    if (!person) {
      person = {
        id: newId("person"),
        displayName: name,
        role: "child",
        active: true,
        createdAt: new Date().toISOString(),
      };
      store.people.push(person);
      saveLocalV2(store);
    }
    people = store.people.map((p) => ({
      id: p.id,
      displayName: p.displayName ?? p.display_name,
      role: p.role ?? "child",
    }));
    fillMeSelect();
    meSelect.value = person.id;
    localStorage.setItem(ME_KEY, person.id);
    return {
      id: person.id,
      displayName: person.displayName ?? person.display_name,
      role: person.role ?? "child",
    };
  }

  // Legacy supabase / api: ephemeral name only
  const person = { id: newId("person"), displayName: name, role: "child" };
  people = [...people.filter((p) => p.displayName !== name), person];
  fillMeSelect();
  meSelect.value = person.id;
  localStorage.setItem(ME_KEY, person.id);
  return person;
}

async function claimChore(chore) {
  try {
    if (backend === "supabase-rich") {
      await ensureMePerson();
      await selfAssignRich(chore);
    } else if (backend === "local") {
      const person = await ensureMePerson();
      const store = loadLocalV2();
      const index = store.instances.findIndex((i) => i.id === chore.id);
      if (index < 0) throw new Error("Task not found");
      store.instances[index] = {
        ...store.instances[index],
        status: "assigned",
        assigneePersonId: person.id,
        assignee: person.displayName,
        assignedAt: new Date().toISOString(),
      };
      saveLocalV2(store);
    } else if (backend === "supabase") {
      const name =
        (await ensureMePerson().catch(() => null))?.displayName ||
        prompt("Your name for this claim?")?.trim();
      if (!name) throw new Error("Need a name to claim.");
      await updateLegacySupabase(chore.id, { assignee: name });
    } else {
      setStatus("Self-assign needs Supabase rich schema or local mode.");
      return;
    }
    setStatus("Claimed.");
    await loadChores({ quiet: true });
  } catch (error) {
    setStatus(error.message);
  }
}

function onCheckClick(chore) {
  if (chore.status === "done") {
    void reopenChore(chore);
    return;
  }
  pendingComplete = chore;
  completeTitleEl.textContent = chore.title;
  proofPhotoInput.value = "";
  if (typeof completeDialog.showModal === "function") {
    completeDialog.showModal();
  } else {
    void finishComplete(chore, null);
  }
}

async function reopenChore(chore) {
  try {
    if (backend === "supabase-rich") {
      await reopenRich(chore);
    } else if (backend === "supabase") {
      await updateLegacySupabase(chore.id, { status: "open" });
    } else if (backend === "api") {
      await api(`api/chores/${encodeURIComponent(chore.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "open" }),
      });
    } else {
      const store = loadLocalV2();
      const index = store.instances.findIndex((i) => i.id === chore.id);
      if (index < 0) throw new Error("Task not found");
      const next = { ...store.instances[index], status: "open" };
      delete next.completedAt;
      delete next.completed_at;
      store.instances[index] = next;
      saveLocalV2(store);
    }
    setStatus("Reopened.");
    await loadChores({ quiet: true });
  } catch (error) {
    setStatus(error.message);
  }
}

async function finishComplete(chore, proofFile) {
  try {
    if (backend === "supabase-rich") {
      await completeRich(chore, proofFile);
    } else if (backend === "supabase") {
      await updateLegacySupabase(chore.id, { status: "done" });
    } else if (backend === "api") {
      await api(`api/chores/${encodeURIComponent(chore.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "done" }),
      });
    } else {
      const store = loadLocalV2();
      const index = store.instances.findIndex((i) => i.id === chore.id);
      if (index < 0) throw new Error("Task not found");
      const now = new Date().toISOString();
      store.instances[index] = {
        ...store.instances[index],
        status: "done",
        completedAt: now,
      };
      let proofPath = null;
      if (proofFile) {
        proofPath = await fileToDataUrl(proofFile);
      }
      store.completions.push({
        id: newId("comp"),
        instanceId: chore.id,
        templateId: chore.templateId,
        personId: meSelect.value || undefined,
        completedAt: now,
        proofPhotoPath: proofPath || undefined,
        proofExpiresAt: proofPath ? proofExpiresAt(now) : undefined,
        createdAt: now,
      });
      saveLocalV2(store);
    }
    setStatus(
      proofFile
        ? `Marked done (proof kept ~${PROOF_TTL_DAYS} days).`
        : "Marked done.",
    );
    await loadChores({ quiet: true });
  } catch (error) {
    setStatus(error.message);
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read photo"));
    reader.readAsDataURL(file);
  });
}

completeForm.addEventListener("submit", (event) => {
  const submitter = event.submitter;
  const value = submitter?.value || "cancel";
  if (value !== "confirm" || !pendingComplete) {
    pendingComplete = null;
    return;
  }
  const chore = pendingComplete;
  const file = proofPhotoInput.files?.[0] ?? null;
  pendingComplete = null;
  void finishComplete(chore, file);
});

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  const ms = Number(CONFIG.pollIntervalMs) || 10000;
  if (
    (backend !== "supabase" && backend !== "supabase-rich") ||
    ms < 2000
  ) {
    return;
  }

  pollTimer = setInterval(() => {
    if (document.visibilityState === "hidden") return;
    void loadChores({ quiet: true }).catch((error) => {
      console.warn("Poll failed", error);
    });
  }, ms);
}

meSelect.addEventListener("change", () => {
  localStorage.setItem(ME_KEY, meSelect.value);
});

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
      kind: kindInput.value || "once",
      steps: parseSteps(stepsInput.value),
      referenceFile: referencePhotoInput.files?.[0] ?? null,
    };
    if (backend === "supabase-rich") {
      await addRichSupabase(payload);
      if (payload.assignee) await findOrCreatePerson(payload.assignee);
    } else if (backend === "supabase") {
      await addLegacySupabase(payload);
    } else if (backend === "api") {
      await api("api/chores", {
        method: "POST",
        body: JSON.stringify({
          title: payload.title,
          assignee: payload.assignee,
          dueDate: payload.dueDate,
        }),
      });
    } else {
      const store = loadLocalV2();
      const now = new Date().toISOString();
      let person = null;
      if (payload.assignee) {
        person = store.people.find(
          (p) =>
            (p.displayName || p.display_name || "").toLowerCase() ===
            payload.assignee.toLowerCase(),
        );
        if (!person) {
          person = {
            id: newId("person"),
            displayName: payload.assignee,
            role: "child",
            active: true,
            createdAt: now,
          };
          store.people.push(person);
        }
      }
      const templateId = newId("tmpl");
      let referencePath = null;
      if (payload.referenceFile) {
        referencePath = await fileToDataUrl(payload.referenceFile);
      }
      store.templates.push({
        id: templateId,
        title: payload.title,
        kind: payload.kind,
        steps: payload.steps,
        referencePhotoPath: referencePath,
        estimatedMinutes: 10,
        effortWeight: 1,
        createdFrom: "manual",
        active: true,
        createdAt: now,
      });
      store.instances.push({
        id: newId("inst"),
        templateId,
        title: payload.title,
        status: person ? "assigned" : "open",
        assigneePersonId: person?.id,
        assignee: person?.displayName,
        dueDate: payload.dueDate,
        createdAt: now,
        source: "manual",
      });
      saveLocalV2(store);
    }
    form.reset();
    kindInput.value = "once";
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
      backend === "supabase" || backend === "supabase-rich"
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
  if (
    document.visibilityState === "visible" &&
    (backend === "supabase" || backend === "supabase-rich")
  ) {
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
  if (backend === "supabase-rich") {
    setStatus("Connected (rich model). Polling…");
    startPolling();
  } else if (backend === "supabase") {
    setStatus("Connected to Supabase (legacy table). Run schema.sql for steps/photos.");
    startPolling();
  } else if (backend === "local") {
    setStatus("Saved on this device (no Supabase / API).");
  }
  await loadChores({ quiet: true });
})().catch((error) => {
  summaryEl.textContent = "Could not load chores.";
  setStatus(error.message);
});
