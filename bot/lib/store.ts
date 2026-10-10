import type { ToolContext } from "@cursor/bdk/tools";

export type ChoreStatus = "open" | "done";

export type Chore = {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  status: ChoreStatus;
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
};

const CHORES_KEY = "household/chores";

export type ChoreStore = {
  chores: Chore[];
};

type HostKv = ToolContext["host"]["kv"];

function emptyStore(): ChoreStore {
  return { chores: [] };
}

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

export function newChoreId(): string {
  return `chore_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
