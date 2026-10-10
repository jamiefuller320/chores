import type { ToolContext } from "@cursor/bdk/tools";
import {
  emptyStore,
  type Chore,
  type ChoreStore,
} from "./chores.js";

export type { Chore, ChoreStatus, ChoreStore } from "./chores.js";
export {
  addChore,
  emptyStore,
  listChores,
  newChoreId,
  updateChore,
} from "./chores.js";

const CHORES_KEY = "household/chores";

type HostKv = ToolContext["host"]["kv"];

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
