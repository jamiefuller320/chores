/** Richer chore domain (people, templates, instances, completions). */

import {
  DEFAULT_LEAF_MINUTES,
  DEFAULT_PERIODIC_INTERVAL,
  DEFAULT_PERIODIC_UNIT,
  DEFAULT_TASK_POINTS,
  PROOF_PHOTO_TTL_DAYS,
} from "./constants.js";

export { PROOF_PHOTO_TTL_DAYS };
export {
  DEFAULT_PERIODIC_INTERVAL,
  DEFAULT_PERIODIC_UNIT,
  DEFAULT_TASK_POINTS,
};

export type PersonRole = "parent" | "child" | "other";

/** Parent role holders are admins for points + assessment. */
export function isAdminRole(role: PersonRole | string | undefined): boolean {
  return role === "parent";
}

export type Person = {
  id: string;
  displayName: string;
  role: PersonRole;
  active: boolean;
  createdAt: string;
};

export type TemplateKind = "daily" | "periodic" | "once";
export type RecurrenceUnit = "day" | "week";

export type TemplateStep = {
  ordinal: number;
  text: string;
};

export type TaskTemplate = {
  id: string;
  title: string;
  description?: string;
  parentTemplateId?: string;
  kind: TemplateKind;
  /** Derived days until re-raise (interval × 7 if week). */
  cooldownDays?: number;
  recurrenceInterval?: number;
  recurrenceUnit?: RecurrenceUnit;
  /** Reward points; admin/parent sets. */
  points: number;
  estimatedMinutes?: number;
  effortWeight: number;
  steps: TemplateStep[];
  referencePhotoPath?: string;
  defaultAssigneePersonId?: string;
  createdFrom: "notice" | "manual" | "import" | "split";
  active: boolean;
  createdAt: string;
};

export type InstanceStatus =
  | "noticed"
  | "open"
  | "assigned"
  | "done"
  | "waiting"
  | "retired";

export type TaskInstance = {
  id: string;
  templateId?: string;
  parentInstanceId?: string;
  title: string;
  description?: string;
  estimatedMinutes?: number;
  status: InstanceStatus;
  assigneePersonId?: string;
  /** Denormalized display name */
  assignee?: string;
  noticedAt?: string;
  openedAt?: string;
  assignedAt?: string;
  completedAt?: string;
  dueAt?: string;
  dueDate?: string;
  /**
   * Assignee holds this instance only until this instant. After it passes
   * while the task is still unfinished, releaseExpiredClaims clears the
   * assignee and returns status to open.
   */
  completeBy?: string;
  source: "notice" | "schedule" | "manual" | "split";
  createdAt: string;
};

export type FeltDifficulty = "easy" | "ok" | "hard";
export type AssessmentStatus = "pending" | "approved" | "rejected";

export type CompletionEvent = {
  id: string;
  instanceId: string;
  templateId?: string;
  personId?: string;
  completedAt: string;
  actualMinutes?: number;
  feltDifficulty?: FeltDifficulty;
  estimatedMinutesAtStart?: number;
  proofPhotoPath?: string;
  proofExpiresAt?: string;
  assessmentStatus: AssessmentStatus;
  pointsAwarded?: number;
  assessedByPersonId?: string;
  assessedAt?: string;
  createdAt: string;
};

export type HouseholdModelStore = {
  people: Person[];
  templates: TaskTemplate[];
  instances: TaskInstance[];
  completions: CompletionEvent[];
};

export type ScoreboardRow = {
  personId: string;
  displayName: string;
  role: PersonRole;
  points: number;
};

export function emptyModelStore(): HouseholdModelStore {
  return { people: [], templates: [], instances: [], completions: [] };
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function parseStepsFromText(raw: string | undefined): TemplateStep[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((text, index) => ({ ordinal: index + 1, text }));
}

export function proofExpiresAt(
  completedAtIso: string,
  ttlDays: number = PROOF_PHOTO_TTL_DAYS,
): string {
  const ms = Date.parse(completedAtIso);
  const base = Number.isNaN(ms) ? Date.now() : ms;
  return new Date(base + ttlDays * 24 * 60 * 60 * 1000).toISOString();
}

/** Normalize periodic recurrence; apply 4-week default when unset. */
export function resolveRecurrence(
  kind: TemplateKind,
  interval?: number,
  unit?: RecurrenceUnit,
): {
  recurrenceInterval?: number;
  recurrenceUnit?: RecurrenceUnit;
  cooldownDays?: number;
} {
  if (kind === "once") {
    return {};
  }
  if (kind === "daily") {
    return { recurrenceInterval: 1, recurrenceUnit: "day", cooldownDays: 1 };
  }
  const resolvedUnit: RecurrenceUnit = unit ?? DEFAULT_PERIODIC_UNIT;
  const resolvedInterval =
    interval !== undefined && interval > 0
      ? Math.floor(interval)
      : DEFAULT_PERIODIC_INTERVAL;
  const cooldownDays =
    resolvedInterval * (resolvedUnit === "week" ? 7 : 1);
  return {
    recurrenceInterval: resolvedInterval,
    recurrenceUnit: resolvedUnit,
    cooldownDays,
  };
}

export function formatRecurrenceLabel(
  kind: TemplateKind,
  interval?: number,
  unit?: RecurrenceUnit,
): string | null {
  if (kind === "once") return null;
  if (kind === "daily") return "Daily";
  const resolved = resolveRecurrence(kind, interval, unit);
  const n = resolved.recurrenceInterval ?? DEFAULT_PERIODIC_INTERVAL;
  const u = resolved.recurrenceUnit ?? DEFAULT_PERIODIC_UNIT;
  if (u === "week") {
    return n === 1 ? "Every week" : `Every ${n} weeks`;
  }
  return n === 1 ? "Every day" : `Every ${n} days`;
}

export function nextDueAt(
  completedAtIso: string,
  kind: TemplateKind,
  interval?: number,
  unit?: RecurrenceUnit,
): string | undefined {
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
  const days = cooldownDays ?? DEFAULT_PERIODIC_INTERVAL * 7;
  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
}

export function findPersonByName(
  people: Person[],
  name: string,
): Person | undefined {
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  return people.find((p) => p.displayName.toLowerCase() === needle);
}

export function upsertPersonByName(
  store: HouseholdModelStore,
  displayName: string,
  role: PersonRole = "child",
): { store: HouseholdModelStore; person: Person } {
  const existing = findPersonByName(store.people, displayName);
  if (existing) {
    return { store, person: existing };
  }
  const person: Person = {
    id: newId("person"),
    displayName: displayName.trim(),
    role,
    active: true,
    createdAt: new Date().toISOString(),
  };
  return {
    store: { ...store, people: [...store.people, person] },
    person,
  };
}

export type NoticeInput = {
  title: string;
  description?: string;
  kind?: TemplateKind;
  cooldownDays?: number;
  recurrenceInterval?: number;
  recurrenceUnit?: RecurrenceUnit;
  points?: number;
  estimatedMinutes?: number;
  assigneeName?: string;
  steps?: TemplateStep[];
  referencePhotoPath?: string;
  dueDate?: string;
  /** ISO time the assignee must finish by; hold releases after this. */
  completeBy?: string;
  source?: TaskInstance["source"];
};

/** Create a flat template + open instance (leaf = root). */
export function noticeTask(
  store: HouseholdModelStore,
  input: NoticeInput,
): {
  store: HouseholdModelStore;
  template: TaskTemplate;
  instance: TaskInstance;
} {
  let next = store;
  let assigneePerson: Person | undefined;
  if (input.assigneeName?.trim()) {
    const upserted = upsertPersonByName(next, input.assigneeName);
    next = upserted.store;
    assigneePerson = upserted.person;
  }

  const kind = input.kind ?? "once";
  const recurrence = resolveRecurrence(
    kind,
    input.recurrenceInterval,
    input.recurrenceUnit,
  );
  // Honor explicit cooldownDays override when provided without recurrence fields.
  if (
    kind === "periodic" &&
    input.cooldownDays !== undefined &&
    input.recurrenceInterval === undefined
  ) {
    recurrence.cooldownDays = input.cooldownDays;
    recurrence.recurrenceInterval = input.cooldownDays;
    recurrence.recurrenceUnit = "day";
  }

  const now = new Date().toISOString();
  const template: TaskTemplate = {
    id: newId("tmpl"),
    title: input.title.trim(),
    ...(input.description?.trim()
      ? { description: input.description.trim() }
      : {}),
    kind,
    ...(recurrence.cooldownDays !== undefined
      ? { cooldownDays: recurrence.cooldownDays }
      : {}),
    ...(recurrence.recurrenceInterval !== undefined
      ? { recurrenceInterval: recurrence.recurrenceInterval }
      : {}),
    ...(recurrence.recurrenceUnit
      ? { recurrenceUnit: recurrence.recurrenceUnit }
      : {}),
    points:
      input.points !== undefined && input.points >= 0
        ? Math.floor(input.points)
        : DEFAULT_TASK_POINTS,
    ...(input.estimatedMinutes !== undefined
      ? { estimatedMinutes: input.estimatedMinutes }
      : { estimatedMinutes: DEFAULT_LEAF_MINUTES }),
    effortWeight: 1,
    steps: input.steps ?? [],
    ...(input.referencePhotoPath
      ? { referencePhotoPath: input.referencePhotoPath }
      : {}),
    ...(assigneePerson
      ? { defaultAssigneePersonId: assigneePerson.id }
      : {}),
    createdFrom: input.source === "notice" ? "notice" : "manual",
    active: true,
    createdAt: now,
  };

  const assigned = Boolean(assigneePerson);
  const instance: TaskInstance = {
    id: newId("inst"),
    templateId: template.id,
    title: template.title,
    ...(template.description ? { description: template.description } : {}),
    ...(template.estimatedMinutes !== undefined
      ? { estimatedMinutes: template.estimatedMinutes }
      : {}),
    status: assigned ? "assigned" : "open",
    ...(assigneePerson
      ? {
          assigneePersonId: assigneePerson.id,
          assignee: assigneePerson.displayName,
          assignedAt: now,
        }
      : {}),
    openedAt: now,
    ...(input.dueDate?.trim() ? { dueDate: input.dueDate.trim() } : {}),
    ...(assigned && input.completeBy && !Number.isNaN(Date.parse(input.completeBy))
      ? { completeBy: new Date(input.completeBy).toISOString() }
      : {}),
    source: input.source ?? "manual",
    createdAt: now,
  };

  return {
    store: {
      ...next,
      templates: [...next.templates, template],
      instances: [...next.instances, instance],
    },
    template,
    instance,
  };
}

export function selfAssign(
  store: HouseholdModelStore,
  instanceId: string,
  personId: string,
  completeBy?: string | null,
):
  | { ok: true; store: HouseholdModelStore; instance: TaskInstance }
  | { ok: false; error: string } {
  const person = store.people.find((p) => p.id === personId && p.active);
  if (!person) {
    return { ok: false, error: `No active person with id ${personId}` };
  }
  const index = store.instances.findIndex((i) => i.id === instanceId);
  if (index < 0) {
    return { ok: false, error: `No instance with id ${instanceId}` };
  }
  const current = store.instances[index]!;
  if (current.status === "done" || current.status === "retired") {
    return { ok: false, error: `Cannot assign a ${current.status} task` };
  }
  if (current.status === "waiting") {
    return { ok: false, error: "Cannot assign a waiting (cooldown) task" };
  }

  const now = new Date().toISOString();
  const hold =
    completeBy && !Number.isNaN(Date.parse(completeBy))
      ? new Date(completeBy).toISOString()
      : undefined;
  const next: TaskInstance = {
    ...current,
    status: "assigned",
    assigneePersonId: person.id,
    assignee: person.displayName,
    assignedAt: now,
    ...(hold ? { completeBy: hold } : {}),
  };
  if (!hold) delete next.completeBy;
  const instances = store.instances.slice();
  instances[index] = next;
  return { ok: true, store: { ...store, instances }, instance: next };
}

export function assignByName(
  store: HouseholdModelStore,
  instanceId: string,
  displayName: string,
  completeBy?: string,
):
  | {
      ok: true;
      store: HouseholdModelStore;
      instance: TaskInstance;
      person?: Person;
    }
  | { ok: false; error: string } {
  const name = displayName.trim();
  if (!name) {
    return clearAssignee(store, instanceId);
  }
  const { store: withPerson, person } = upsertPersonByName(store, name);
  const result = selfAssign(withPerson, instanceId, person.id, completeBy);
  if (!result.ok) return result;
  return { ok: true, store: result.store, instance: result.instance, person };
}

export function clearAssignee(
  store: HouseholdModelStore,
  instanceId: string,
):
  | { ok: true; store: HouseholdModelStore; instance: TaskInstance }
  | { ok: false; error: string } {
  const index = store.instances.findIndex((i) => i.id === instanceId);
  if (index < 0) {
    return { ok: false, error: `No instance with id ${instanceId}` };
  }
  const current = store.instances[index]!;
  if (current.status === "done" || current.status === "retired") {
    return { ok: false, error: `Cannot clear assignee on ${current.status}` };
  }
  const next: TaskInstance = { ...current, status: "open" };
  delete next.assigneePersonId;
  delete next.assignee;
  delete next.assignedAt;
  delete next.completeBy;
  const instances = store.instances.slice();
  instances[index] = next;
  return { ok: true, store: { ...store, instances }, instance: next };
}

export type CompleteInput = {
  instanceId: string;
  personId?: string;
  actualMinutes?: number;
  feltDifficulty?: FeltDifficulty;
  proofPhotoPath?: string;
};

/**
 * Mark done + pending assessment. For recurring templates, schedules the next
 * cycle as a waiting instance (assignee cleared). Points are not awarded here.
 */
export function completeInstance(
  store: HouseholdModelStore,
  input: CompleteInput,
):
  | {
      ok: true;
      store: HouseholdModelStore;
      instance: TaskInstance;
      completion: CompletionEvent;
      nextInstance?: TaskInstance;
    }
  | { ok: false; error: string } {
  const index = store.instances.findIndex((i) => i.id === input.instanceId);
  if (index < 0) {
    return { ok: false, error: `No instance with id ${input.instanceId}` };
  }
  const current = store.instances[index]!;
  if (current.status === "done") {
    return { ok: false, error: "Instance already done" };
  }
  if (current.status === "waiting" || current.status === "retired") {
    return { ok: false, error: `Cannot complete a ${current.status} task` };
  }

  const now = new Date().toISOString();
  const next: TaskInstance = {
    ...current,
    status: "done",
    completedAt: now,
  };
  const completion: CompletionEvent = {
    id: newId("comp"),
    instanceId: current.id,
    ...(current.templateId ? { templateId: current.templateId } : {}),
    ...(input.personId
      ? { personId: input.personId }
      : current.assigneePersonId
        ? { personId: current.assigneePersonId }
        : {}),
    completedAt: now,
    ...(input.actualMinutes !== undefined
      ? { actualMinutes: input.actualMinutes }
      : {}),
    ...(input.feltDifficulty ? { feltDifficulty: input.feltDifficulty } : {}),
    ...(current.estimatedMinutes !== undefined
      ? { estimatedMinutesAtStart: current.estimatedMinutes }
      : {}),
    ...(input.proofPhotoPath
      ? {
          proofPhotoPath: input.proofPhotoPath,
          proofExpiresAt: proofExpiresAt(now),
        }
      : {}),
    assessmentStatus: "pending",
    createdAt: now,
  };

  // Next-cycle rule: expire prior proof photos for the same template immediately.
  const completions = store.completions.map((event) => {
    if (
      current.templateId &&
      event.templateId === current.templateId &&
      event.proofPhotoPath &&
      event.proofExpiresAt &&
      Date.parse(event.proofExpiresAt) > Date.parse(now)
    ) {
      return { ...event, proofExpiresAt: now };
    }
    return event;
  });
  completions.push(completion);

  const instances = store.instances.slice();
  instances[index] = next;

  let nextInstance: TaskInstance | undefined;
  const template = current.templateId
    ? store.templates.find((t) => t.id === current.templateId)
    : undefined;
  if (template && template.kind !== "once" && template.active) {
    const dueAt = nextDueAt(
      now,
      template.kind,
      template.recurrenceInterval,
      template.recurrenceUnit,
    );
    nextInstance = {
      id: newId("inst"),
      templateId: template.id,
      title: template.title,
      ...(template.description ? { description: template.description } : {}),
      ...(template.estimatedMinutes !== undefined
        ? { estimatedMinutes: template.estimatedMinutes }
        : {}),
      status: "waiting",
      openedAt: now,
      ...(dueAt ? { dueAt } : {}),
      source: "schedule",
      createdAt: now,
    };
    instances.push(nextInstance);
  }

  return {
    ok: true,
    store: { ...store, instances, completions },
    instance: next,
    completion,
    ...(nextInstance ? { nextInstance } : {}),
  };
}

export type AssessInput = {
  completionId: string;
  assessorPersonId: string;
  decision: "approved" | "rejected";
  /** Override award; defaults to template points on approve. */
  pointsAwarded?: number;
};

/** Parent/admin assesses a completion; scoreboard credit only on approve. */
export function assessCompletion(
  store: HouseholdModelStore,
  input: AssessInput,
):
  | { ok: true; store: HouseholdModelStore; completion: CompletionEvent }
  | { ok: false; error: string } {
  const assessor = store.people.find(
    (p) => p.id === input.assessorPersonId && p.active,
  );
  if (!assessor) {
    return { ok: false, error: "Assessor not found" };
  }
  if (!isAdminRole(assessor.role)) {
    return {
      ok: false,
      error: "Only parents (admin) can assess task completions",
    };
  }
  const index = store.completions.findIndex((c) => c.id === input.completionId);
  if (index < 0) {
    return { ok: false, error: `No completion with id ${input.completionId}` };
  }
  const current = store.completions[index]!;
  if (current.assessmentStatus !== "pending") {
    return {
      ok: false,
      error: `Completion already ${current.assessmentStatus}`,
    };
  }

  const template = current.templateId
    ? store.templates.find((t) => t.id === current.templateId)
    : undefined;
  const defaultPoints = template?.points ?? DEFAULT_TASK_POINTS;
  const now = new Date().toISOString();
  const awarded =
    input.decision === "approved"
      ? input.pointsAwarded !== undefined
        ? Math.max(0, Math.floor(input.pointsAwarded))
        : defaultPoints
      : 0;

  const next: CompletionEvent = {
    ...current,
    assessmentStatus: input.decision,
    pointsAwarded: awarded,
    assessedByPersonId: assessor.id,
    assessedAt: now,
  };
  const completions = store.completions.slice();
  completions[index] = next;
  return { ok: true, store: { ...store, completions }, completion: next };
}

/** Set template points — admin/parent only. */
export function setTemplatePoints(
  store: HouseholdModelStore,
  templateId: string,
  points: number,
  actorPersonId: string,
):
  | { ok: true; store: HouseholdModelStore; template: TaskTemplate }
  | { ok: false; error: string } {
  const actor = store.people.find((p) => p.id === actorPersonId && p.active);
  if (!actor || !isAdminRole(actor.role)) {
    return { ok: false, error: "Only parents (admin) can set task points" };
  }
  if (!Number.isFinite(points) || points < 0) {
    return { ok: false, error: "points must be a non-negative number" };
  }
  const index = store.templates.findIndex((t) => t.id === templateId);
  if (index < 0) {
    return { ok: false, error: `No template with id ${templateId}` };
  }
  const next: TaskTemplate = {
    ...store.templates[index]!,
    points: Math.floor(points),
  };
  const templates = store.templates.slice();
  templates[index] = next;
  return { ok: true, store: { ...store, templates }, template: next };
}

/** Running points from approved completions. */
export function scoreboard(store: HouseholdModelStore): ScoreboardRow[] {
  const totals = new Map<string, number>();
  for (const event of store.completions) {
    if (event.assessmentStatus !== "approved" || !event.personId) continue;
    const add = event.pointsAwarded ?? 0;
    totals.set(event.personId, (totals.get(event.personId) ?? 0) + add);
  }
  return store.people
    .filter((p) => p.active)
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

/** Promote due waiting instances to open (cleared assignee). */
export function promoteDueWaiting(
  store: HouseholdModelStore,
  nowIso: string = new Date().toISOString(),
): HouseholdModelStore {
  const now = Date.parse(nowIso);
  let changed = false;
  const instances = store.instances.map((instance) => {
    if (instance.status !== "waiting" || !instance.dueAt) return instance;
    const due = Date.parse(instance.dueAt);
    if (Number.isNaN(due) || due > now) return instance;
    changed = true;
    const next: TaskInstance = {
      ...instance,
      status: "open",
      openedAt: nowIso,
    };
    delete next.assigneePersonId;
    delete next.assignee;
    delete next.assignedAt;
    delete next.completeBy;
    return next;
  });
  return changed ? { ...store, instances } : store;
}

/**
 * After completeBy, an unfinished assignment is released: assignee cleared,
 * status open, so anyone can mark it done. Done / waiting / retired rows stay.
 */
export function releaseExpiredClaims(
  store: HouseholdModelStore,
  nowIso: string = new Date().toISOString(),
): HouseholdModelStore {
  const now = Date.parse(nowIso);
  if (Number.isNaN(now)) return store;
  let changed = false;
  const instances = store.instances.map((instance) => {
    if (
      instance.status === "done" ||
      instance.status === "waiting" ||
      instance.status === "retired" ||
      !instance.completeBy
    ) {
      return instance;
    }
    const hold = Date.parse(instance.completeBy);
    if (Number.isNaN(hold) || hold > now) return instance;
    if (
      instance.status !== "assigned" &&
      !instance.assignee &&
      !instance.assigneePersonId
    ) {
      return instance;
    }
    changed = true;
    const next: TaskInstance = { ...instance, status: "open" };
    delete next.assigneePersonId;
    delete next.assignee;
    delete next.assignedAt;
    delete next.completeBy;
    return next;
  });
  return changed ? { ...store, instances } : store;
}

export function listOpenInstances(
  store: HouseholdModelStore,
  status: "open" | "done" | "all" = "open",
): TaskInstance[] {
  return store.instances.filter((instance) => {
    if (status === "all") return true;
    if (status === "done") return instance.status === "done";
    // "open" filter = needs attention
    return (
      instance.status === "noticed" ||
      instance.status === "open" ||
      instance.status === "assigned"
    );
  });
}

/** Map instance → legacy-ish chore shape for list UIs still expecting assignee/status open|done. */
export function instanceAsLegacyChore(instance: TaskInstance): {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  status: "open" | "done";
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
  templateId?: string;
  assigneePersonId?: string;
  instanceStatus: InstanceStatus;
} {
  const openLike =
    instance.status === "noticed" ||
    instance.status === "open" ||
    instance.status === "assigned";
  return {
    id: instance.id,
    title: instance.title,
    ...(instance.description ? { description: instance.description } : {}),
    ...(instance.assignee ? { assignee: instance.assignee } : {}),
    status: openLike ? "open" : "done",
    ...(instance.dueDate ? { dueDate: instance.dueDate } : {}),
    createdAt: instance.createdAt,
    ...(instance.completedAt ? { completedAt: instance.completedAt } : {}),
    ...(instance.templateId ? { templateId: instance.templateId } : {}),
    ...(instance.assigneePersonId
      ? { assigneePersonId: instance.assigneePersonId }
      : {}),
    instanceStatus: instance.status,
  };
}
