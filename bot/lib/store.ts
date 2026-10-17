import type { ToolContext } from "@cursor/bdk/tools";
import {
  emptyStore,
  type Chore,
  type ChoreStore,
} from "./chores.js";
import {
  isSupabaseConfigured,
  SUPABASE_CREDENTIAL_NOTES,
} from "./supabase.js";

export type { Chore, ChoreStatus, ChoreStore } from "./chores.js";
export {
  addChore,
  emptyStore,
  listChores,
  newChoreId,
  updateChore,
} from "./chores.js";

export {
  assessCompletion,
  assignByName,
  completeInstance,
  emptyModelStore,
  formatRecurrenceLabel,
  isAdminRole,
  listOpenInstances,
  noticeTask,
  promoteDueWaiting,
  releaseExpiredClaims,
  resolveRecurrence,
  scoreboard,
  selfAssign,
  setTemplatePoints,
  DEFAULT_PERIODIC_INTERVAL,
  DEFAULT_PERIODIC_UNIT,
  DEFAULT_TASK_POINTS,
  PROOF_PHOTO_TTL_DAYS,
} from "./model.js";

export type {
  AssessmentStatus,
  CompletionEvent,
  HouseholdModelStore,
  Person,
  RecurrenceUnit,
  ScoreboardRow,
  TaskInstance,
  TaskTemplate,
} from "./model.js";

export { isSupabaseConfigured, SUPABASE_CREDENTIAL_NOTES };

const CHORES_KEY = "household/chores";

type HostKv = ToolContext["host"]["kv"];

/**
 * Legacy flat chore store (host.kv). Production SoT is Supabase once
 * SUPABASE_SERVICE_ROLE_KEY is on the host — see bot/lib/supabase.ts.
 */
export async function loadStore(kv: HostKv): Promise<ChoreStore> {
  const raw = await kv.get(CHORES_KEY);
  if (raw === undefined || raw === null || typeof raw !== "object") {
    return emptyStore();
  }
  const chores = (raw as { chores?: unknown }).chores;
  if (!Array.isArray(chores)) {
    return emptyStore();
  }
  return { chores: chores as Chore[] };
}

export async function saveStore(kv: HostKv, store: ChoreStore): Promise<void> {
  await kv.put(CHORES_KEY, store);
}

/** True when bot tools could switch off kv onto Supabase. */
export function botUsesSupabaseSoT(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isSupabaseConfigured(env);
}
