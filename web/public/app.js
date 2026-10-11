const listEl = document.querySelector("#chore-list");
const scoreboardEl = document.querySelector("#scoreboard");
const emptyEl = document.querySelector("#empty-state");
const summaryEl = document.querySelector("#summary");
const form = document.querySelector("#add-form");
const formStatus = document.querySelector("#form-status");
const titleInput = document.querySelector("#title");
const assigneeInput = document.querySelector("#assignee");
const dueDateInput = document.querySelector("#dueDate");
const kindInput = document.querySelector("#kind");
const recurrenceFields = document.querySelector("#recurrence-fields");
const recurrenceIntervalInput = document.querySelector("#recurrenceInterval");
const recurrenceUnitInput = document.querySelector("#recurrenceUnit");
const pointsFields = document.querySelector("#points-fields");
const pointsInput = document.querySelector("#points");
const stepsInput = document.querySelector("#steps");
const referencePhotoInput = document.querySelector("#referencePhoto");
const personNameInput = document.querySelector("#personName");
const personRoleInput = document.querySelector("#personRole");
const addPersonBtn = document.querySelector("#add-person");
const meSelect = document.querySelector("#me-person");
const adminHint = document.querySelector("#admin-hint");
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
const DEFAULT_PERIODIC_INTERVAL = 4;
const DEFAULT_PERIODIC_UNIT = "week";
const DEFAULT_TASK_POINTS = 1;

let filter = "open";
/** @type {Array<Record<string, unknown>>} */
let chores = [];
/** @type {Array<{id: string, displayName: string, role: string}>} */
let people = [];
/** @type {Map<string, Record<string, unknown>>} */
let templatesById = new Map();
/** @type {Array<Record<string, unknown>>} */
let completions = [];
/** @type {Array<{personId: string, displayName: string, role: string, points: number}>} */
let scoreRows = [];
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
  const date = new Date(
    dueDate.includes("T") ? dueDate : `${dueDate}T12:00:00`,
  );
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

function isAdminRole(role) {
  return role === "parent";
}

function currentPerson() {
  const id = meSelect.value;
  if (!id) return null;
  return people.find((p) => p.id === id) ?? null;
}

function isAdmin() {
  return isAdminRole(currentPerson()?.role);
}

function resolveRecurrence(kind, interval, unit) {
  if (kind === "once") return {};
  if (kind === "daily") {
    return { recurrenceInterval: 1, recurrenceUnit: "day", cooldownDays: 1 };
  }
  const resolvedUnit = unit || DEFAULT_PERIODIC_UNIT;
  const resolvedInterval =
    interval !== undefined && Number(interval) > 0
      ? Math.floor(Number(interval))
      : DEFAULT_PERIODIC_INTERVAL;
  return {
    recurrenceInterval: resolvedInterval,
    recurrenceUnit: resolvedUnit,
    cooldownDays: resolvedInterval * (resolvedUnit === "week" ? 7 : 1),
  };
}

function formatRecurrenceLabel(kind, interval, unit) {
  if (kind === "once") return null;
  if (kind === "daily") return "Daily";
  const resolved = resolveRecurrence(kind, interval, unit);
  const n = resolved.recurrenceInterval ?? DEFAULT_PERIODIC_INTERVAL;
  const u = resolved.recurrenceUnit ?? DEFAULT_PERIODIC_UNIT;
  if (u === "week") return n === 1 ? "Every week" : `Every ${n} weeks`;
  return n === 1 ? "Every day" : `Every ${n} days`;
}

function nextDueAt(completedAtIso, kind, interval, unit) {
  if (kind === "once") return undefined;
  const ms = Date.parse(completedAtIso);
  const base = Number.isNaN(ms) ? Date.now() : ms;
  if (kind === "daily") {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const { cooldownDays } = resolveRecurrence(kind, interval, unit);
  return new Date(base + (cooldownDays ?? 28) * 86400000).toISOString();
}

function computeScoreboard(peopleList, completionList) {
  const totals = new Map();
  for (const event of completionList) {
    const status = event.assessmentStatus ?? event.assessment_status;
    const personId = event.personId ?? event.person_id;
    if (status !== "approved" || !personId) continue;
    const add = Number(event.pointsAwarded ?? event.points_awarded ?? 0);
    totals.set(personId, (totals.get(personId) ?? 0) + add);
  }
  return peopleList
    .map((person) => ({
      personId: person.id,
      displayName: person.displayName,
      role: person.role,
      points: totals.get(person.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.points - a.points || a.displayName.localeCompare(b.displayName),
    );
}

function syncComposerAdminUi() {
  const admin = isAdmin();
  pointsFields.classList.toggle("hidden", !admin);
  adminHint.classList.toggle("hidden", !admin);
  const periodic = kindInput.value === "periodic";
  recurrenceFields.classList.toggle("hidden", !periodic);
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

function latestCompletionForInstance(instanceId) {
  const matches = completions.filter(
    (c) => (c.instanceId ?? c.instance_id) === instanceId,
  );
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    const ta = Date.parse(a.completedAt ?? a.completed_at ?? "") || 0;
    const tb = Date.parse(b.completedAt ?? b.completed_at ?? "") || 0;
    return tb - ta;
  });
  return matches[0];
}

function instanceToView(row, template) {
  const status = row.status;
  const openLike =
    status === "noticed" || status === "open" || status === "assigned";
  const steps = Array.isArray(template?.steps) ? template.steps : [];
  const kind = template?.kind || "once";
  const interval = template?.recurrence_interval ?? template?.recurrenceInterval;
  const unit = template?.recurrence_unit ?? template?.recurrenceUnit;
  const points = Number(
    template?.points ?? DEFAULT_TASK_POINTS,
  );
  const completion = latestCompletionForInstance(row.id);
  const assessmentStatus =
    completion?.assessmentStatus ?? completion?.assessment_status ?? null;
  return {
    id: row.id,
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    ...(row.assignee ? { assignee: row.assignee } : {}),
    status: openLike ? "open" : status === "waiting" ? "waiting" : "done",
    instanceStatus: status,
    ...(row.due_date ? { dueDate: row.due_date } : {}),
    ...(row.due_at ? { dueAt: row.due_at } : {}),
    createdAt: row.created_at,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    templateId: row.template_id ?? undefined,
    assigneePersonId: row.assignee_person_id ?? undefined,
    steps,
    referencePhotoPath: template?.reference_photo_path || undefined,
    kind,
    recurrenceInterval: interval,
    recurrenceUnit: unit,
    points,
    completionId: completion?.id,
    assessmentStatus,
    mode: "instance",
  };
}

async function listLegacySupabase(status) {
  let path = "chores?select=*&order=created_at.desc";
  if (status !== "all" && status !== "scores") {
    path += `&status=eq.${encodeURIComponent(status)}`;
  }
  const rows = await supabaseRequest(path);
  return (rows ?? []).map(rowToLegacyChore);
}

async function promoteDueWaitingRich(instanceRows) {
  const now = Date.now();
  const due = (instanceRows ?? []).filter((row) => {
    if (row.status !== "waiting" || !row.due_at) return false;
    const ms = Date.parse(row.due_at);
    return !Number.isNaN(ms) && ms <= now;
  });
  await Promise.all(
    due.map((row) =>
      supabaseRequest(`task_instances?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "open",
          opened_at: new Date().toISOString(),
          assignee_person_id: null,
          assignee: null,
          assigned_at: null,
        }),
      }).catch(() => null),
    ),
  );
  return due.length > 0;
}

async function listRichSupabase(status) {
  const [instanceRows, templateRows, peopleRows, completionRows] =
    await Promise.all([
      supabaseRequest("task_instances?select=*&order=created_at.desc"),
      supabaseRequest("task_templates?select=*&order=created_at.desc"),
      supabaseRequest("people?select=*&order=display_name.asc"),
      supabaseRequest("completion_events?select=*&order=completed_at.desc"),
    ]);
  people = (peopleRows ?? []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    role: row.role,
  }));
  templatesById = new Map((templateRows ?? []).map((row) => [row.id, row]));
  completions = completionRows ?? [];
  scoreRows = computeScoreboard(people, completions);

  if (await promoteDueWaitingRich(instanceRows)) {
    const refreshed = await supabaseRequest(
      "task_instances?select=*&order=created_at.desc",
    );
    return finalizeRichViews(refreshed, status);
  }
  return finalizeRichViews(instanceRows, status);
}

function finalizeRichViews(instanceRows, status) {
  const views = (instanceRows ?? []).map((row) =>
    instanceToView(row, row.template_id ? templatesById.get(row.template_id) : null),
  );
  if (status === "scores" || status === "all") return views;
  if (status === "done") {
    return views.filter(
      (c) => c.status === "done" || c.instanceStatus === "done",
    );
  }
  return views.filter(
    (c) =>
      c.instanceStatus === "noticed" ||
      c.instanceStatus === "open" ||
      c.instanceStatus === "assigned",
  );
}

async function findOrCreatePerson(name, role = "child") {
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
        role: role || "child",
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
  const person = {
    id: newId("person"),
    displayName: trimmed,
    role: role || "child",
  };
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
  const kind = input.kind || "once";
  const recurrence = resolveRecurrence(
    kind,
    input.recurrenceInterval,
    input.recurrenceUnit,
  );
  const points =
    isAdmin() && input.points !== undefined
      ? Math.max(0, Math.floor(Number(input.points)))
      : DEFAULT_TASK_POINTS;
  const templateId = newId("tmpl");
  const instanceId = newId("inst");
  await supabaseRequest("task_templates", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      id: templateId,
      title: input.title.trim(),
      kind,
      cooldown_days: recurrence.cooldownDays ?? null,
      recurrence_interval: recurrence.recurrenceInterval ?? null,
      recurrence_unit: recurrence.recurrenceUnit ?? null,
      points,
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
  templatesById.set(templateId, {
    id: templateId,
    kind,
    steps: input.steps ?? [],
    reference_photo_path: referencePath,
    recurrence_interval: recurrence.recurrenceInterval,
    recurrence_unit: recurrence.recurrenceUnit,
    points,
  });
  return instanceToView(rows[0], templatesById.get(templateId));
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

async function scheduleNextRich(chore, completedAt) {
  const template = chore.templateId
    ? templatesById.get(chore.templateId)
    : null;
  if (!template || template.kind === "once" || template.active === false) {
    return;
  }
  const dueAt = nextDueAt(
    completedAt,
    template.kind,
    template.recurrence_interval ?? template.recurrenceInterval,
    template.recurrence_unit ?? template.recurrenceUnit,
  );
  const now = new Date().toISOString();
  await supabaseRequest("task_instances", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      id: newId("inst"),
      template_id: template.id,
      title: template.title || chore.title,
      estimated_minutes: template.estimated_minutes ?? 10,
      status: "waiting",
      assignee_person_id: null,
      assignee: null,
      opened_at: now,
      due_at: dueAt ?? null,
      source: "schedule",
      created_at: now,
    }),
  });
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
      assessment_status: "pending",
      points_awarded: null,
      created_at: now,
    }),
  });
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
    await scheduleNextRich(chore, now);
  } catch (error) {
    console.warn("Re-raise schedule failed", error);
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

async function assessRich(chore, decision) {
  if (!isAdmin()) {
    throw new Error("Pick “I am” a parent to assess completions.");
  }
  if (!chore.completionId) {
    throw new Error("No completion to assess for this task.");
  }
  const assessor = currentPerson();
  const template = chore.templateId
    ? templatesById.get(chore.templateId)
    : null;
  const award =
    decision === "approved"
      ? Number(template?.points ?? chore.points ?? DEFAULT_TASK_POINTS)
      : 0;
  const now = new Date().toISOString();
  await supabaseRequest(
    `completion_events?id=eq.${encodeURIComponent(chore.completionId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        assessment_status: decision,
        points_awarded: award,
        assessed_by_person_id: assessor.id,
        assessed_at: now,
      }),
    },
  );
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

function promoteLocalWaiting(store) {
  const now = Date.now();
  let changed = false;
  const instances = store.instances.map((row) => {
    const status = row.status;
    const dueAt = row.dueAt ?? row.due_at;
    if (status !== "waiting" || !dueAt) return row;
    const ms = Date.parse(dueAt);
    if (Number.isNaN(ms) || ms > now) return row;
    changed = true;
    const next = { ...row, status: "open", openedAt: new Date().toISOString() };
    delete next.assigneePersonId;
    delete next.assignee_person_id;
    delete next.assignee;
    delete next.assignedAt;
    delete next.assigned_at;
    return next;
  });
  if (!changed) return store;
  const nextStore = { ...store, instances };
  saveLocalV2(nextStore);
  return nextStore;
}

function listLocal(status) {
  let store = promoteLocalWaiting(loadLocalV2());
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
        recurrence_interval: t.recurrenceInterval ?? t.recurrence_interval,
        recurrence_unit: t.recurrenceUnit ?? t.recurrence_unit,
        points: t.points ?? DEFAULT_TASK_POINTS,
      },
    ]),
  );
  completions = store.completions;
  scoreRows = computeScoreboard(people, completions);
  const views = store.instances.map((row) => {
    const normalized = {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      assignee: row.assignee,
      assignee_person_id: row.assigneePersonId ?? row.assignee_person_id,
      due_date: row.dueDate ?? row.due_date,
      due_at: row.dueAt ?? row.due_at,
      created_at: row.createdAt ?? row.created_at,
      completed_at: row.completedAt ?? row.completed_at,
      template_id: row.templateId ?? row.template_id,
    };
    return instanceToView(
      normalized,
      normalized.template_id ? templatesById.get(normalized.template_id) : null,
    );
  });
  if (status === "scores" || status === "all") return views;
  if (status === "done") {
    return views.filter((c) => c.instanceStatus === "done");
  }
  return views.filter(
    (c) =>
      c.instanceStatus === "noticed" ||
      c.instanceStatus === "open" ||
      c.instanceStatus === "assigned",
  );
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
  // Escape hatch for demos / offline rich UI: ?local=1 or localStorage flag.
  const forceLocal =
    new URLSearchParams(location.search).get("local") === "1" ||
    localStorage.getItem("chores.forceLocal") === "1";
  if (forceLocal) return "local";

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
        console.warn("Legacy chores missing", error);
      } else {
        console.warn("Supabase legacy unavailable", error);
      }
    }
  }
  try {
    await api("api/chores?status=open");
    return "api";
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
    const admin = isAdminRole(person.role) ? " · parent" : "";
    opt.textContent = `${person.displayName}${admin}`;
    meSelect.append(opt);
  }
  if (previous && people.some((p) => p.id === previous)) {
    meSelect.value = previous;
  }
  syncComposerAdminUi();
}

function renderScoreboard() {
  listEl.innerHTML = "";
  listEl.classList.add("hidden");
  scoreboardEl.classList.remove("hidden");
  emptyEl.classList.add("hidden");
  scoreboardEl.innerHTML = "";
  fillMeSelect();
  summaryEl.textContent =
    scoreRows.length === 0
      ? "Add household people to start the scoreboard."
      : "Points from parent-approved completions.";

  if (scoreRows.length === 0) {
    emptyEl.textContent = "No people yet. Add a parent or child below.";
    emptyEl.classList.remove("hidden");
    return;
  }

  for (const row of scoreRows) {
    const item = document.createElement("div");
    item.className = "score-row";
    const left = document.createElement("div");
    const name = document.createElement("p");
    name.className = "score-name";
    name.textContent = row.displayName;
    const role = document.createElement("p");
    role.className = "score-role";
    role.textContent =
      row.role === "parent"
        ? "Parent (admin)"
        : row.role === "other"
          ? "Other"
          : "Child";
    left.append(name, role);
    const pts = document.createElement("div");
    pts.className = "score-points";
    pts.textContent = String(row.points);
    pts.setAttribute("aria-label", `${row.points} points`);
    item.append(left, pts);
    scoreboardEl.append(item);
  }
}

function render() {
  if (filter === "scores") {
    renderScoreboard();
    return;
  }

  scoreboardEl.classList.add("hidden");
  scoreboardEl.innerHTML = "";
  listEl.classList.remove("hidden");
  listEl.innerHTML = "";
  emptyEl.classList.toggle("hidden", chores.length > 0);
  emptyEl.textContent =
    "Nothing here yet. Add the next household task below.";
  fillMeSelect();

  const openCount = chores.filter(
    (chore) =>
      chore.instanceStatus === "open" ||
      chore.instanceStatus === "assigned" ||
      chore.instanceStatus === "noticed" ||
      (chore.status === "open" && !chore.instanceStatus),
  ).length;
  if (filter === "open") {
    summaryEl.textContent =
      openCount === 0
        ? "All clear for now."
        : `${openCount} open ${openCount === 1 ? "task" : "tasks"} for the household.`;
  } else if (filter === "done") {
    summaryEl.textContent = "Recently finished work — parents assess for points.";
  } else {
    summaryEl.textContent = "Everything on the household board.";
  }

  for (const chore of chores) {
    if (chore.instanceStatus === "waiting" && filter !== "all") continue;

    const li = document.createElement("li");
    const done =
      chore.status === "done" || chore.instanceStatus === "done";
    li.className = `chore${done ? " is-done" : ""}`;
    li.dataset.id = chore.id;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "check";
    button.setAttribute("aria-pressed", done ? "true" : "false");
    button.setAttribute(
      "aria-label",
      done ? `Mark ${chore.title} as open` : `Mark ${chore.title} as done`,
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
    const recur = formatRecurrenceLabel(
      chore.kind,
      chore.recurrenceInterval,
      chore.recurrenceUnit,
    );
    if (recur) {
      const kind = document.createElement("span");
      kind.className = "meta-pill";
      kind.textContent = recur;
      meta.append(kind);
    }
    if (chore.points !== undefined && chore.mode === "instance") {
      const pts = document.createElement("span");
      pts.className = "meta-pill";
      pts.textContent = `${chore.points} pt${chore.points === 1 ? "" : "s"}`;
      meta.append(pts);
    }
    if (chore.instanceStatus === "waiting") {
      const waiting = document.createElement("span");
      waiting.className = "meta-pill";
      const when = formatDue(chore.dueAt);
      waiting.textContent = when ? `Resting until ${when}` : "Resting";
      meta.append(waiting);
    }
    if (done && chore.assessmentStatus === "pending") {
      const pending = document.createElement("span");
      pending.className = "meta-pill is-pending";
      pending.textContent = "Pending assessment";
      meta.append(pending);
    } else if (done && chore.assessmentStatus === "approved") {
      const ok = document.createElement("span");
      ok.className = "meta-pill is-approved";
      ok.textContent = "Approved";
      meta.append(ok);
    } else if (done && chore.assessmentStatus === "rejected") {
      const no = document.createElement("span");
      no.className = "meta-pill is-pending";
      no.textContent = "Not approved";
      meta.append(no);
    }
    const dueLabel = formatDue(chore.dueDate || chore.dueAt);
    if (dueLabel && chore.instanceStatus !== "waiting") {
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
      img.src =
        storagePublicUrl(chore.referencePhotoPath) || chore.referencePhotoPath;
      img.alt = "What good looks like";
      img.loading = "lazy";
      const caption = document.createElement("figcaption");
      caption.textContent = "What good looks like";
      figure.append(img, caption);
      body.append(figure);
    }

    if (!done && chore.instanceStatus !== "waiting" && backend !== "api") {
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

    if (
      done &&
      chore.assessmentStatus === "pending" &&
      chore.completionId &&
      isAdmin() &&
      (backend === "supabase-rich" || backend === "local")
    ) {
      const assess = document.createElement("div");
      assess.className = "assess-actions";
      const approve = document.createElement("button");
      approve.type = "button";
      approve.className = "text-btn";
      approve.textContent = `Approve (+${chore.points ?? DEFAULT_TASK_POINTS} pts)`;
      approve.addEventListener("click", () => {
        void assessChore(chore, "approved");
      });
      const reject = document.createElement("button");
      reject.type = "button";
      reject.className = "text-btn is-reject";
      reject.textContent = "Reject";
      reject.addEventListener("click", () => {
        void assessChore(chore, "rejected");
      });
      assess.append(approve, reject);
      body.append(assess);
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
    scoreRows = [];
  } else if (backend === "api") {
    const data = await api(`api/chores?status=${encodeURIComponent(filter === "scores" ? "all" : filter)}`);
    chores = (data.chores ?? []).map((c) => ({ ...c, mode: "legacy" }));
    scoreRows = [];
  } else {
    chores = listLocal(filter);
  }
  render();
  if (!quiet && (backend === "supabase" || backend === "supabase-rich")) {
    setStatus(
      backend === "supabase-rich"
        ? "Synced (points + recurrence + assessment)."
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
    syncComposerAdminUi();
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
    syncComposerAdminUi();
    return {
      id: person.id,
      displayName: person.displayName ?? person.display_name,
      role: person.role ?? "child",
    };
  }

  const person = { id: newId("person"), displayName: name, role: "child" };
  people = [...people.filter((p) => p.displayName !== name), person];
  fillMeSelect();
  meSelect.value = person.id;
  localStorage.setItem(ME_KEY, person.id);
  syncComposerAdminUi();
  return person;
}

async function addHouseholdPerson() {
  const name = personNameInput.value.trim();
  if (!name) {
    setStatus("Enter a name to add a household person.");
    return;
  }
  const role = personRoleInput.value || "child";
  try {
    if (backend === "supabase-rich") {
      await findOrCreatePerson(name, role);
    } else if (backend === "local") {
      const store = loadLocalV2();
      const existing = store.people.find(
        (p) =>
          (p.displayName || p.display_name || "").toLowerCase() ===
          name.toLowerCase(),
      );
      if (existing) {
        existing.role = role;
      } else {
        store.people.push({
          id: newId("person"),
          displayName: name,
          role,
          active: true,
          createdAt: new Date().toISOString(),
        });
      }
      saveLocalV2(store);
      people = store.people.map((p) => ({
        id: p.id,
        displayName: p.displayName ?? p.display_name,
        role: p.role ?? "child",
      }));
      scoreRows = computeScoreboard(people, store.completions);
    } else {
      setStatus("Adding people needs rich Supabase schema or local mode.");
      return;
    }
    personNameInput.value = "";
    fillMeSelect();
    setStatus(
      role === "parent"
        ? `Added ${name} as parent (admin). Select them under “I am”.`
        : `Added ${name}.`,
    );
    if (filter === "scores") render();
  } catch (error) {
    setStatus(error.message);
  }
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

async function assessChore(chore, decision) {
  try {
    if (!isAdmin()) {
      throw new Error("Pick “I am” a parent to assess completions.");
    }
    if (backend === "supabase-rich") {
      await assessRich(chore, decision);
    } else if (backend === "local") {
      const store = loadLocalV2();
      const assessor = currentPerson();
      const index = store.completions.findIndex((c) => c.id === chore.completionId);
      if (index < 0) throw new Error("No completion to assess.");
      const template = store.templates.find(
        (t) => t.id === (chore.templateId || store.completions[index].templateId),
      );
      const award =
        decision === "approved"
          ? Number(template?.points ?? chore.points ?? DEFAULT_TASK_POINTS)
          : 0;
      store.completions[index] = {
        ...store.completions[index],
        assessmentStatus: decision,
        pointsAwarded: award,
        assessedByPersonId: assessor.id,
        assessedAt: new Date().toISOString(),
      };
      saveLocalV2(store);
    } else {
      throw new Error("Assessment needs rich schema or local mode.");
    }
    setStatus(
      decision === "approved"
        ? "Approved — points added to the scoreboard."
        : "Rejected — no points awarded.",
    );
    await loadChores({ quiet: true });
  } catch (error) {
    setStatus(error.message);
  }
}

function onCheckClick(chore) {
  if (chore.status === "done" || chore.instanceStatus === "done") {
    void reopenChore(chore);
    return;
  }
  if (chore.instanceStatus === "waiting") {
    setStatus("This task is resting until its next due date.");
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
      const current = store.instances[index];
      store.instances[index] = {
        ...current,
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
        assessmentStatus: "pending",
        createdAt: now,
      });
      const template = store.templates.find((t) => t.id === chore.templateId);
      if (template && template.kind !== "once") {
        const dueAt = nextDueAt(
          now,
          template.kind,
          template.recurrenceInterval ?? template.recurrence_interval,
          template.recurrenceUnit ?? template.recurrence_unit,
        );
        store.instances.push({
          id: newId("inst"),
          templateId: template.id,
          title: template.title,
          status: "waiting",
          dueAt,
          openedAt: now,
          createdAt: now,
          source: "schedule",
          estimatedMinutes: template.estimatedMinutes ?? 10,
        });
      }
      saveLocalV2(store);
    }
    setStatus(
      proofFile
        ? `Marked done (proof kept ~${PROOF_TTL_DAYS} days). Pending parent assessment.`
        : "Marked done. Pending parent assessment.",
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
  syncComposerAdminUi();
  render();
});

kindInput.addEventListener("change", () => {
  syncComposerAdminUi();
});

addPersonBtn.addEventListener("click", () => {
  void addHouseholdPerson();
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
    const kind = kindInput.value || "once";
    const recurrence = resolveRecurrence(
      kind,
      Number(recurrenceIntervalInput.value) || DEFAULT_PERIODIC_INTERVAL,
      recurrenceUnitInput.value || DEFAULT_PERIODIC_UNIT,
    );
    const payload = {
      title,
      assignee: assigneeInput.value.trim() || undefined,
      dueDate: dueDateInput.value || undefined,
      kind,
      recurrenceInterval: recurrence.recurrenceInterval,
      recurrenceUnit: recurrence.recurrenceUnit,
      points: isAdmin()
        ? Math.max(0, Math.floor(Number(pointsInput.value) || DEFAULT_TASK_POINTS))
        : DEFAULT_TASK_POINTS,
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
        recurrenceInterval: payload.recurrenceInterval,
        recurrenceUnit: payload.recurrenceUnit,
        cooldownDays: recurrence.cooldownDays,
        points: payload.points,
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
    recurrenceIntervalInput.value = String(DEFAULT_PERIODIC_INTERVAL);
    recurrenceUnitInput.value = DEFAULT_PERIODIC_UNIT;
    pointsInput.value = String(DEFAULT_TASK_POINTS);
    syncComposerAdminUi();
    titleInput.focus();
    if (filter === "done" || filter === "scores") {
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

syncComposerAdminUi();

void (async () => {
  backend = await detectBackend();
  if (backend === "supabase-rich") {
    setStatus("Connected (rich model). Polling…");
    startPolling();
  } else if (backend === "supabase") {
    setStatus("Connected to Supabase (legacy table). Run schema.sql for points/recurrence.");
    startPolling();
  } else if (backend === "local") {
    setStatus("Saved on this device (no Supabase / API).");
  }
  await loadChores({ quiet: true });
})().catch((error) => {
  summaryEl.textContent = "Could not load chores.";
  setStatus(error.message);
});
