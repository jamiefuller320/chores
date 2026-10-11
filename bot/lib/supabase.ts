/**
 * Supabase adapter for the household SoT (School Compass piggyback).
 *
 * Credential choice (locked default for bot):
 * - Pages: anon / publishable key (browser) — already in web/public/config.js
 * - Bot / host tools: prefer `SUPABASE_SERVICE_ROLE_KEY` (+ `SUPABASE_URL`)
 *   so server tools can write without depending on wide anon RLS forever.
 * - Until service role is set in the host environment, tools keep using
 *   `host.kv` (`bot/lib/store.ts`). Call `isSupabaseConfigured()` before switching.
 *
 * This module is a thin fetch client (no new npm deps). Full tool wiring is
 * deferred until credentials exist in the BDK host; Pages talks to PostgREST
 * directly today.
 */

import {
  type AssessmentStatus,
  type CompletionEvent,
  type HouseholdModelStore,
  type Person,
  type RecurrenceUnit,
  type TaskInstance,
  type TaskTemplate,
  type TemplateStep,
  DEFAULT_TASK_POINTS,
  emptyModelStore,
} from "./model.js";

export type SupabaseConfig = {
  url: string;
  /** Prefer service role for bot; anon is acceptable for read smoke tests. */
  key: string;
};

export function readSupabaseConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseConfig | null {
  const url = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (
    env.SUPABASE_SERVICE_ROLE_KEY ??
    env.SUPABASE_ANON_KEY ??
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  ).trim();
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

export function isSupabaseConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return readSupabaseConfigFromEnv(env) !== null;
}

function headers(config: SupabaseConfig, extra: Record<string, string> = {}) {
  return {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function supabaseRest<T = unknown>(
  config: SupabaseConfig,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = new URL(path.replace(/^\//, ""), `${config.url}/rest/v1/`);
  const response = await fetch(url, {
    ...options,
    headers: headers(config, options.headers as Record<string, string>),
  });
  if (response.status === 204) {
    return null as T;
  }
  const data = (await response.json().catch(() => ({}))) as {
    message?: string;
    error_description?: string;
    hint?: string;
  };
  if (!response.ok) {
    throw new Error(
      data.message ||
        data.error_description ||
        data.hint ||
        `Supabase ${response.status}`,
    );
  }
  return data as T;
}

function rowToPerson(row: Record<string, unknown>): Person {
  return {
    id: String(row.id),
    displayName: String(row.display_name),
    role: row.role as Person["role"],
    active: Boolean(row.active),
    createdAt: String(row.created_at),
  };
}

function rowToTemplate(row: Record<string, unknown>): TaskTemplate {
  const stepsRaw = row.steps;
  const steps: TemplateStep[] = Array.isArray(stepsRaw)
    ? (stepsRaw as TemplateStep[])
    : [];
  return {
    id: String(row.id),
    title: String(row.title),
    ...(row.description ? { description: String(row.description) } : {}),
    ...(row.parent_template_id
      ? { parentTemplateId: String(row.parent_template_id) }
      : {}),
    kind: row.kind as TaskTemplate["kind"],
    ...(row.cooldown_days != null
      ? { cooldownDays: Number(row.cooldown_days) }
      : {}),
    ...(row.recurrence_interval != null
      ? { recurrenceInterval: Number(row.recurrence_interval) }
      : {}),
    ...(row.recurrence_unit
      ? { recurrenceUnit: row.recurrence_unit as RecurrenceUnit }
      : {}),
    points:
      row.points != null ? Number(row.points) : DEFAULT_TASK_POINTS,
    ...(row.estimated_minutes != null
      ? { estimatedMinutes: Number(row.estimated_minutes) }
      : {}),
    effortWeight: Number(row.effort_weight ?? 1),
    steps,
    ...(row.reference_photo_path
      ? { referencePhotoPath: String(row.reference_photo_path) }
      : {}),
    ...(row.default_assignee_person_id
      ? { defaultAssigneePersonId: String(row.default_assignee_person_id) }
      : {}),
    createdFrom: (row.created_from as TaskTemplate["createdFrom"]) ?? "manual",
    active: Boolean(row.active ?? true),
    createdAt: String(row.created_at),
  };
}

function rowToInstance(row: Record<string, unknown>): TaskInstance {
  return {
    id: String(row.id),
    ...(row.template_id ? { templateId: String(row.template_id) } : {}),
    ...(row.parent_instance_id
      ? { parentInstanceId: String(row.parent_instance_id) }
      : {}),
    title: String(row.title),
    ...(row.description ? { description: String(row.description) } : {}),
    ...(row.estimated_minutes != null
      ? { estimatedMinutes: Number(row.estimated_minutes) }
      : {}),
    status: row.status as TaskInstance["status"],
    ...(row.assignee_person_id
      ? { assigneePersonId: String(row.assignee_person_id) }
      : {}),
    ...(row.assignee ? { assignee: String(row.assignee) } : {}),
    ...(row.noticed_at ? { noticedAt: String(row.noticed_at) } : {}),
    ...(row.opened_at ? { openedAt: String(row.opened_at) } : {}),
    ...(row.assigned_at ? { assignedAt: String(row.assigned_at) } : {}),
    ...(row.completed_at ? { completedAt: String(row.completed_at) } : {}),
    ...(row.due_at ? { dueAt: String(row.due_at) } : {}),
    ...(row.due_date ? { dueDate: String(row.due_date) } : {}),
    source: (row.source as TaskInstance["source"]) ?? "manual",
    createdAt: String(row.created_at),
  };
}

function rowToCompletion(row: Record<string, unknown>): CompletionEvent {
  return {
    id: String(row.id),
    instanceId: String(row.instance_id),
    ...(row.template_id ? { templateId: String(row.template_id) } : {}),
    ...(row.person_id ? { personId: String(row.person_id) } : {}),
    completedAt: String(row.completed_at),
    ...(row.actual_minutes != null
      ? { actualMinutes: Number(row.actual_minutes) }
      : {}),
    ...(row.felt_difficulty
      ? {
          feltDifficulty: row.felt_difficulty as CompletionEvent["feltDifficulty"],
        }
      : {}),
    ...(row.estimated_minutes_at_start != null
      ? { estimatedMinutesAtStart: Number(row.estimated_minutes_at_start) }
      : {}),
    ...(row.proof_photo_path
      ? { proofPhotoPath: String(row.proof_photo_path) }
      : {}),
    ...(row.proof_expires_at
      ? { proofExpiresAt: String(row.proof_expires_at) }
      : {}),
    assessmentStatus:
      (row.assessment_status as AssessmentStatus | undefined) ?? "pending",
    ...(row.points_awarded != null
      ? { pointsAwarded: Number(row.points_awarded) }
      : {}),
    ...(row.assessed_by_person_id
      ? { assessedByPersonId: String(row.assessed_by_person_id) }
      : {}),
    ...(row.assessed_at ? { assessedAt: String(row.assessed_at) } : {}),
    createdAt: String(row.created_at),
  };
}

/** Load rich model tables. Throws if v2 tables are missing. */
export async function loadModelFromSupabase(
  config: SupabaseConfig,
): Promise<HouseholdModelStore> {
  const [people, templates, instances, completions] = await Promise.all([
    supabaseRest<Record<string, unknown>[]>(
      config,
      "people?select=*&order=display_name.asc",
    ),
    supabaseRest<Record<string, unknown>[]>(
      config,
      "task_templates?select=*&order=created_at.desc",
    ),
    supabaseRest<Record<string, unknown>[]>(
      config,
      "task_instances?select=*&order=created_at.desc",
    ),
    supabaseRest<Record<string, unknown>[]>(
      config,
      "completion_events?select=*&order=completed_at.desc&limit=500",
    ),
  ]);
  return {
    people: (people ?? []).map(rowToPerson),
    templates: (templates ?? []).map(rowToTemplate),
    instances: (instances ?? []).map(rowToInstance),
    completions: (completions ?? []).map(rowToCompletion),
  };
}

/**
 * Probe whether the additive v2 schema is present.
 * Returns false when only legacy `chores` exists (or network fails).
 */
export async function richSchemaAvailable(
  config: SupabaseConfig,
): Promise<boolean> {
  try {
    await supabaseRest(config, "people?select=id&limit=1");
    await supabaseRest(config, "task_instances?select=id&limit=1");
    return true;
  } catch {
    return false;
  }
}

export function publicStorageUrl(
  config: SupabaseConfig,
  bucket: string,
  path: string,
): string {
  const clean = path.replace(/^\//, "");
  return `${config.url}/storage/v1/object/public/${bucket}/${clean}`;
}

/** Documented env names for operators — not secrets. */
export const SUPABASE_CREDENTIAL_NOTES = {
  pages: "SUPABASE_URL + SUPABASE_ANON_KEY (or publishable) in Pages config",
  botPreferred: "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on the BDK host",
  botFallback: "host.kv household/chores until service role is configured",
  storageBucket: "chore-photos (create via schema.sql / Dashboard)",
  proofTtlDays: 7,
} as const;

export function emptyIfUnconfigured(): HouseholdModelStore {
  return emptyModelStore();
}
