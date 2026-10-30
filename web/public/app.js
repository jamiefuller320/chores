const listEl = document.querySelector("#chore-list");
const scoreboardEl = document.querySelector("#scoreboard");
const peoplePanelEl = document.querySelector("#people-panel");
const emptyEl = document.querySelector("#empty-state");
const summaryEl = document.querySelector("#summary");
const composerDock = document.querySelector("#composer-dock");
const composerDialog = document.querySelector("#composer-dialog");
const newTaskToggle = document.querySelector("#new-task-toggle");
const composerCloseBtn = document.querySelector("#composer-close");
const form = document.querySelector("#add-form");
const formStatus = document.querySelector("#form-status");
const titleInput = document.querySelector("#title");
const descriptionInput = document.querySelector("#description");
const assigneeInput = document.querySelector("#assignee");
const dueDateInput = document.querySelector("#dueDate");
const completeByFields = document.querySelector("#complete-by-fields");
const completeByInput = document.querySelector("#completeBy");
const kindInput = document.querySelector("#kind");
const recurrenceFields = document.querySelector("#recurrence-fields");
const recurrenceIntervalInput = document.querySelector("#recurrenceInterval");
const recurrenceUnitInput = document.querySelector("#recurrenceUnit");
const recurrenceIntervalLabel = document.querySelector(
  "#recurrence-interval-label",
);
const recurrenceUnitText = document.querySelector("#recurrence-unit-text");
const recurrenceHint = document.querySelector("#recurrence-hint");
const pointsFields = document.querySelector("#points-fields");
const pointsInput = document.querySelector("#points");
const stepsInput = document.querySelector("#steps");
const referencePhotoInput = document.querySelector("#referencePhoto");
const meSelect = document.querySelector("#me-person");
const adminHint = document.querySelector("#admin-hint");
const filterButtons = [...document.querySelectorAll(".filter")];
const taskDialog = document.querySelector("#task-dialog");
const taskCardTitle = document.querySelector("#task-card-title");
const taskCardBody = document.querySelector("#task-card-body");
const taskCardActions = document.querySelector("#task-card-actions");
const taskCardClose = document.querySelector("#task-card-close");
const completeDialog = document.querySelector("#complete-dialog");
const completeForm = document.querySelector("#complete-form");
const completeTitleEl = document.querySelector("#complete-title");
const completePersonSelect = document.querySelector("#complete-person");
const completeMinutesInput = document.querySelector("#complete-minutes");
const completeDifficultyInput = document.querySelector("#complete-difficulty");
const proofPhotoInput = document.querySelector("#proofPhoto");
const proofVideo = document.querySelector("#proof-video");
const proofPreview = document.querySelector("#proof-preview");
const proofCanvas = document.querySelector("#proof-canvas");
const proofOpenCameraBtn = document.querySelector("#proof-open-camera");
const proofShutterBtn = document.querySelector("#proof-shutter");
const proofRetakeBtn = document.querySelector("#proof-retake");
const proofPickFileBtn = document.querySelector("#proof-pick-file");
const proofCameraStatus = document.querySelector("#proof-camera-status");
const proofCameraStage = document.querySelector("#proof-camera-block .camera-stage");
const referenceOpenCameraBtn = document.querySelector("#reference-open-camera");
const referenceCameraStatus = document.querySelector("#reference-camera-status");
const editDialog = document.querySelector("#edit-dialog");
const editForm = document.querySelector("#edit-form");
const editTitleInput = document.querySelector("#edit-title");
const editDescriptionInput = document.querySelector("#edit-description");
const editAssigneeInput = document.querySelector("#edit-assignee");
const editCompleteByFields = document.querySelector("#edit-complete-by-fields");
const editCompleteByInput = document.querySelector("#edit-completeBy");
const editKindInput = document.querySelector("#edit-kind");
const editRecurrenceFields = document.querySelector("#edit-recurrence-fields");
const editRecurrenceIntervalInput = document.querySelector("#edit-recurrenceInterval");
const editRecurrenceUnitInput = document.querySelector("#edit-recurrenceUnit");
const editRecurrenceIntervalLabel = document.querySelector(
  "#edit-recurrence-interval-label",
);
const editRecurrenceUnitText = document.querySelector(
  "#edit-recurrence-unit-text",
);
const editRecurrenceHint = document.querySelector("#edit-recurrence-hint");
const editPointsInput = document.querySelector("#edit-points");
const editDueDateInput = document.querySelector("#edit-dueDate");
const editStepsInput = document.querySelector("#edit-steps");
const editReferencePhotoInput = document.querySelector("#edit-referencePhoto");
const editReferenceOpenCameraBtn = document.querySelector("#edit-reference-open-camera");
const editRefHint = document.querySelector("#edit-ref-hint");
const cameraDialog = document.querySelector("#camera-dialog");
const sharedVideo = document.querySelector("#shared-video");
const sharedPreview = document.querySelector("#shared-preview");
const sharedCanvas = document.querySelector("#shared-canvas");
const sharedShutterBtn = document.querySelector("#shared-shutter");
const sharedRetakeBtn = document.querySelector("#shared-retake");
const sharedKeepBtn = document.querySelector("#shared-keep");
const sharedCancelBtn = document.querySelector("#shared-cancel");
const sharedCameraStatus = document.querySelector("#shared-camera-status");
const sharedCameraStage = document.querySelector("#camera-dialog .camera-stage");

/** Base URL for this deploy (works on GitHub project Pages under /chores/). */
const BASE = new URL("./", import.meta.url);
const STORAGE_KEY_V1 = "chores.household.v1";
const STORAGE_KEY_V2 = "chores.household.v2";
const ME_KEY = "chores.me.personId";
/** Stale-while-revalidate cache for list/scoreboard paint. */
const SWR_CACHE_KEY = "chores.swr.v1";
const CONFIG = window.CHORES_CONFIG ?? {};
const PROOF_TTL_DAYS = 7;
const PHOTO_BUCKET = "chore-photos";
const DEFAULT_PERIODIC_INTERVAL = 4;
const DEFAULT_PERIODIC_UNIT = "week";
/** Sensible starting N for the explicit “every N days after done” path. */
const DEFAULT_DAYS_AFTER_INTERVAL = 7;
const DEFAULT_TASK_POINTS = 1;
const DEFAULT_HOUSEHOLD_TIMEZONE = "Europe/London";
const HOUSEHOLD_META_ID = "default";
/**
 * v1 product default: treat the Pages UI as full parent/admin mode.
 * Real logins + password-reset authority come later (see chore-model-plan).
 */
const ADMIN_UI_MODE = true;

let filter = "open";
/** Recently created chores kept visible across brief Supabase read-after-write races. */
const recentCreates = new Map();
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
/** @type {Array<{id: string, weekEnding: string, periodLabel?: string, personId: string, displayName: string, points: number}>} */
let pointsHistory = [];
/** @type {string | null} */
let lastPointsResetAt = null;
/** @type {string} */
let householdTimezone = DEFAULT_HOUSEHOLD_TIMEZONE;
/** @type {"supabase-rich" | "supabase" | "api" | "local"} */
let backend = "local";
/** @type {ReturnType<typeof setInterval> | null} */
let pollTimer = null;
/** @type {Record<string, unknown> | null} */
let pendingComplete = null;
/** @type {Record<string, unknown> | null} */
let pendingEdit = null;
/** @type {Record<string, unknown> | null} */
let pendingTaskCard = null;
/** @type {boolean} */
let paintedFromCache = false;
/** @type {boolean} */
let composerOpen = false;
/** True after detectBackend finishes so claim release can persist. */
let backendReady = false;
/** Monotonic load generation — drop stale poll/save responses. */
let loadEpoch = 0;
/** Last painted board fingerprint; quiet polls skip DOM/SWR when unchanged. */
let lastBoardFingerprint = "";
/** @type {Set<string>} */
const pendingReleaseIds = new Set();
/** @type {ReturnType<typeof setTimeout> | null} */
let releasePersistTimer = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let releaseTickTimer = null;
/** @type {MediaStream | null} */
let proofStream = null;
/** @type {MediaStream | null} */
let sharedStream = null;
/** @type {File | null} */
let proofCapturedFile = null;
/** @type {((file: File | null) => void) | null} */
let sharedCameraResolve = null;
/** @type {File | null} */
let sharedCapturedFile = null;

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

function formatCompleteBy(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function completeByFromLocalInput(value) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function completeByToLocalInput(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function claimHoldExpired(chore, now = Date.now()) {
  const status = chore.instanceStatus || chore.status;
  if (status === "done" || status === "waiting" || status === "retired") {
    return false;
  }
  const until = chore.completeBy || chore.complete_by;
  if (!until) return false;
  if (status !== "assigned" && !chore.assignee && !chore.assigneePersonId) {
    return false;
  }
  const ms = Date.parse(until);
  return !Number.isNaN(ms) && ms <= now;
}

function releasedChoreView(chore) {
  const next = { ...chore, status: "open", instanceStatus: "open" };
  delete next.assignee;
  delete next.assigneePersonId;
  delete next.completeBy;
  delete next.complete_by;
  return next;
}

function schedulePersistReleases() {
  if (releasePersistTimer) return;
  releasePersistTimer = setTimeout(() => {
    releasePersistTimer = null;
    if (!backendReady) return;
    void flushReleasedClaims();
  }, 0);
}

function scheduleNextReleaseTick() {
  if (releaseTickTimer) clearTimeout(releaseTickTimer);
  releaseTickTimer = null;
  const now = Date.now();
  let soonest = null;
  for (const chore of chores) {
    const until = chore.completeBy || chore.complete_by;
    const status = chore.instanceStatus || chore.status;
    if (!until || status === "done" || status === "waiting" || status === "retired") {
      continue;
    }
    const ms = Date.parse(until);
    if (Number.isNaN(ms) || ms <= now) continue;
    if (soonest === null || ms < soonest) soonest = ms;
  }
  if (soonest === null) return;
  releaseTickTimer = setTimeout(() => {
    render();
  }, Math.max(0, soonest - Date.now() + 40));
}

/** Drop expired assignee holds in the in-memory list and queue a persist. */
function absorbExpiredClaims() {
  const now = Date.now();
  let count = 0;
  const next = chores.map((chore) => {
    if (!claimHoldExpired(chore, now)) return chore;
    count += 1;
    pendingReleaseIds.add(String(chore.id));
    return releasedChoreView(chore);
  });
  if (count === 0) return 0;
  chores = next;
  schedulePersistReleases();
  if (pendingTaskCard && taskDialog?.open) {
    const fresh = chores.find((c) => c.id === pendingTaskCard.id);
    if (fresh && pendingTaskCard.assignee && !fresh.assignee) {
      openTaskCard(fresh);
    }
  }
  return count;
}

async function flushReleasedClaims() {
  if (!backendReady || pendingReleaseIds.size === 0) return;
  const ids = [...pendingReleaseIds];
  pendingReleaseIds.clear();
  const patch = {
    status: "open",
    assignee_person_id: null,
    assignee: null,
    assigned_at: null,
    complete_by: null,
  };
  try {
    if (backend === "supabase-rich") {
      await Promise.all(
        ids.map((id) =>
          supabaseWriteOmittingUnknownColumns(
            `task_instances?id=eq.${encodeURIComponent(id)}&status=eq.assigned`,
            {
              method: "PATCH",
              headers: { Prefer: "return=minimal" },
              body: JSON.stringify(patch),
            },
            ["complete_by"],
          ).catch(() => null),
        ),
      );
      await Promise.all(
        ids.map((id) =>
          supabaseRequest(`chores?id=eq.${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ assignee: null }),
          }).catch(() => null),
        ),
      );
    } else if (backend === "local") {
      const store = loadLocalV2();
      let changed = false;
      store.instances = store.instances.map((row) => {
        if (!ids.includes(row.id)) return row;
        changed = true;
        const cleared = { ...row, status: "open" };
        delete cleared.assignee;
        delete cleared.assigneePersonId;
        delete cleared.assignee_person_id;
        delete cleared.assignedAt;
        delete cleared.assigned_at;
        delete cleared.completeBy;
        delete cleared.complete_by;
        return cleared;
      });
      if (changed) saveLocalV2(store);
    }
  } catch (error) {
    for (const id of ids) pendingReleaseIds.add(id);
    console.warn("Could not release expired claims", error);
  }
}

function syncCompleteByFields() {
  const showAdd = Boolean(assigneeInput.value.trim());
  completeByFields?.classList.toggle("hidden", !showAdd);
  if (!showAdd && completeByInput) completeByInput.value = "";
  const showEdit = Boolean(editAssigneeInput?.value.trim());
  editCompleteByFields?.classList.toggle("hidden", !showEdit);
  if (!showEdit && editCompleteByInput) editCompleteByInput.value = "";
}

function assignmentHoldError(assignee, completeByIso) {
  if (!assignee) return null;
  if (backend === "api" || backend === "supabase") return null;
  if (!completeByIso) {
    return "Set a complete-by time when assigning someone.";
  }
  return null;
}

function setStatus(message, { tone = "neutral" } = {}) {
  if (!formStatus) return;
  formStatus.textContent = message || "";
  formStatus.classList.toggle("is-error", tone === "error");
  formStatus.classList.toggle("is-ok", tone === "ok");
}

function formatAddError(error) {
  const raw = String(error?.message || error || "Could not add task.");
  if (/complete_by/i.test(raw) || /PGRST204/i.test(raw)) {
    return `Could not save task (database column missing). Run the complete_by SQL in Supabase, then try again. (${raw})`;
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(raw)) {
    return `Could not reach Supabase — check connection and try again. (${raw})`;
  }
  return raw.startsWith("Could not") ? raw : `Could not add task: ${raw}`;
}

/** Close composer and put the created open task on the title list immediately. */
function showCreatedTaskOnList(created) {
  if (!created) return;
  rememberCreatedChore(created);
  if (filter === "done" || filter === "scores" || filter === "people") {
    filter = "open";
    filterButtons.forEach((item) => {
      const active = item.dataset.filter === "open";
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", active ? "true" : "false");
    });
  }
  if (filter === "open" || filter === "all") {
    chores = [created, ...chores.filter((c) => String(c.id) !== String(created.id))];
    writeSwrCache();
    render();
  }
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
  // Full admin UI for now; later gate on parent login / Auth.
  if (ADMIN_UI_MODE) return true;
  return isAdminRole(currentPerson()?.role);
}

function stepsToTextarea(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return "";
  return [...steps]
    .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
    .map((s) => s.text)
    .join("\n");
}

function readSwrCache() {
  try {
    const raw = localStorage.getItem(SWR_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSwrCache() {
  try {
    const openViews = (chores || []).filter(
      (c) =>
        c.instanceStatus === "noticed" ||
        c.instanceStatus === "open" ||
        c.instanceStatus === "assigned" ||
        (c.status === "open" && !c.instanceStatus),
    );
    const payload = {
      savedAt: Date.now(),
      backend,
      people,
      scoreRows,
      pointsHistory,
      lastPointsResetAt,
      openChores: openViews,
      allChores: chores,
    };
    localStorage.setItem(SWR_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("SWR cache write failed", error);
  }
}

function paintFromSwrCache() {
  const cached = readSwrCache();
  if (!cached) return false;
  people = Array.isArray(cached.people) ? cached.people : [];
  scoreRows = Array.isArray(cached.scoreRows) ? cached.scoreRows : [];
  pointsHistory = Array.isArray(cached.pointsHistory)
    ? mapHistoryRows(cached.pointsHistory)
    : [];
  lastPointsResetAt = cached.lastPointsResetAt ?? null;
  if (filter === "open" && Array.isArray(cached.openChores)) {
    chores = cached.openChores;
  } else if (Array.isArray(cached.allChores)) {
    chores = cached.allChores;
  } else if (Array.isArray(cached.openChores)) {
    chores = cached.openChores;
  } else {
    chores = [];
  }
  paintedFromCache = true;
  render();
  summaryEl.textContent =
    filter === "scores"
      ? "Cached scores — refreshing…"
      : filter === "people"
        ? "Cached people — refreshing…"
        : "Showing cached list — refreshing…";
  return true;
}

function canUseGetUserMedia() {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

function stopMediaStream(stream) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function stopProofCamera() {
  stopMediaStream(proofStream);
  proofStream = null;
  if (proofVideo) {
    proofVideo.srcObject = null;
    proofVideo.classList.add("hidden");
  }
}

function stopSharedCamera() {
  stopMediaStream(sharedStream);
  sharedStream = null;
  if (sharedVideo) {
    sharedVideo.srcObject = null;
  }
}

async function canvasToImageFile(canvas, name = "photo.jpg") {
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Could not capture photo"));
      },
      "image/jpeg",
      0.92,
    );
  });
  return new File([blob], name, { type: "image/jpeg" });
}

function assignFileToInput(input, file) {
  if (!input || !file) return;
  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
  } catch (error) {
    console.warn("Could not assign file to input", error);
  }
}

function resetProofCameraUi() {
  stopProofCamera();
  proofCapturedFile = null;
  if (proofPhotoInput) proofPhotoInput.value = "";
  if (proofPreview) {
    proofPreview.src = "";
    proofPreview.classList.add("hidden");
  }
  if (proofCanvas) proofCanvas.classList.add("hidden");
  proofOpenCameraBtn?.classList.remove("hidden");
  proofShutterBtn?.classList.add("hidden");
  proofRetakeBtn?.classList.add("hidden");
  proofCameraStage?.classList.remove("is-live");
  if (proofCameraStatus) {
    proofCameraStatus.textContent = canUseGetUserMedia()
      ? "Open the camera for a quick proof shot, or use the photo library."
      : "Camera API unavailable — use the photo library (or system camera via file picker).";
  }
}

async function startProofCamera() {
  if (!canUseGetUserMedia()) {
    if (proofCameraStatus) {
      proofCameraStatus.textContent =
        "In-page camera blocked — opening the system camera / library.";
    }
    proofPhotoInput?.click();
    return;
  }
  try {
    stopProofCamera();
    proofCapturedFile = null;
    proofPreview?.classList.add("hidden");
    proofStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 960 },
      },
    });
    proofVideo.srcObject = proofStream;
    proofVideo.classList.remove("hidden");
    proofCameraStage?.classList.add("is-live");
    proofOpenCameraBtn?.classList.add("hidden");
    proofShutterBtn?.classList.remove("hidden");
    proofRetakeBtn?.classList.add("hidden");
    if (proofCameraStatus) {
      proofCameraStatus.textContent = "Aim at the finished work, then take a photo.";
    }
    await proofVideo.play().catch(() => {});
  } catch (error) {
    console.warn("getUserMedia failed", error);
    if (proofCameraStatus) {
      proofCameraStatus.textContent =
        "Could not open in-page camera — falling back to photo library.";
    }
    proofPhotoInput?.click();
  }
}

async function shutterProofCamera() {
  if (!proofVideo || !proofCanvas || !proofStream) return;
  const width = proofVideo.videoWidth || 1280;
  const height = proofVideo.videoHeight || 960;
  proofCanvas.width = width;
  proofCanvas.height = height;
  const ctx = proofCanvas.getContext("2d");
  if (!ctx) throw new Error("Could not capture frame");
  ctx.drawImage(proofVideo, 0, 0, width, height);
  const file = await canvasToImageFile(proofCanvas, `proof_${Date.now()}.jpg`);
  proofCapturedFile = file;
  assignFileToInput(proofPhotoInput, file);
  proofPreview.src = URL.createObjectURL(file);
  proofPreview.classList.remove("hidden");
  proofVideo.classList.add("hidden");
  stopProofCamera();
  proofShutterBtn?.classList.add("hidden");
  proofRetakeBtn?.classList.remove("hidden");
  proofOpenCameraBtn?.classList.add("hidden");
  proofCameraStage?.classList.add("is-live");
  if (proofCameraStatus) {
    proofCameraStatus.textContent = "Photo ready — retake if you want another shot.";
  }
}

function fillCompletePersonSelect() {
  const previous =
    completePersonSelect.value ||
    meSelect.value ||
    localStorage.getItem(ME_KEY) ||
    "";
  completePersonSelect.innerHTML = `<option value="">Choose a name…</option>`;
  for (const person of people) {
    const opt = document.createElement("option");
    opt.value = person.id;
    opt.textContent = person.displayName;
    completePersonSelect.append(opt);
  }
  if (previous && people.some((p) => p.id === previous)) {
    completePersonSelect.value = previous;
  }
}

async function openSharedCamera() {
  return new Promise((resolve) => {
    sharedCameraResolve = resolve;
    sharedPreview?.classList.add("hidden");
    sharedKeepBtn?.classList.add("hidden");
    sharedRetakeBtn?.classList.add("hidden");
    sharedShutterBtn?.classList.remove("hidden");
    sharedCameraStage?.classList.add("is-live");
    if (sharedCameraStatus) {
      sharedCameraStatus.textContent = "Starting camera…";
    }
    if (typeof cameraDialog.showModal === "function") {
      cameraDialog.showModal();
    }
    void (async () => {
      if (!canUseGetUserMedia()) {
        if (sharedCameraStatus) {
          sharedCameraStatus.textContent =
            "In-page camera unavailable on this browser.";
        }
        return;
      }
      try {
        stopSharedCamera();
        sharedStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
        });
        sharedVideo.srcObject = sharedStream;
        sharedVideo.classList.remove("hidden");
        await sharedVideo.play().catch(() => {});
        if (sharedCameraStatus) {
          sharedCameraStatus.textContent = "Take a photo of the standard.";
        }
      } catch (error) {
        console.warn("Shared camera failed", error);
        if (sharedCameraStatus) {
          sharedCameraStatus.textContent =
            "Could not open camera. Use the file picker instead.";
        }
      }
    })();
  });
}

function closeSharedCamera(file) {
  stopSharedCamera();
  sharedPreview?.classList.add("hidden");
  sharedVideo?.classList.remove("hidden");
  sharedCameraStage?.classList.remove("is-live");
  const resolve = sharedCameraResolve;
  sharedCameraResolve = null;
  if (cameraDialog?.open) cameraDialog.close();
  resolve?.(file ?? null);
}

function resolveRecurrence(kind, interval, unit) {
  if (kind === "once") return {};
  if (kind === "daily") {
    return { recurrenceInterval: 1, recurrenceUnit: "day", cooldownDays: 1 };
  }
  const resolvedUnit = unit || DEFAULT_PERIODIC_UNIT;
  const fallbackInterval =
    resolvedUnit === "day"
      ? DEFAULT_DAYS_AFTER_INTERVAL
      : DEFAULT_PERIODIC_INTERVAL;
  const resolvedInterval =
    interval !== undefined && Number(interval) > 0
      ? Math.floor(Number(interval))
      : fallbackInterval;
  return {
    recurrenceInterval: resolvedInterval,
    recurrenceUnit: resolvedUnit,
    cooldownDays: resolvedInterval * (resolvedUnit === "week" ? 7 : 1),
  };
}

/**
 * UI kind → stored template kind + recurrence.
 * `days_after` is the explicit “every N days after done” path (periodic + day).
 * `periodic` in the UI means weekly cadence (default every 4 weeks).
 */
function resolveKindSelection(uiKind, interval, unit) {
  if (uiKind === "days_after") {
    const recurrence = resolveRecurrence(
      "periodic",
      interval || DEFAULT_DAYS_AFTER_INTERVAL,
      "day",
    );
    return { kind: "periodic", ...recurrence, uiKind: "days_after" };
  }
  if (uiKind === "periodic") {
    const recurrence = resolveRecurrence(
      "periodic",
      interval || DEFAULT_PERIODIC_INTERVAL,
      "week",
    );
    return { kind: "periodic", ...recurrence, uiKind: "periodic" };
  }
  const kind = uiKind || "once";
  return { kind, ...resolveRecurrence(kind, interval, unit), uiKind: kind };
}

/** Map a stored template back to the composer/edit select value. */
function uiKindFromStored(kind, interval, unit) {
  if (kind === "periodic" && (unit || DEFAULT_PERIODIC_UNIT) === "day") {
    return "days_after";
  }
  if (kind === "periodic") return "periodic";
  return kind || "once";
}

function formatRecurrenceLabel(kind, interval, unit) {
  if (kind === "once") return null;
  if (kind === "daily") return "Daily";
  const resolved = resolveRecurrence(kind, interval, unit);
  const n = resolved.recurrenceInterval ?? DEFAULT_PERIODIC_INTERVAL;
  const u = resolved.recurrenceUnit ?? DEFAULT_PERIODIC_UNIT;
  if (u === "week") return n === 1 ? "Every week" : `Every ${n} weeks`;
  return n === 1 ? "Every day after done" : `Every ${n} days after done`;
}

/** Drop null/undefined keys so PostgREST won’t reject unknown optional columns. */
function omitNullish(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) out[key] = value;
  }
  return out;
}

function isMissingColumnError(error, column) {
  const message = String(error?.message || error || "");
  return (
    /PGRST204/i.test(message) ||
    (column
      ? new RegExp(`Could not find the '${column}' column`, "i").test(message)
      : /Could not find the '[^']+' column/i.test(message))
  );
}

/**
 * PATCH/POST helper: if PostgREST rejects an optional column (e.g. complete_by
 * not yet migrated), retry once without that key.
 */
async function supabaseWriteOmittingUnknownColumns(
  path,
  options,
  optionalColumns = ["complete_by"],
) {
  try {
    return await supabaseRequest(path, options);
  } catch (error) {
    const bodyRaw = options.body;
    if (typeof bodyRaw !== "string") throw error;
    let parsed;
    try {
      parsed = JSON.parse(bodyRaw);
    } catch {
      throw error;
    }
    const drop = optionalColumns.filter(
      (col) =>
        Object.prototype.hasOwnProperty.call(parsed, col) &&
        isMissingColumnError(error, col),
    );
    if (drop.length === 0) throw error;
    const next = { ...parsed };
    for (const col of drop) delete next[col];
    if (Object.keys(next).length === Object.keys(parsed).length) throw error;
    console.warn(
      `Supabase missing column(s) ${drop.join(", ")}; retrying without them. Run schema.sql alter for complete_by.`,
      error,
    );
    return supabaseRequest(path, {
      ...options,
      body: JSON.stringify(next),
    });
  }
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

function awardTimeIso(event) {
  return (
    event.assessedAt ??
    event.assessed_at ??
    event.completedAt ??
    event.completed_at
  );
}

/**
 * Current scoreboard = approved awards since last weekly reset (additive model).
 * Completions are never deleted; history rows hold closed-week totals.
 */
function computeScoreboard(peopleList, completionList, sinceIso = null) {
  const sinceMs =
    sinceIso && !Number.isNaN(Date.parse(sinceIso))
      ? Date.parse(sinceIso)
      : null;
  const totals = new Map();
  for (const event of completionList) {
    const status = event.assessmentStatus ?? event.assessment_status;
    const personId = event.personId ?? event.person_id;
    if (status !== "approved" || !personId) continue;
    if (sinceMs != null) {
      const awarded = awardTimeIso(event);
      const awardedMs = awarded ? Date.parse(awarded) : NaN;
      if (Number.isNaN(awardedMs) || awardedMs < sinceMs) continue;
    }
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

function zonedParts(timeZone, date) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const raw = Object.fromEntries(
    dtf
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  let hour = Number(raw.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(raw.year),
    month: Number(raw.month),
    day: Number(raw.day),
    hour,
    minute: Number(raw.minute),
    second: Number(raw.second),
    weekday: raw.weekday,
  };
}

function zonedLocalToUtcMs(timeZone, year, month, day, hour = 0, minute = 0, second = 0) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const asLocal = zonedParts(timeZone, new Date(utcGuess));
  const asLocalUtc = Date.UTC(
    asLocal.year,
    asLocal.month - 1,
    asLocal.day,
    asLocal.hour,
    asLocal.minute,
    asLocal.second,
  );
  const wanted = Date.UTC(year, month - 1, day, hour, minute, second);
  return utcGuess + (wanted - asLocalUtc);
}

/** Most recent Monday 00:00 household TZ (<= now) — closes Sunday night. */
function currentWeekStartIso(timeZone = householdTimezone, now = new Date()) {
  const parts = zonedParts(timeZone, now);
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = weekdayMap[parts.weekday] ?? 1;
  const daysSinceMonday = (dow + 6) % 7;
  const mondayUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  const mondayDate = new Date(mondayUtc - daysSinceMonday * 86400000);
  const y = mondayDate.getUTCFullYear();
  const m = mondayDate.getUTCMonth() + 1;
  const d = mondayDate.getUTCDate();
  return new Date(zonedLocalToUtcMs(timeZone, y, m, d, 0, 0, 0)).toISOString();
}

function periodLabelForWeekEnding(weekEndingIso, timeZone = householdTimezone) {
  const endMs = Date.parse(weekEndingIso);
  if (Number.isNaN(endMs)) return "Past week";
  const sunday = new Date(endMs - 86400000);
  const parts = zonedParts(timeZone, sunday);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `Week ending ${parts.day} ${months[parts.month - 1]} ${parts.year}`;
}

function mapHistoryRows(rows) {
  return (rows ?? []).map((row) => ({
    id: row.id,
    weekEnding: row.weekEnding ?? row.week_ending,
    periodLabel: row.periodLabel ?? row.period_label ?? undefined,
    personId: row.personId ?? row.person_id,
    displayName: row.displayName ?? row.display_name,
    points: Number(row.points ?? 0),
    createdAt: row.createdAt ?? row.created_at,
  }));
}

function groupHistoryByWeek(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.weekEnding}::${row.periodLabel ?? ""}`;
    if (!groups.has(key)) {
      groups.set(key, {
        weekEnding: row.weekEnding,
        periodLabel: row.periodLabel || periodLabelForWeekEnding(row.weekEnding),
        rows: [],
      });
    }
    groups.get(key).rows.push(row);
  }
  return [...groups.values()]
    .map((g) => ({
      ...g,
      rows: g.rows.sort(
        (a, b) =>
          b.points - a.points || a.displayName.localeCompare(b.displayName),
      ),
    }))
    .sort((a, b) => Date.parse(b.weekEnding) - Date.parse(a.weekEnding));
}

function paintRecurrenceFields(uiKind, {
  intervalInput,
  unitInput,
  fieldsEl,
  labelEl,
  unitTextEl,
  hintEl,
  applyDefaultInterval = false,
} = {}) {
  const show = uiKind === "periodic" || uiKind === "days_after";
  fieldsEl?.classList.toggle("hidden", !show);
  if (!show) return;
  if (uiKind === "days_after") {
    if (unitInput) unitInput.value = "day";
    if (applyDefaultInterval && intervalInput) {
      intervalInput.value = String(DEFAULT_DAYS_AFTER_INTERVAL);
    }
    if (labelEl) labelEl.textContent = "Every";
    if (unitTextEl) unitTextEl.textContent = "days after done";
    if (hintEl) {
      hintEl.textContent =
        "Comes back N days after the last completion (cooldown).";
    }
  } else {
    if (unitInput) unitInput.value = "week";
    if (applyDefaultInterval && intervalInput) {
      intervalInput.value = String(DEFAULT_PERIODIC_INTERVAL);
    }
    if (labelEl) labelEl.textContent = "Every";
    if (unitTextEl) unitTextEl.textContent = "weeks";
    if (hintEl) {
      hintEl.textContent = "Default for weekly repeats is every 4 weeks.";
    }
  }
}

function syncComposerAdminUi({ applyDefaultInterval = false } = {}) {
  pointsFields.classList.remove("hidden");
  adminHint.classList.toggle("hidden", !ADMIN_UI_MODE && !isAdmin());
  paintRecurrenceFields(kindInput.value, {
    intervalInput: recurrenceIntervalInput,
    unitInput: recurrenceUnitInput,
    fieldsEl: recurrenceFields,
    labelEl: recurrenceIntervalLabel,
    unitTextEl: recurrenceUnitText,
    hintEl: recurrenceHint,
    applyDefaultInterval,
  });
  if (editKindInput) {
    paintRecurrenceFields(editKindInput.value, {
      intervalInput: editRecurrenceIntervalInput,
      unitInput: editRecurrenceUnitInput,
      fieldsEl: editRecurrenceFields,
      labelEl: editRecurrenceIntervalLabel,
      unitTextEl: editRecurrenceUnitText,
      hintEl: editRecurrenceHint,
      applyDefaultInterval,
    });
  }
  syncCompleteByFields();
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
      data?.message ||
      data?.error_description ||
      data?.hint ||
      data?.error ||
      `Supabase ${response.status}`;
    const err = new Error(message);
    err.code = data?.code;
    err.status = response.status;
    throw err;
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

function latestCompletionForInstance(instanceId, list = completions) {
  const matches = (list ?? []).filter(
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

function instanceToView(row, template, completionList = completions) {
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
  const completion = latestCompletionForInstance(row.id, completionList);
  const assessmentStatus =
    completion?.assessmentStatus ?? completion?.assessment_status ?? null;
  const description =
    row.description || template?.description || undefined;
  return {
    id: row.id,
    title: row.title,
    ...(description ? { description } : {}),
    ...(row.assignee ? { assignee: row.assignee } : {}),
    status: openLike ? "open" : status === "waiting" ? "waiting" : "done",
    instanceStatus: status,
    ...(row.due_date ? { dueDate: row.due_date } : {}),
    ...(row.due_at ? { dueAt: row.due_at } : {}),
    ...(row.complete_by ? { completeBy: row.complete_by } : {}),
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

/** Stable snapshot of list/scoreboard state for poll short-circuit + stale drops. */
function boardFingerprint(snapshot = null) {
  const c = snapshot?.chores ?? chores;
  const p = snapshot?.people ?? people;
  const scores = snapshot?.scoreRows ?? scoreRows;
  const history = snapshot?.pointsHistory ?? pointsHistory;
  const resetAt = snapshot?.lastPointsResetAt ?? lastPointsResetAt;
  return JSON.stringify({
    filter,
    backend,
    resetAt: resetAt ?? null,
    people: (p ?? []).map((row) => [row.id, row.displayName, row.role]),
    scores: (scores ?? []).map((row) => [row.personId, row.points]),
    history: (history ?? []).map((row) => [
      row.id,
      row.personId,
      row.points,
      row.weekEnding,
    ]),
    chores: (c ?? []).map((row) => [
      row.id,
      row.title,
      row.description ?? null,
      row.status,
      row.instanceStatus ?? null,
      row.assignee ?? null,
      row.assigneePersonId ?? null,
      row.points ?? null,
      row.kind ?? null,
      row.recurrenceInterval ?? null,
      row.recurrenceUnit ?? null,
      row.dueDate ?? null,
      row.dueAt ?? null,
      row.completeBy ?? null,
      row.assessmentStatus ?? null,
      row.completionId ?? null,
      row.templateId ?? null,
      row.referencePhotoPath ?? null,
      JSON.stringify(row.steps ?? []),
    ]),
  });
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

async function releaseExpiredClaimsRich(instanceRows) {
  const nowIso = new Date().toISOString();
  const now = Date.now();
  const due = (instanceRows ?? []).filter((row) => {
    if (row.status === "done" || row.status === "waiting" || row.status === "retired") {
      return false;
    }
    if (!row.complete_by) return false;
    const ms = Date.parse(row.complete_by);
    if (Number.isNaN(ms) || ms > now) return false;
    return row.status === "assigned" || Boolean(row.assignee || row.assignee_person_id);
  });
  await Promise.all(
    due.map((row) =>
      supabaseWriteOmittingUnknownColumns(
        `task_instances?id=eq.${encodeURIComponent(row.id)}&status=neq.done`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            status: "open",
            assignee_person_id: null,
            assignee: null,
            assigned_at: null,
            complete_by: null,
            opened_at: nowIso,
          }),
        },
        ["complete_by"],
      ).catch(() => null),
    ),
  );
  await Promise.all(
    due.map((row) =>
      supabaseRequest(`chores?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ assignee: null }),
      }).catch(() => null),
    ),
  );
  return due.length > 0;
}

async function fetchHouseholdMetaRich() {
  try {
    const rows = await supabaseRequest(
      `household_meta?id=eq.${encodeURIComponent(HOUSEHOLD_META_ID)}&select=*`,
    );
    const row = rows?.[0];
    if (!row) {
      return {
        id: HOUSEHOLD_META_ID,
        timezone: DEFAULT_HOUSEHOLD_TIMEZONE,
        last_points_reset_at: null,
      };
    }
    return row;
  } catch {
    // Schema not applied yet — skip weekly reset until James pastes SQL.
    return null;
  }
}

async function fetchPointsHistoryRich() {
  try {
    const rows = await supabaseRequest(
      "points_history?select=*&order=week_ending.desc",
    );
    return mapHistoryRows(rows);
  } catch {
    return [];
  }
}

async function upsertPointsHistoryRich(historyRows) {
  if (!historyRows.length) return;
  const payload = historyRows.map((row) => ({
    id: row.id || newId("ph"),
    week_ending: row.weekEnding,
    period_label: row.periodLabel ?? null,
    person_id: row.personId,
    display_name: row.displayName,
    points: Math.max(0, Math.floor(Number(row.points) || 0)),
    created_at: row.createdAt || new Date().toISOString(),
  }));
  await supabaseRequest(
    "points_history?on_conflict=week_ending,person_id",
    {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(payload),
    },
  );
}

async function writeHouseholdMetaReset(nextLastResetAt, timezone) {
  const nowIso = new Date().toISOString();
  await supabaseRequest(
    `household_meta?id=eq.${encodeURIComponent(HOUSEHOLD_META_ID)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        last_points_reset_at: nextLastResetAt,
        timezone: timezone || DEFAULT_HOUSEHOLD_TIMEZONE,
        updated_at: nowIso,
      }),
    },
  ).catch(async () => {
    await supabaseRequest("household_meta", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        id: HOUSEHOLD_META_ID,
        timezone: timezone || DEFAULT_HOUSEHOLD_TIMEZONE,
        last_points_reset_at: nextLastResetAt,
        updated_at: nowIso,
      }),
    });
  });
}

/**
 * Idempotent Sunday-night rollover (client-side for Pages).
 * Snapshots current period totals into points_history, then advances
 * last_points_reset_at so the live board = awards since that cursor.
 */
async function maybeWeeklyPointsResetRich(peopleList, completionList, metaRow) {
  if (!metaRow) return { lastResetAt: null, history: pointsHistory };
  householdTimezone =
    (metaRow.timezone && String(metaRow.timezone).trim()) ||
    DEFAULT_HOUSEHOLD_TIMEZONE;
  const weekStartIso = currentWeekStartIso(householdTimezone);
  const lastReset = metaRow.last_points_reset_at ?? null;
  const periodLabel = periodLabelForWeekEnding(weekStartIso, householdTimezone);

  if (!lastReset) {
    const thisWeek = new Map(
      computeScoreboard(peopleList, completionList, weekStartIso).map((r) => [
        r.personId,
        r.points,
      ]),
    );
    const historyRows = computeScoreboard(peopleList, completionList, null)
      .map((row) => ({
        id: newId("ph"),
        weekEnding: weekStartIso,
        periodLabel: "Prior to weekly resets",
        personId: row.personId,
        displayName: row.displayName,
        points: Math.max(0, row.points - (thisWeek.get(row.personId) ?? 0)),
        createdAt: new Date().toISOString(),
      }))
      .filter((row) => row.points > 0);
    try {
      await upsertPointsHistoryRich(historyRows);
      await writeHouseholdMetaReset(weekStartIso, householdTimezone);
    } catch (error) {
      console.warn("Weekly points seed skipped", error);
      return { lastResetAt: null, history: await fetchPointsHistoryRich() };
    }
    return {
      lastResetAt: weekStartIso,
      history: await fetchPointsHistoryRich(),
    };
  }

  const lastMs = Date.parse(lastReset);
  const weekMs = Date.parse(weekStartIso);
  if (Number.isNaN(lastMs) || Number.isNaN(weekMs) || lastMs >= weekMs) {
    return {
      lastResetAt: lastReset,
      history: await fetchPointsHistoryRich(),
    };
  }

  const sinceWeek = new Map(
    computeScoreboard(peopleList, completionList, weekStartIso).map((r) => [
      r.personId,
      r.points,
    ]),
  );
  const historyRows = computeScoreboard(
    peopleList,
    completionList,
    lastReset,
  )
    .map((row) => ({
      id: newId("ph"),
      weekEnding: weekStartIso,
      periodLabel,
      personId: row.personId,
      displayName: row.displayName,
      points: Math.max(0, row.points - (sinceWeek.get(row.personId) ?? 0)),
      createdAt: new Date().toISOString(),
    }))
    .filter((row) => row.points > 0);

  try {
    await upsertPointsHistoryRich(historyRows);
    await writeHouseholdMetaReset(weekStartIso, householdTimezone);
  } catch (error) {
    console.warn("Weekly points reset skipped", error);
    return {
      lastResetAt: lastReset,
      history: await fetchPointsHistoryRich(),
    };
  }
  return {
    lastResetAt: weekStartIso,
    history: await fetchPointsHistoryRich(),
  };
}

/**
 * Fetch rich board without mutating globals — caller applies only if loadEpoch
 * still matches (drops in-flight poll results that would overwrite a newer save).
 */
async function fetchRichBoard(status) {
  const [instanceRows, templateRows, peopleRows, completionRows, metaRow] =
    await Promise.all([
      supabaseRequest("task_instances?select=*&order=created_at.desc"),
      supabaseRequest("task_templates?select=*&order=created_at.desc"),
      supabaseRequest("people?select=*&order=display_name.asc"),
      supabaseRequest("completion_events?select=*&order=completed_at.desc"),
      fetchHouseholdMetaRich(),
    ]);
  const nextPeople = (peopleRows ?? []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    role: row.role,
  }));
  const nextTemplates = new Map(
    (templateRows ?? []).map((row) => [row.id, row]),
  );
  const nextCompletions = completionRows ?? [];

  const reset = await maybeWeeklyPointsResetRich(
    nextPeople,
    nextCompletions,
    metaRow,
  );
  const nextScoreRows = computeScoreboard(
    nextPeople,
    nextCompletions,
    reset.lastResetAt,
  );

  let rows = instanceRows;
  const promoted = await promoteDueWaitingRich(instanceRows);
  const released = await releaseExpiredClaimsRich(instanceRows);
  if (promoted || released) {
    rows = await supabaseRequest(
      "task_instances?select=*&order=created_at.desc",
    );
  }

  return {
    people: nextPeople,
    templatesById: nextTemplates,
    completions: nextCompletions,
    scoreRows: nextScoreRows,
    pointsHistory: reset.history,
    lastPointsResetAt: reset.lastResetAt,
    chores: finalizeRichViews(
      rows,
      status,
      nextTemplates,
      nextCompletions,
    ),
  };
}

async function listRichSupabase(status) {
  const board = await fetchRichBoard(status);
  people = board.people;
  templatesById = board.templatesById;
  completions = board.completions;
  scoreRows = board.scoreRows;
  pointsHistory = board.pointsHistory;
  lastPointsResetAt = board.lastPointsResetAt;
  return board.chores;
}

function finalizeRichViews(
  instanceRows,
  status,
  templateMap = templatesById,
  completionList = completions,
) {
  const views = (instanceRows ?? []).map((row) =>
    instanceToView(
      row,
      row.template_id ? templateMap.get(row.template_id) : null,
      completionList,
    ),
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
    input.points !== undefined
      ? Math.max(0, Math.floor(Number(input.points)))
      : DEFAULT_TASK_POINTS;
  const description = input.description?.trim() || null;
  const templateId = newId("tmpl");
  const instanceId = newId("inst");
  const templateBody = omitNullish({
    id: templateId,
    title: input.title.trim(),
    description,
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
  });
  await supabaseRequest("task_templates", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(templateBody),
  });
  // Never send complete_by: null — live DBs that have not applied the
  // additive alter reject unknown columns (PGRST204) and Add appears broken.
  const instanceBody = omitNullish({
    id: instanceId,
    template_id: templateId,
    title: input.title.trim(),
    description,
    estimated_minutes: 10,
    status: person ? "assigned" : "open",
    assignee_person_id: person?.id ?? null,
    assignee: person?.displayName ?? null,
    opened_at: now,
    assigned_at: person ? now : null,
    due_date: input.dueDate || null,
    complete_by: person && input.completeBy ? input.completeBy : undefined,
    source: "manual",
    created_at: now,
  });
  let rows;
  try {
    rows = await supabaseWriteOmittingUnknownColumns(
      "task_instances",
      {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(instanceBody),
      },
      ["complete_by"],
    );
  } catch (error) {
    await supabaseRequest(
      `task_templates?id=eq.${encodeURIComponent(templateId)}`,
      { method: "DELETE", headers: { Prefer: "return=minimal" } },
    ).catch(() => null);
    throw error;
  }
  if (!rows?.length) {
    throw new Error("Task was not created — empty response from Supabase.");
  }
  try {
    await supabaseRequest("chores", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(
        omitNullish({
          id: instanceId,
          title: input.title.trim(),
          description,
          assignee: person?.displayName ?? null,
          status: "open",
          due_date: input.dueDate || null,
          created_at: now,
          completed_at: null,
        }),
      ),
    });
  } catch {
    /* legacy mirror optional */
  }
  templatesById.set(templateId, {
    id: templateId,
    title: input.title.trim(),
    description,
    kind,
    steps: input.steps ?? [],
    reference_photo_path: referencePath,
    recurrence_interval: recurrence.recurrenceInterval,
    recurrence_unit: recurrence.recurrenceUnit,
    points,
  });
  return instanceToView(rows[0], templatesById.get(templateId));
}

async function updateRichTask(chore, input) {
  if (chore.mode !== "instance") {
    throw new Error("Edit needs the rich task model.");
  }
  const now = new Date().toISOString();
  const kind = input.kind || "once";
  const recurrence = resolveRecurrence(
    kind,
    input.recurrenceInterval,
    input.recurrenceUnit,
  );
  const points = Math.max(
    0,
    Math.floor(Number(input.points ?? DEFAULT_TASK_POINTS)),
  );
  const title = input.title.trim();
  const description = input.description?.trim() || null;
  const steps = input.steps ?? [];
  let person = null;
  if (input.assignee?.trim()) {
    person = await findOrCreatePerson(input.assignee.trim());
  }
  let referencePath =
    chore.referencePhotoPath ||
    templatesById.get(chore.templateId)?.reference_photo_path ||
    null;
  if (input.referenceFile) {
    referencePath = await uploadPhoto(input.referenceFile, "reference");
  }

  if (chore.templateId) {
    await supabaseRequest(
      `task_templates?id=eq.${encodeURIComponent(chore.templateId)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          title,
          description,
          kind,
          cooldown_days: recurrence.cooldownDays ?? null,
          recurrence_interval: recurrence.recurrenceInterval ?? null,
          recurrence_unit: recurrence.recurrenceUnit ?? null,
          points,
          steps,
          reference_photo_path: referencePath,
          default_assignee_person_id: person?.id ?? null,
        }),
      },
    );
    const prev = templatesById.get(chore.templateId) || { id: chore.templateId };
    templatesById.set(chore.templateId, {
      ...prev,
      title,
      description,
      kind,
      recurrence_interval: recurrence.recurrenceInterval,
      recurrence_unit: recurrence.recurrenceUnit,
      cooldown_days: recurrence.cooldownDays,
      points,
      steps,
      reference_photo_path: referencePath,
    });
  }

  const openLike =
    chore.instanceStatus === "noticed" ||
    chore.instanceStatus === "open" ||
    chore.instanceStatus === "assigned" ||
    chore.status === "open";
  const instancePatch = {
    title,
    description,
    due_date: input.dueDate || null,
  };
  if (openLike) {
    if (person) {
      instancePatch.status = "assigned";
      instancePatch.assignee_person_id = person.id;
      instancePatch.assignee = person.displayName;
      instancePatch.assigned_at = now;
      // Only send complete_by when set — avoids PGRST204 on unmigrated DBs.
      if (input.completeBy) instancePatch.complete_by = input.completeBy;
    } else {
      instancePatch.status =
        chore.instanceStatus === "noticed" ? "noticed" : "open";
      instancePatch.assignee_person_id = null;
      instancePatch.assignee = null;
      instancePatch.assigned_at = null;
      if (chore.completeBy || chore.complete_by) {
        instancePatch.complete_by = null;
      }
    }
  }

  const rows = await supabaseWriteOmittingUnknownColumns(
    `task_instances?id=eq.${encodeURIComponent(chore.id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(instancePatch),
    },
    ["complete_by"],
  );
  if (!rows?.length) throw new Error(`No task with id ${chore.id}`);

  try {
    await supabaseRequest(`chores?id=eq.${encodeURIComponent(chore.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        title,
        description,
        assignee: person?.displayName ?? null,
        due_date: input.dueDate || null,
      }),
    });
  } catch {
    /* optional mirror */
  }

  return instanceToView(
    rows[0],
    chore.templateId ? templatesById.get(chore.templateId) : null,
  );
}

async function updatePersonRole(personId, role) {
  if (!["parent", "child", "other"].includes(role)) {
    throw new Error("Role must be parent, child, or other.");
  }
  if (backend === "supabase-rich") {
    await supabaseRequest(`people?id=eq.${encodeURIComponent(personId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ role }),
    });
    people = people
      .map((p) => (p.id === personId ? { ...p, role } : p))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    scoreRows = computeScoreboard(people, completions, lastPointsResetAt);
    return;
  }
  if (backend === "local") {
    const store = loadLocalV2();
    const index = store.people.findIndex((p) => p.id === personId);
    if (index < 0) throw new Error("Person not found");
    store.people[index] = { ...store.people[index], role };
    saveLocalV2(store);
    people = store.people.map((p) => ({
      id: p.id,
      displayName: p.displayName ?? p.display_name,
      role: p.role ?? "child",
    }));
    const since =
      store.householdMeta?.lastPointsResetAt ?? lastPointsResetAt;
    scoreRows = computeScoreboard(people, store.completions, since);
    return;
  }
  throw new Error("Managing people needs rich Supabase or local mode.");
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
  const rows = await supabaseWriteOmittingUnknownColumns(
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
    ["complete_by"],
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

async function completeRich(chore, options = {}) {
  const proofFile = options.proofFile ?? null;
  const personId =
    options.personId || meSelect.value || chore.assigneePersonId || null;
  const actualMinutes = options.actualMinutes;
  const feltDifficulty = options.feltDifficulty;
  const now = new Date().toISOString();
  let proofPath = null;
  if (proofFile) {
    proofPath = await uploadPhoto(proofFile, "proof");
  }
  const person = personId
    ? people.find((p) => p.id === personId) || null
    : null;
  const completionId = newId("comp");
  await supabaseRequest(
    `task_instances?id=eq.${encodeURIComponent(chore.id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "done",
        completed_at: now,
        ...(person
          ? {
              assignee_person_id: person.id,
              assignee: person.displayName,
              assigned_at: chore.assigneePersonId ? undefined : now,
            }
          : {}),
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
      person_id: personId,
      completed_at: now,
      actual_minutes: actualMinutes ?? null,
      felt_difficulty: feltDifficulty ?? null,
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
    throw new Error("Admin mode required to assess completions.");
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
        assessed_by_person_id: assessor?.id ?? null,
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
        pointsHistory: Array.isArray(parsed.pointsHistory)
          ? mapHistoryRows(parsed.pointsHistory)
          : [],
        householdMeta: parsed.householdMeta ?? {
          id: HOUSEHOLD_META_ID,
          timezone: DEFAULT_HOUSEHOLD_TIMEZONE,
          lastPointsResetAt: parsed.lastPointsResetAt ?? null,
          updatedAt: new Date(0).toISOString(),
        },
      };
    }
  } catch {
    /* fall through */
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V1);
    if (!raw) {
      return {
        people: [],
        templates: [],
        instances: [],
        completions: [],
        pointsHistory: [],
        householdMeta: {
          id: HOUSEHOLD_META_ID,
          timezone: DEFAULT_HOUSEHOLD_TIMEZONE,
          lastPointsResetAt: null,
          updatedAt: new Date(0).toISOString(),
        },
      };
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
    return {
      people: [],
      templates: [],
      instances,
      completions: [],
      pointsHistory: [],
      householdMeta: {
        id: HOUSEHOLD_META_ID,
        timezone: DEFAULT_HOUSEHOLD_TIMEZONE,
        lastPointsResetAt: null,
        updatedAt: new Date(0).toISOString(),
      },
    };
  } catch {
    return {
      people: [],
      templates: [],
      instances: [],
      completions: [],
      pointsHistory: [],
      householdMeta: {
        id: HOUSEHOLD_META_ID,
        timezone: DEFAULT_HOUSEHOLD_TIMEZONE,
        lastPointsResetAt: null,
        updatedAt: new Date(0).toISOString(),
      },
    };
  }
}

function saveLocalV2(store) {
  localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(store));
}

function clearLocalHold(row) {
  const next = { ...row, status: "open" };
  delete next.assigneePersonId;
  delete next.assignee_person_id;
  delete next.assignee;
  delete next.assignedAt;
  delete next.assigned_at;
  delete next.completeBy;
  delete next.complete_by;
  return next;
}

function releaseLocalClaims(store) {
  const now = Date.now();
  let changed = false;
  const instances = store.instances.map((row) => {
    const status = row.status;
    const until = row.completeBy ?? row.complete_by;
    if (!until) return row;
    if (status === "done" || status === "waiting" || status === "retired") {
      return row;
    }
    const ms = Date.parse(until);
    if (Number.isNaN(ms) || ms > now) return row;
    if (status !== "assigned" && !row.assignee && !row.assigneePersonId && !row.assignee_person_id) {
      return row;
    }
    changed = true;
    return clearLocalHold(row);
  });
  if (!changed) return store;
  const nextStore = { ...store, instances };
  saveLocalV2(nextStore);
  return nextStore;
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
    const next = clearLocalHold(row);
    next.openedAt = new Date().toISOString();
    return next;
  });
  if (!changed) return store;
  const nextStore = { ...store, instances };
  saveLocalV2(nextStore);
  return nextStore;
}

function applyLocalWeeklyPointsReset(store) {
  const meta = store.householdMeta ?? {
    id: HOUSEHOLD_META_ID,
    timezone: DEFAULT_HOUSEHOLD_TIMEZONE,
    lastPointsResetAt: null,
    updatedAt: new Date(0).toISOString(),
  };
  householdTimezone =
    (meta.timezone && String(meta.timezone).trim()) ||
    DEFAULT_HOUSEHOLD_TIMEZONE;
  const weekStartIso = currentWeekStartIso(householdTimezone);
  const lastReset = meta.lastPointsResetAt ?? null;
  const nowIso = new Date().toISOString();
  const peopleList = (store.people ?? []).map((p) => ({
    id: p.id,
    displayName: p.displayName ?? p.display_name,
    role: p.role ?? "child",
  }));
  const history = [...(store.pointsHistory ?? [])];

  const pushHistory = (rows) => {
    for (const row of rows) {
      if (
        history.some(
          (h) => h.weekEnding === row.weekEnding && h.personId === row.personId,
        )
      ) {
        continue;
      }
      history.push(row);
    }
  };

  if (!lastReset) {
    const thisWeek = new Map(
      computeScoreboard(peopleList, store.completions, weekStartIso).map(
        (r) => [r.personId, r.points],
      ),
    );
    pushHistory(
      computeScoreboard(peopleList, store.completions, null)
        .map((row) => ({
          id: newId("ph"),
          weekEnding: weekStartIso,
          periodLabel: "Prior to weekly resets",
          personId: row.personId,
          displayName: row.displayName,
          points: Math.max(0, row.points - (thisWeek.get(row.personId) ?? 0)),
          createdAt: nowIso,
        }))
        .filter((row) => row.points > 0),
    );
    const next = {
      ...store,
      pointsHistory: history,
      householdMeta: {
        ...meta,
        timezone: householdTimezone,
        lastPointsResetAt: weekStartIso,
        updatedAt: nowIso,
      },
    };
    saveLocalV2(next);
    return next;
  }

  const lastMs = Date.parse(lastReset);
  const weekMs = Date.parse(weekStartIso);
  if (Number.isNaN(lastMs) || Number.isNaN(weekMs) || lastMs >= weekMs) {
    return store;
  }

  const sinceWeek = new Map(
    computeScoreboard(peopleList, store.completions, weekStartIso).map((r) => [
      r.personId,
      r.points,
    ]),
  );
  const periodLabel = periodLabelForWeekEnding(weekStartIso, householdTimezone);
  pushHistory(
    computeScoreboard(peopleList, store.completions, lastReset)
      .map((row) => ({
        id: newId("ph"),
        weekEnding: weekStartIso,
        periodLabel,
        personId: row.personId,
        displayName: row.displayName,
        points: Math.max(0, row.points - (sinceWeek.get(row.personId) ?? 0)),
        createdAt: nowIso,
      }))
      .filter((row) => row.points > 0),
  );
  const next = {
    ...store,
    pointsHistory: history,
    householdMeta: {
      ...meta,
      timezone: householdTimezone,
      lastPointsResetAt: weekStartIso,
      updatedAt: nowIso,
    },
  };
  saveLocalV2(next);
  return next;
}

function listLocal(status) {
  let store = applyLocalWeeklyPointsReset(
    releaseLocalClaims(promoteLocalWaiting(loadLocalV2())),
  );
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
  pointsHistory = mapHistoryRows(store.pointsHistory ?? []);
  lastPointsResetAt = store.householdMeta?.lastPointsResetAt ?? null;
  householdTimezone =
    store.householdMeta?.timezone?.trim() || DEFAULT_HOUSEHOLD_TIMEZONE;
  scoreRows = computeScoreboard(people, completions, lastPointsResetAt);
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
      complete_by: row.completeBy ?? row.complete_by,
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

function roleLabel(role) {
  if (role === "parent") return "Parent (admin)";
  if (role === "other") return "Other";
  return "Child";
}

function renderScoreboard() {
  listEl.innerHTML = "";
  listEl.classList.add("hidden");
  peoplePanelEl.classList.add("hidden");
  peoplePanelEl.innerHTML = "";
  scoreboardEl.classList.remove("hidden");
  emptyEl.classList.add("hidden");
  scoreboardEl.innerHTML = "";
  fillMeSelect();
  const weekHint = lastPointsResetAt
    ? " This week’s points (resets Sunday night)."
    : "";
  summaryEl.textContent =
    scoreRows.length === 0
      ? "Add household people to start the scoreboard."
      : `Approved points this week.${weekHint}`;

  if (scoreRows.length === 0) {
    emptyEl.textContent = "No people yet. Add someone under People.";
    emptyEl.classList.remove("hidden");
    return;
  }

  const currentHeading = document.createElement("p");
  currentHeading.className = "score-section-label";
  currentHeading.textContent = "This week";
  scoreboardEl.append(currentHeading);

  for (const row of scoreRows) {
    const item = document.createElement("div");
    item.className = "score-row";
    const left = document.createElement("div");
    const name = document.createElement("p");
    name.className = "score-name";
    name.textContent = row.displayName;
    const role = document.createElement("p");
    role.className = "score-role";
    role.textContent = roleLabel(row.role);
    left.append(name, role);
    const pts = document.createElement("div");
    pts.className = "score-points";
    pts.textContent = String(row.points);
    pts.setAttribute("aria-label", `${row.points} points`);
    item.append(left, pts);
    scoreboardEl.append(item);
  }

  const groups = groupHistoryByWeek(pointsHistory);
  if (groups.length === 0) return;

  const historyHeading = document.createElement("p");
  historyHeading.className = "score-section-label score-history-heading";
  historyHeading.textContent = "Past weeks";
  scoreboardEl.append(historyHeading);

  for (const group of groups) {
    const block = document.createElement("div");
    block.className = "score-history-week";
    const label = document.createElement("p");
    label.className = "score-history-label";
    label.textContent = group.periodLabel;
    block.append(label);
    for (const row of group.rows) {
      const item = document.createElement("div");
      item.className = "score-row score-row-history";
      const name = document.createElement("p");
      name.className = "score-name";
      name.textContent = row.displayName;
      const pts = document.createElement("div");
      pts.className = "score-points";
      pts.textContent = String(row.points);
      pts.setAttribute(
        "aria-label",
        `${row.displayName} ${row.points} points`,
      );
      item.append(name, pts);
      block.append(item);
    }
    scoreboardEl.append(block);
  }
}

function renderPeoplePanel() {
  listEl.innerHTML = "";
  listEl.classList.add("hidden");
  scoreboardEl.classList.add("hidden");
  scoreboardEl.innerHTML = "";
  peoplePanelEl.classList.remove("hidden");
  peoplePanelEl.innerHTML = "";
  emptyEl.classList.add("hidden");
  fillMeSelect();
  summaryEl.textContent =
    people.length === 0
      ? "Add household members to assign and score work."
      : `${people.length} household ${people.length === 1 ? "person" : "people"}.`;

  const addBlock = document.createElement("div");
  addBlock.className = "people-manage";
  const addTitle = document.createElement("p");
  addTitle.className = "field-label";
  addTitle.textContent = "Add person";
  const row = document.createElement("div");
  row.className = "people-add-row";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.maxLength = 40;
  nameInput.placeholder = "Name";
  nameInput.setAttribute("aria-label", "Person name");
  nameInput.id = "personName";
  const roleSelect = document.createElement("select");
  roleSelect.setAttribute("aria-label", "Person role");
  roleSelect.id = "personRole";
  for (const [value, label] of [
    ["child", "Child"],
    ["parent", "Parent (admin)"],
    ["other", "Other"],
  ]) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    roleSelect.append(opt);
  }
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "primary";
  addBtn.textContent = "Add";
  addBtn.addEventListener("click", () => {
    void addHouseholdPerson(nameInput, roleSelect);
  });
  row.append(nameInput, roleSelect, addBtn);
  const hint = document.createElement("p");
  hint.className = "field-hint";
  hint.textContent =
    "Parents are marked for future Auth. This UI is admin mode for now — anyone on the device can manage people.";
  addBlock.append(addTitle, row, hint);
  peoplePanelEl.append(addBlock);

  if (people.length === 0) {
    emptyEl.textContent = "No people yet. Add a parent or child above.";
    emptyEl.classList.remove("hidden");
    return;
  }

  const list = document.createElement("ul");
  list.className = "people-list";
  for (const person of people) {
    const li = document.createElement("li");
    li.className = "people-row";
    const left = document.createElement("div");
    const name = document.createElement("p");
    name.className = "people-name";
    name.textContent = person.displayName;
    left.append(name);
    const role = document.createElement("select");
    role.setAttribute("aria-label", `Role for ${person.displayName}`);
    for (const [value, label] of [
      ["child", "Child"],
      ["parent", "Parent (admin)"],
      ["other", "Other"],
    ]) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      if (person.role === value) opt.selected = true;
      role.append(opt);
    }
    role.addEventListener("change", () => {
      void (async () => {
        try {
          await updatePersonRole(person.id, role.value);
          fillMeSelect();
          setStatus(`Updated ${person.displayName}.`);
          writeSwrCache();
          renderPeoplePanel();
        } catch (error) {
          setStatus(error.message);
          role.value = person.role;
        }
      })();
    });
    li.append(left, role);
    list.append(li);
  }
  peoplePanelEl.append(list);
}

function render() {
  const releasedNow = absorbExpiredClaims();
  scheduleNextReleaseTick();
  if (releasedNow > 0) {
    setStatus("Complete-by passed — open for anyone to mark done.");
    writeSwrCache();
  }
  if (filter === "scores") {
    renderScoreboard();
    return;
  }
  if (filter === "people") {
    renderPeoplePanel();
    return;
  }

  scoreboardEl.classList.add("hidden");
  scoreboardEl.innerHTML = "";
  peoplePanelEl.classList.add("hidden");
  peoplePanelEl.innerHTML = "";
  listEl.classList.remove("hidden");
  listEl.innerHTML = "";
  emptyEl.classList.toggle("hidden", chores.length > 0);
  emptyEl.textContent = "Nothing here yet. Tap New task to add one.";
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

    const titleBtn = document.createElement("button");
    titleBtn.type = "button";
    titleBtn.className = "chore-title-btn";
    titleBtn.setAttribute(
      "aria-label",
      `Open ${chore.title}`,
    );
    const title = document.createElement("span");
    title.className = "chore-title";
    title.textContent = chore.title;
    const chevron = document.createElement("span");
    chevron.className = "chore-title-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "›";
    titleBtn.append(title, chevron);
    titleBtn.addEventListener("click", () => {
      openTaskCard(chore);
    });

    li.append(titleBtn);
    listEl.append(li);
  }
}

function buildTaskMeta(chore) {
  const meta = document.createElement("div");
  meta.className = "chore-meta";
  const done =
    chore.status === "done" || chore.instanceStatus === "done";
  if (chore.assignee) {
    const assignee = document.createElement("span");
    assignee.className = "meta-pill";
    assignee.textContent = chore.assignee;
    meta.append(assignee);
  }
  if (
    chore.assignee &&
    chore.completeBy &&
    (chore.instanceStatus === "assigned" || chore.status === "assigned")
  ) {
    const hold = document.createElement("span");
    hold.className = "meta-pill";
    hold.textContent = `Complete by ${formatCompleteBy(chore.completeBy)}`;
    meta.append(hold);
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
  return meta;
}

function openTaskCard(chore) {
  pendingTaskCard = chore;
  const done =
    chore.status === "done" || chore.instanceStatus === "done";
  taskCardTitle.textContent = chore.title;
  taskCardBody.innerHTML = "";
  taskCardActions.innerHTML = "";
  const actionsLeft = document.createElement("div");
  actionsLeft.className = "task-card-actions-left";
  const actionsRight = document.createElement("div");
  actionsRight.className = "task-card-actions-right";
  taskCardActions.append(actionsLeft, actionsRight);

  const meta = buildTaskMeta(chore);
  if (meta.childNodes.length > 0) taskCardBody.append(meta);

  if (chore.description) {
    const desc = document.createElement("p");
    desc.className = "chore-description";
    desc.textContent = chore.description;
    taskCardBody.append(desc);
  }

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
    taskCardBody.append(ol);
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
    taskCardBody.append(figure);
  }

  // Footer: secondary on the left (Edit / Reject), primary on the right (Mark done / Reopen / Approve).
  // "I'll do it" was removed — open tasks use Mark done only.
  if (backend === "supabase-rich" || backend === "local" || backend === "supabase") {
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "ghost";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => {
      closeTaskCard();
      openEditDialog(chore);
    });
    actionsLeft.append(edit);
  }

  if (
    done &&
    chore.assessmentStatus === "pending" &&
    chore.completionId &&
    isAdmin() &&
    (backend === "supabase-rich" || backend === "local")
  ) {
    const reject = document.createElement("button");
    reject.type = "button";
    reject.className = "ghost";
    reject.textContent = "Reject";
    reject.addEventListener("click", () => {
      closeTaskCard();
      void assessChore(chore, "rejected");
    });
    actionsLeft.append(reject);

    const approve = document.createElement("button");
    approve.type = "button";
    approve.className = "primary";
    approve.textContent = `Approve (+${chore.points ?? DEFAULT_TASK_POINTS} pts)`;
    approve.addEventListener("click", () => {
      closeTaskCard();
      void assessChore(chore, "approved");
    });
    actionsRight.append(approve);
  } else if (!done && chore.instanceStatus !== "waiting") {
    const markDone = document.createElement("button");
    markDone.type = "button";
    markDone.className = "primary";
    markDone.textContent = "Mark done";
    markDone.addEventListener("click", () => {
      closeTaskCard();
      onCheckClick(chore);
    });
    actionsRight.append(markDone);
  } else if (done) {
    const reopen = document.createElement("button");
    reopen.type = "button";
    reopen.className = "ghost";
    reopen.textContent = "Reopen";
    reopen.addEventListener("click", () => {
      closeTaskCard();
      void reopenChore(chore);
    });
    actionsRight.append(reopen);
  }

  const hasActions =
    actionsLeft.childNodes.length > 0 || actionsRight.childNodes.length > 0;
  taskCardActions.hidden = !hasActions;

  if (typeof taskDialog.showModal === "function") {
    taskDialog.showModal();
  }
}

function closeTaskCard() {
  pendingTaskCard = null;
  if (taskDialog?.open) taskDialog.close();
}

function setComposerOpen(open) {
  composerOpen = Boolean(open);
  composerDock?.classList.toggle("is-open", composerOpen);
  if (newTaskToggle) {
    newTaskToggle.setAttribute("aria-expanded", composerOpen ? "true" : "false");
  }
  if (!composerDialog) return;
  if (composerOpen) {
    if (!composerDialog.open && typeof composerDialog.showModal === "function") {
      composerDialog.showModal();
    }
    // Defer focus so iPad Safari doesn't fight the dialog open animation.
    requestAnimationFrame(() => titleInput?.focus());
  } else if (composerDialog.open) {
    composerDialog.close();
  }
}

function rememberCreatedChore(chore) {
  if (!chore?.id) return;
  recentCreates.set(String(chore.id), {
    chore,
    until: Date.now() + 20000,
  });
}

function mergeRecentCreatesIntoList() {
  const now = Date.now();
  for (const [id, entry] of [...recentCreates.entries()]) {
    if (!entry || entry.until < now) {
      recentCreates.delete(id);
      continue;
    }
    if (chores.some((c) => String(c.id) === id)) {
      recentCreates.delete(id);
      continue;
    }
    if (filter === "open" || filter === "all") {
      const status = entry.chore.instanceStatus || entry.chore.status;
      const openLike =
        status === "noticed" ||
        status === "open" ||
        status === "assigned" ||
        (entry.chore.status === "open" && !entry.chore.instanceStatus);
      if (filter === "all" || openLike) {
        chores = [entry.chore, ...chores];
      }
    }
  }
}

async function loadChores({ quiet = false } = {}) {
  const epoch = ++loadEpoch;
  const statusKey = filter === "people" ? "all" : filter;

  if (backend === "supabase-rich") {
    const board = await fetchRichBoard(statusKey);
    if (epoch !== loadEpoch) return;
    people = board.people;
    templatesById = board.templatesById;
    completions = board.completions;
    scoreRows = board.scoreRows;
    pointsHistory = board.pointsHistory;
    lastPointsResetAt = board.lastPointsResetAt;
    chores = board.chores;
    mergeRecentCreatesIntoList();
    paintedFromCache = false;
    const fp = boardFingerprint();
    if (quiet && fp === lastBoardFingerprint) return;
    lastBoardFingerprint = fp;
    writeSwrCache();
    render();
  } else if (backend === "supabase") {
    const nextChores = await listLegacySupabase(statusKey);
    if (epoch !== loadEpoch) return;
    chores = nextChores;
    scoreRows = [];
    mergeRecentCreatesIntoList();
    paintedFromCache = false;
    const fp = boardFingerprint();
    if (quiet && fp === lastBoardFingerprint) return;
    lastBoardFingerprint = fp;
    writeSwrCache();
    render();
  } else if (backend === "api") {
    const statusParam =
      filter === "scores" || filter === "people" ? "all" : filter;
    const data = await api(
      `api/chores?status=${encodeURIComponent(statusParam)}`,
    );
    if (epoch !== loadEpoch) return;
    chores = (data.chores ?? []).map((c) => ({ ...c, mode: "legacy" }));
    scoreRows = [];
    mergeRecentCreatesIntoList();
    paintedFromCache = false;
    const fp = boardFingerprint();
    if (quiet && fp === lastBoardFingerprint) return;
    lastBoardFingerprint = fp;
    writeSwrCache();
    render();
  } else {
    chores = listLocal(statusKey);
    mergeRecentCreatesIntoList();
    paintedFromCache = false;
    const fp = boardFingerprint();
    if (quiet && fp === lastBoardFingerprint) return;
    lastBoardFingerprint = fp;
    writeSwrCache();
    render();
  }

  if (!quiet && (backend === "supabase" || backend === "supabase-rich")) {
    setStatus(
      backend === "supabase-rich"
        ? "Synced (points + weekly reset + assessment)."
        : "Synced with Supabase.",
    );
  }
}

/** Paint an edited chore immediately so a slow/stale poll cannot flash the old row. */
function applyEditedChoreLocally(updated) {
  if (!updated?.id) return;
  const openLike =
    updated.instanceStatus === "noticed" ||
    updated.instanceStatus === "open" ||
    updated.instanceStatus === "assigned" ||
    (updated.status === "open" && !updated.instanceStatus);
  const showInFilter =
    filter === "all" ||
    filter === "people" ||
    filter === "scores" ||
    (filter === "open" && openLike) ||
    (filter === "done" &&
      (updated.status === "done" || updated.instanceStatus === "done"));
  const index = chores.findIndex((c) => c.id === updated.id);
  if (index >= 0) {
    if (showInFilter) {
      chores = [
        ...chores.slice(0, index),
        updated,
        ...chores.slice(index + 1),
      ];
    } else {
      chores = chores.filter((c) => c.id !== updated.id);
    }
  } else if (showInFilter) {
    chores = [updated, ...chores];
  }
  lastBoardFingerprint = boardFingerprint();
  writeSwrCache();
  render();
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

async function addHouseholdPerson(nameEl, roleEl) {
  const nameInput =
    nameEl || document.querySelector("#personName");
  const roleInput =
    roleEl || document.querySelector("#personRole");
  const name = nameInput?.value?.trim() || "";
  if (!name) {
    setStatus("Enter a name to add a household person.");
    return;
  }
  const role = roleInput?.value || "child";
  try {
    if (backend === "supabase-rich") {
      const existing = people.find(
        (p) => p.displayName.toLowerCase() === name.toLowerCase(),
      );
      if (existing) {
        await updatePersonRole(existing.id, role);
      } else {
        await findOrCreatePerson(name, role);
      }
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
      lastPointsResetAt =
        store.householdMeta?.lastPointsResetAt ?? lastPointsResetAt;
      pointsHistory = mapHistoryRows(store.pointsHistory ?? []);
      scoreRows = computeScoreboard(
        people,
        store.completions,
        lastPointsResetAt,
      );
    } else {
      setStatus("Adding people needs rich Supabase schema or local mode.");
      return;
    }
    if (nameInput) nameInput.value = "";
    fillMeSelect();
    writeSwrCache();
    setStatus(
      role === "parent"
        ? `Added ${name} as parent (admin). Select them under “I am”.`
        : `Added ${name}.`,
    );
    if (filter === "scores" || filter === "people") render();
  } catch (error) {
    setStatus(error.message);
  }
}

function openEditDialog(chore) {
  if (backend === "api") {
    setStatus("Edit needs Supabase or local mode.");
    return;
  }
  pendingEdit = chore;
  editTitleInput.value = chore.title || "";
  editDescriptionInput.value = chore.description || "";
  editAssigneeInput.value = chore.assignee || "";
  if (editCompleteByInput) {
    editCompleteByInput.value = completeByToLocalInput(chore.completeBy);
  }
  const uiKind = uiKindFromStored(
    chore.kind,
    chore.recurrenceInterval,
    chore.recurrenceUnit,
  );
  editKindInput.value = uiKind;
  const fallbackInterval =
    uiKind === "days_after"
      ? DEFAULT_DAYS_AFTER_INTERVAL
      : DEFAULT_PERIODIC_INTERVAL;
  editRecurrenceIntervalInput.value = String(
    chore.recurrenceInterval || fallbackInterval,
  );
  editRecurrenceUnitInput.value =
    uiKind === "days_after"
      ? "day"
      : chore.recurrenceUnit || DEFAULT_PERIODIC_UNIT;
  editPointsInput.value = String(
    chore.points ?? DEFAULT_TASK_POINTS,
  );
  editDueDateInput.value = chore.dueDate || "";
  editStepsInput.value = stepsToTextarea(chore.steps);
  editReferencePhotoInput.value = "";
  editRefHint.textContent = chore.referencePhotoPath
    ? "A reference photo is already set — choose a file only to replace it."
    : "Optional: add a “what good looks like” photo.";
  syncComposerAdminUi();
  if (typeof editDialog.showModal === "function") {
    editDialog.showModal();
  } else {
    void saveEditTask(chore, collectEditPayload());
  }
}

function collectEditPayload() {
  const selected = resolveKindSelection(
    editKindInput.value || "once",
    Number(editRecurrenceIntervalInput.value) || undefined,
    editRecurrenceUnitInput.value || DEFAULT_PERIODIC_UNIT,
  );
  return {
    title: editTitleInput.value.trim(),
    description: editDescriptionInput.value.trim() || undefined,
    assignee: editAssigneeInput.value.trim() || undefined,
    completeBy: completeByFromLocalInput(editCompleteByInput?.value),
    kind: selected.kind,
    recurrenceInterval: selected.recurrenceInterval,
    recurrenceUnit: selected.recurrenceUnit,
    points: Math.max(
      0,
      Math.floor(Number(editPointsInput.value) || DEFAULT_TASK_POINTS),
    ),
    dueDate: editDueDateInput.value || undefined,
    steps: parseSteps(editStepsInput.value),
    referenceFile: editReferencePhotoInput.files?.[0] ?? null,
  };
}

async function updateLocalTask(chore, input) {
  const store = loadLocalV2();
  const index = store.instances.findIndex((i) => i.id === chore.id);
  if (index < 0) throw new Error("Task not found");
  const kind = input.kind || "once";
  const recurrence = resolveRecurrence(
    kind,
    input.recurrenceInterval,
    input.recurrenceUnit,
  );
  const points = Math.max(
    0,
    Math.floor(Number(input.points ?? DEFAULT_TASK_POINTS)),
  );
  const title = input.title.trim();
  const description = input.description?.trim() || undefined;
  let person = null;
  if (input.assignee?.trim()) {
    person = store.people.find(
      (p) =>
        (p.displayName || p.display_name || "").toLowerCase() ===
        input.assignee.toLowerCase(),
    );
    if (!person) {
      person = {
        id: newId("person"),
        displayName: input.assignee.trim(),
        role: "child",
        active: true,
        createdAt: new Date().toISOString(),
      };
      store.people.push(person);
    }
  }
  let referencePath =
    chore.referencePhotoPath ||
    store.templates.find((t) => t.id === chore.templateId)?.referencePhotoPath;
  if (input.referenceFile) {
    referencePath = await fileToDataUrl(input.referenceFile);
  }
  if (chore.templateId) {
    const tIndex = store.templates.findIndex((t) => t.id === chore.templateId);
    if (tIndex >= 0) {
      store.templates[tIndex] = {
        ...store.templates[tIndex],
        title,
        description,
        kind,
        recurrenceInterval: recurrence.recurrenceInterval,
        recurrenceUnit: recurrence.recurrenceUnit,
        cooldownDays: recurrence.cooldownDays,
        points,
        steps: input.steps ?? [],
        referencePhotoPath: referencePath,
      };
    }
  }
  const current = store.instances[index];
  const openLike =
    current.status === "noticed" ||
    current.status === "open" ||
    current.status === "assigned";
  const next = {
    ...current,
    title,
    description,
    dueDate: input.dueDate,
  };
  if (openLike) {
    if (person) {
      next.status = "assigned";
      next.assigneePersonId = person.id;
      next.assignee = person.displayName;
      next.assignedAt = new Date().toISOString();
      next.completeBy = input.completeBy;
    } else {
      next.status = current.status === "noticed" ? "noticed" : "open";
      delete next.assigneePersonId;
      delete next.assignee;
      delete next.assignedAt;
      delete next.completeBy;
      delete next.complete_by;
    }
  }
  store.instances[index] = next;
  saveLocalV2(store);
  const template = store.templates.find((t) => t.id === next.templateId) || null;
  const templateRow = template
    ? {
        id: template.id,
        title: template.title,
        description: template.description,
        kind: template.kind,
        recurrence_interval: template.recurrenceInterval,
        recurrence_unit: template.recurrenceUnit,
        points: template.points,
        steps: template.steps ?? [],
        reference_photo_path: template.referencePhotoPath,
      }
    : null;
  return instanceToView(
    {
      id: next.id,
      title: next.title,
      description: next.description,
      status: next.status,
      assignee: next.assignee,
      assignee_person_id: next.assigneePersonId ?? next.assignee_person_id,
      due_date: next.dueDate ?? next.due_date,
      due_at: next.dueAt ?? next.due_at,
      complete_by: next.completeBy ?? next.complete_by,
      created_at: next.createdAt ?? next.created_at,
      completed_at: next.completedAt ?? next.completed_at,
      template_id: next.templateId ?? next.template_id,
    },
    templateRow,
    store.completions,
  );
}

async function updateLegacyTask(chore, input) {
  return updateLegacySupabase(chore.id, {
    title: input.title.trim(),
    assignee: input.assignee?.trim() || "",
    dueDate: input.dueDate || "",
  });
}

async function saveEditTask(chore, input) {
  if (!input.title) {
    pendingEdit = chore;
    setStatus("Title is required.", { tone: "error" });
    if (typeof editDialog.showModal === "function") editDialog.showModal();
    return;
  }
  const holdError = assignmentHoldError(input.assignee, input.completeBy);
  if (holdError) {
    pendingEdit = chore;
    setStatus(holdError, { tone: "error" });
    if (typeof editDialog.showModal === "function") editDialog.showModal();
    return;
  }
  pendingEdit = null;
  try {
    setStatus("Saving changes…");
    let updated = null;
    if (backend === "supabase-rich") {
      updated = await updateRichTask(chore, input);
    } else if (backend === "local") {
      updated = await updateLocalTask(chore, input);
    } else if (backend === "supabase") {
      updated = await updateLegacyTask(chore, input);
    } else {
      throw new Error("Edit needs Supabase or local mode.");
    }
    if (updated) applyEditedChoreLocally(updated);
    setStatus("Task updated.", { tone: "ok" });
    // Bump epoch so any in-flight poll cannot overwrite this paint with pre-edit rows.
    loadEpoch += 1;
    await loadChores({ quiet: true });
  } catch (error) {
    pendingEdit = chore;
    setStatus(error.message, { tone: "error" });
    if (typeof editDialog.showModal === "function") editDialog.showModal();
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
      delete store.instances[index].completeBy;
      delete store.instances[index].complete_by;
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
      throw new Error("Admin mode required to assess completions.");
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
        assessedByPersonId: assessor?.id,
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
  openMarkDoneDialog(chore);
}

function openMarkDoneDialog(chore) {
  pendingComplete = chore;
  completeTitleEl.textContent = chore.title;
  fillCompletePersonSelect();
  if (chore.assigneePersonId && people.some((p) => p.id === chore.assigneePersonId)) {
    completePersonSelect.value = chore.assigneePersonId;
  }
  completeMinutesInput.value = "";
  completeDifficultyInput.value = "";
  resetProofCameraUi();
  if (typeof completeDialog.showModal === "function") {
    completeDialog.showModal();
  } else {
    void finishComplete(chore, {
      personId: completePersonSelect.value || meSelect.value || null,
    });
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

async function finishComplete(chore, options = {}) {
  const proofFile = options.proofFile ?? null;
  const personId = options.personId || null;
  const actualMinutes = options.actualMinutes;
  const feltDifficulty = options.feltDifficulty;
  try {
    if (personId) {
      meSelect.value = personId;
      localStorage.setItem(ME_KEY, personId);
      syncComposerAdminUi();
    }
    if (backend === "supabase-rich") {
      await completeRich(chore, {
        proofFile,
        personId,
        actualMinutes,
        feltDifficulty,
      });
    } else if (backend === "supabase") {
      const person = people.find((p) => p.id === personId);
      await updateLegacySupabase(chore.id, {
        status: "done",
        ...(person ? { assignee: person.displayName } : {}),
      });
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
      const person = personId
        ? store.people.find((p) => p.id === personId)
        : null;
      store.instances[index] = {
        ...current,
        status: "done",
        completedAt: now,
        ...(person
          ? {
              assigneePersonId: person.id,
              assignee: person.displayName ?? person.display_name,
            }
          : {}),
      };
      let proofPath = null;
      if (proofFile) {
        proofPath = await fileToDataUrl(proofFile);
      }
      store.completions.push({
        id: newId("comp"),
        instanceId: chore.id,
        templateId: chore.templateId,
        personId: personId || undefined,
        completedAt: now,
        actualMinutes: actualMinutes ?? undefined,
        feltDifficulty: feltDifficulty ?? undefined,
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
        ? `Marked done (proof kept ~${PROOF_TTL_DAYS} days). Pending assessment.`
        : "Marked done. Pending assessment.",
    );
    await loadChores({ quiet: true });
  } catch (error) {
    setStatus(error.message);
  } finally {
    stopProofCamera();
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

document.querySelector("#complete-confirm")?.addEventListener("click", () => {
  if (!pendingComplete) return;
  const personId = completePersonSelect.value;
  if (!personId) {
    setStatus("Choose who did it before marking done.");
    if (proofCameraStatus) {
      proofCameraStatus.textContent = "Pick a name under “Who did it?”.";
    }
    completePersonSelect.focus();
    return;
  }
  if (people.length === 0) {
    setStatus("Add a person under People first.");
    return;
  }
  const chore = pendingComplete;
  const file = proofCapturedFile || proofPhotoInput.files?.[0] || null;
  const minutesRaw = completeMinutesInput.value.trim();
  const actualMinutes = minutesRaw
    ? Math.max(1, Math.floor(Number(minutesRaw)))
    : undefined;
  const feltDifficulty = completeDifficultyInput.value || undefined;
  pendingComplete = null;
  completeDialog.close();
  void finishComplete(chore, {
    proofFile: file,
    personId,
    actualMinutes,
    feltDifficulty,
  });
});

document.querySelector("#complete-cancel")?.addEventListener("click", () => {
  pendingComplete = null;
  stopProofCamera();
  completeDialog.close();
});

completeDialog.addEventListener("close", () => {
  stopProofCamera();
});

// Prevent accidental Enter submits from closing without validation.
completeForm.addEventListener("submit", (event) => {
  event.preventDefault();
});

proofOpenCameraBtn?.addEventListener("click", () => {
  void startProofCamera();
});

proofShutterBtn?.addEventListener("click", () => {
  void shutterProofCamera().catch((error) => {
    if (proofCameraStatus) proofCameraStatus.textContent = error.message;
  });
});

proofRetakeBtn?.addEventListener("click", () => {
  resetProofCameraUi();
  void startProofCamera();
});

proofPickFileBtn?.addEventListener("click", () => {
  stopProofCamera();
  proofPhotoInput?.click();
});

proofPhotoInput?.addEventListener("change", () => {
  const file = proofPhotoInput.files?.[0] ?? null;
  proofCapturedFile = file;
  if (file && proofPreview) {
    proofPreview.src = URL.createObjectURL(file);
    proofPreview.classList.remove("hidden");
    proofVideo?.classList.add("hidden");
    proofCameraStage?.classList.add("is-live");
    proofOpenCameraBtn?.classList.add("hidden");
    proofShutterBtn?.classList.add("hidden");
    proofRetakeBtn?.classList.remove("hidden");
    if (proofCameraStatus) {
      proofCameraStatus.textContent = "Photo ready from library.";
    }
  }
});

referenceOpenCameraBtn?.addEventListener("click", () => {
  void (async () => {
    if (!canUseGetUserMedia()) {
      referencePhotoInput?.click();
      if (referenceCameraStatus) {
        referenceCameraStatus.textContent =
          "In-page camera unavailable — use the file picker.";
      }
      return;
    }
    const file = await openSharedCamera();
    if (file) {
      assignFileToInput(referencePhotoInput, file);
      if (referenceCameraStatus) {
        referenceCameraStatus.textContent = "Reference photo captured.";
      }
    }
  })();
});

editReferenceOpenCameraBtn?.addEventListener("click", () => {
  void (async () => {
    if (!canUseGetUserMedia()) {
      editReferencePhotoInput?.click();
      return;
    }
    const file = await openSharedCamera();
    if (file) {
      assignFileToInput(editReferencePhotoInput, file);
      editRefHint.textContent = "New reference photo captured — save to keep it.";
    }
  })();
});

sharedShutterBtn?.addEventListener("click", () => {
  void (async () => {
    if (!sharedVideo || !sharedCanvas || !sharedStream) return;
    const width = sharedVideo.videoWidth || 1280;
    const height = sharedVideo.videoHeight || 960;
    sharedCanvas.width = width;
    sharedCanvas.height = height;
    const ctx = sharedCanvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(sharedVideo, 0, 0, width, height);
    const file = await canvasToImageFile(
      sharedCanvas,
      `reference_${Date.now()}.jpg`,
    );
    sharedCapturedFile = file;
    sharedPreview.src = URL.createObjectURL(file);
    sharedPreview.classList.remove("hidden");
    sharedVideo.classList.add("hidden");
    stopSharedCamera();
    sharedShutterBtn.classList.add("hidden");
    sharedRetakeBtn.classList.remove("hidden");
    sharedKeepBtn.classList.remove("hidden");
    if (sharedCameraStatus) {
      sharedCameraStatus.textContent = "Keep this photo or retake.";
    }
  })();
});

sharedRetakeBtn?.addEventListener("click", () => {
  sharedCapturedFile = null;
  sharedPreview?.classList.add("hidden");
  sharedKeepBtn?.classList.add("hidden");
  sharedRetakeBtn?.classList.add("hidden");
  sharedShutterBtn?.classList.remove("hidden");
  void (async () => {
    try {
      sharedStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      sharedVideo.srcObject = sharedStream;
      sharedVideo.classList.remove("hidden");
      await sharedVideo.play().catch(() => {});
    } catch (error) {
      if (sharedCameraStatus) {
        sharedCameraStatus.textContent = error.message;
      }
    }
  })();
});

sharedKeepBtn?.addEventListener("click", () => {
  const file = sharedCapturedFile;
  sharedCapturedFile = null;
  closeSharedCamera(file);
});

sharedCancelBtn?.addEventListener("click", () => {
  sharedCapturedFile = null;
  closeSharedCamera(null);
});

cameraDialog?.addEventListener("close", () => {
  if (sharedCameraResolve) {
    sharedCapturedFile = null;
    closeSharedCamera(null);
  } else {
    stopSharedCamera();
  }
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

newTaskToggle?.addEventListener("click", () => {
  setComposerOpen(true);
});

composerCloseBtn?.addEventListener("click", () => {
  setComposerOpen(false);
});

composerDialog?.addEventListener("close", () => {
  composerOpen = false;
  composerDock?.classList.remove("is-open");
  newTaskToggle?.setAttribute("aria-expanded", "false");
});

composerDialog?.addEventListener("cancel", () => {
  composerOpen = false;
});

taskCardClose?.addEventListener("click", () => {
  closeTaskCard();
});

taskDialog?.addEventListener("close", () => {
  pendingTaskCard = null;
});

assigneeInput.addEventListener("input", () => {
  syncCompleteByFields();
});

editAssigneeInput?.addEventListener("input", () => {
  syncCompleteByFields();
});

meSelect.addEventListener("change", () => {
  localStorage.setItem(ME_KEY, meSelect.value);
  syncComposerAdminUi();
  render();
});

kindInput.addEventListener("change", () => {
  syncComposerAdminUi({ applyDefaultInterval: true });
});

editKindInput.addEventListener("change", () => {
  syncComposerAdminUi({ applyDefaultInterval: true });
});

// Edit sheet: explicit buttons (like Mark done). Do not rely on method=dialog
// + event.submitter — missing submitter defaults to cancel and drops the save
// (Enter key / older WebKit). Collect payload before close so fields stay readable.
editForm.addEventListener("submit", (event) => {
  event.preventDefault();
});

document.querySelector("#edit-cancel")?.addEventListener("click", () => {
  pendingEdit = null;
  editDialog?.close();
});

document.querySelector("#edit-save")?.addEventListener("click", () => {
  if (!pendingEdit) {
    editDialog?.close();
    return;
  }
  const chore = pendingEdit;
  const payload = collectEditPayload();
  editDialog?.close();
  void saveEditTask(chore, payload);
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filter = button.dataset.filter || "open";
    filterButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", active ? "true" : "false");
    });
    // Paint cached list immediately when switching tabs, then revalidate.
    if (backend === "supabase" || backend === "supabase-rich") {
      paintFromSwrCache();
    }
    void loadChores({ quiet: true }).catch((error) => setStatus(error.message));
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  if (!title) {
    setStatus("Enter a task title, then tap Add.", { tone: "error" });
    titleInput?.focus();
    return;
  }

  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  setStatus("Saving…");
  try {
    const selected = resolveKindSelection(
      kindInput.value || "once",
      Number(recurrenceIntervalInput.value) || undefined,
      recurrenceUnitInput.value || DEFAULT_PERIODIC_UNIT,
    );
    const payload = {
      title,
      description: descriptionInput.value.trim() || undefined,
      assignee: assigneeInput.value.trim() || undefined,
      dueDate: dueDateInput.value || undefined,
      completeBy: completeByFromLocalInput(completeByInput?.value),
      kind: selected.kind,
      recurrenceInterval: selected.recurrenceInterval,
      recurrenceUnit: selected.recurrenceUnit,
      points: Math.max(
        0,
        Math.floor(Number(pointsInput.value) || DEFAULT_TASK_POINTS),
      ),
      steps: parseSteps(stepsInput.value),
      referenceFile: referencePhotoInput.files?.[0] ?? null,
    };
    const holdError = assignmentHoldError(payload.assignee, payload.completeBy);
    if (holdError) {
      setStatus(holdError, { tone: "error" });
      submit.disabled = false;
      return;
    }
    let created = null;
    if (backend === "supabase-rich") {
      created = await addRichSupabase(payload);
      if (payload.assignee) await findOrCreatePerson(payload.assignee);
    } else if (backend === "supabase") {
      created = await addLegacySupabase(payload);
    } else if (backend === "api") {
      const data = await api("api/chores", {
        method: "POST",
        body: JSON.stringify({
          title: payload.title,
          assignee: payload.assignee,
          dueDate: payload.dueDate,
        }),
      });
      created = data.chore ? { ...data.chore, mode: "legacy" } : null;
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
        description: payload.description,
        kind: payload.kind,
        recurrenceInterval: payload.recurrenceInterval,
        recurrenceUnit: payload.recurrenceUnit,
        cooldownDays: selected.cooldownDays,
        points: payload.points,
        steps: payload.steps,
        referencePhotoPath: referencePath,
        estimatedMinutes: 10,
        effortWeight: 1,
        createdFrom: "manual",
        active: true,
        createdAt: now,
      });
      const instanceId = newId("inst");
      store.instances.push({
        id: instanceId,
        templateId,
        title: payload.title,
        description: payload.description,
        status: person ? "assigned" : "open",
        assigneePersonId: person?.id,
        assignee: person?.displayName,
        dueDate: payload.dueDate,
        ...(person && payload.completeBy
          ? { completeBy: payload.completeBy }
          : {}),
        createdAt: now,
        source: "manual",
      });
      saveLocalV2(store);
      created = instanceToView(
        {
          id: instanceId,
          template_id: templateId,
          title: payload.title,
          description: payload.description,
          status: person ? "assigned" : "open",
          assignee: person?.displayName,
          due_date: payload.dueDate,
          complete_by:
            person && payload.completeBy ? payload.completeBy : undefined,
          created_at: now,
        },
        {
          id: templateId,
          title: payload.title,
          kind: payload.kind,
          recurrence_interval: payload.recurrenceInterval,
          recurrence_unit: payload.recurrenceUnit,
          points: payload.points,
          steps: payload.steps,
          reference_photo_path: referencePath,
        },
      );
    }
    if (!created?.id) {
      throw new Error("Save returned no task — nothing was added.");
    }

    // 1) Put title on the open list immediately  2) close New task tile  3) revalidate
    showCreatedTaskOnList(created);
    form.reset();
    kindInput.value = "once";
    recurrenceIntervalInput.value = String(DEFAULT_PERIODIC_INTERVAL);
    recurrenceUnitInput.value = DEFAULT_PERIODIC_UNIT;
    pointsInput.value = String(DEFAULT_TASK_POINTS);
    syncComposerAdminUi();
    setComposerOpen(false);
    setStatus(
      backend === "supabase" || backend === "supabase-rich"
        ? `Added “${created.title}”.`
        : backend === "local"
          ? `Added “${created.title}” (this device).`
          : `Added “${created.title}”.`,
      { tone: "ok" },
    );
    try {
      await loadChores({ quiet: true });
      showCreatedTaskOnList(created);
    } catch (refreshError) {
      console.warn("Refresh after add failed", refreshError);
      showCreatedTaskOnList(created);
      setStatus(
        `Added “${created.title}” (list refresh lagged — pull to refresh if needed).`,
        { tone: "ok" },
      );
    }
  } catch (error) {
    setComposerOpen(true);
    setStatus(formatAddError(error), { tone: "error" });
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
      .register(new URL("sw.js", BASE), {
        scope: BASE.pathname,
        updateViaCache: "none",
      })
      .then((reg) => {
        void reg.update();
        // If a waiting worker has the Add fix, activate it without a second visit.
        if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              worker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch(() => {});
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // One reload so the New-task Add fix is guaranteed after SW bump.
      if (sessionStorage.getItem("chores.swReloaded") === "1") return;
      sessionStorage.setItem("chores.swReloaded", "1");
      location.reload();
    });
  });
}

syncComposerAdminUi();
setComposerOpen(false);

// Instant first paint from cache while backend detection + fetch run.
paintFromSwrCache();

void (async () => {
  backend = await detectBackend();
  backendReady = true;
  if (pendingReleaseIds.size > 0) schedulePersistReleases();
  if (backend === "supabase-rich") {
    setStatus(
      paintedFromCache
        ? "Refreshing from Supabase…"
        : "Connected (rich model). Polling…",
    );
    startPolling();
  } else if (backend === "supabase") {
    setStatus(
      "Connected to Supabase (legacy table). Run schema.sql for points/recurrence.",
    );
    startPolling();
  } else if (backend === "local") {
    setStatus("Saved on this device (no Supabase / API).");
  }
  await loadChores({ quiet: true });
  if (backend === "supabase" || backend === "supabase-rich") {
    setStatus("Synced.");
  }
})().catch((error) => {
  if (!paintedFromCache) {
    summaryEl.textContent = "Could not load chores.";
  }
  setStatus(error.message);
});
