/** Richer chore domain (people, templates, instances, completions). */

import { PROOF_PHOTO_TTL_DAYS } from "./constants.js";

export { PROOF_PHOTO_TTL_DAYS };

export type PersonRole = "parent" | "child" | "other";

export type Person = {
  id: string;
  displayName: string;
  role: PersonRole;
  active: boolean;
  createdAt: string;
};

export type TemplateKind = "daily" | "periodic" | "once";

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
  cooldownDays?: number;
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
  source: "notice" | "schedule" | "manual" | "split";
  createdAt: string;
};

export type FeltDifficulty = "easy" | "ok" | "hard";

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
  createdAt: string;
};

export type HouseholdModelStore = {
  people: Person[];
  templates: TaskTemplate[];
  instances: TaskInstance[];
  completions: CompletionEvent[];
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
  estimatedMinutes?: number;
  assigneeName?: string;
  steps?: TemplateStep[];
  referencePhotoPath?: string;
  dueDate?: string;
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

  const now = new Date().toISOString();
  const template: TaskTemplate = {
    id: newId("tmpl"),
    title: input.title.trim(),
    ...(input.description?.trim()
      ? { description: input.description.trim() }
      : {}),
    kind: input.kind ?? "once",
    ...(input.cooldownDays !== undefined
      ? { cooldownDays: input.cooldownDays }
      : {}),
    ...(input.estimatedMinutes !== undefined
      ? { estimatedMinutes: input.estimatedMinutes }
      : { estimatedMinutes: 10 }),
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
  const next: TaskInstance = {
    ...current,
    status: "assigned",
    assigneePersonId: person.id,
    assignee: person.displayName,
    assignedAt: now,
  };
  const instances = store.instances.slice();
  instances[index] = next;
  return { ok: true, store: { ...store, instances }, instance: next };
}

export function assignByName(
  store: HouseholdModelStore,
  instanceId: string,
  displayName: string,
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
  const result = selfAssign(withPerson, instanceId, person.id);
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

export function completeInstance(
  store: HouseholdModelStore,
  input: CompleteInput,
):
  | {
      ok: true;
      store: HouseholdModelStore;
      instance: TaskInstance;
      completion: CompletionEvent;
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
  return {
    ok: true,
    store: { ...store, instances, completions },
    instance: next,
    completion,
  };
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
