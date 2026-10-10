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

export type ChoreStore = {
  chores: Chore[];
};

export type ListChoresInput = {
  status?: "open" | "done" | "all";
  assignee?: string;
};

export type AddChoreInput = {
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: string;
};

export type UpdateChoreInput = {
  id: string;
  title?: string;
  description?: string;
  assignee?: string;
  dueDate?: string;
  status?: ChoreStatus;
};

export function emptyStore(): ChoreStore {
  return { chores: [] };
}

export function newChoreId(): string {
  return `chore_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function listChores(
  store: ChoreStore,
  { status = "open", assignee }: ListChoresInput = {},
): Chore[] {
  const needle = assignee?.trim().toLowerCase();
  return store.chores.filter((chore) => {
    if (status !== "all" && chore.status !== status) {
      return false;
    }
    if (needle !== undefined && needle.length > 0) {
      return (chore.assignee ?? "").toLowerCase() === needle;
    }
    return true;
  });
}

export function addChore(
  store: ChoreStore,
  input: AddChoreInput,
): { store: ChoreStore; chore: Chore } {
  const chore: Chore = {
    id: newChoreId(),
    title: input.title.trim(),
    ...(input.description?.trim()
      ? { description: input.description.trim() }
      : {}),
    ...(input.assignee?.trim() ? { assignee: input.assignee.trim() } : {}),
    status: "open",
    ...(input.dueDate?.trim() ? { dueDate: input.dueDate.trim() } : {}),
    createdAt: new Date().toISOString(),
  };
  return {
    store: { chores: [...store.chores, chore] },
    chore,
  };
}

export function updateChore(
  store: ChoreStore,
  input: UpdateChoreInput,
):
  | { ok: true; store: ChoreStore; chore: Chore }
  | { ok: false; error: string } {
  const index = store.chores.findIndex((chore) => chore.id === input.id);
  if (index < 0) {
    return { ok: false, error: `No chore with id ${input.id}` };
  }

  const current = store.chores[index]!;
  const next: Chore = { ...current };

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (title.length === 0) {
      return { ok: false, error: "title cannot be empty" };
    }
    next.title = title;
  }
  if (input.description !== undefined) {
    const description = input.description.trim();
    if (description.length === 0) {
      delete next.description;
    } else {
      next.description = description;
    }
  }
  if (input.assignee !== undefined) {
    const assignee = input.assignee.trim();
    if (assignee.length === 0) {
      delete next.assignee;
    } else {
      next.assignee = assignee;
    }
  }
  if (input.dueDate !== undefined) {
    const dueDate = input.dueDate.trim();
    if (dueDate.length === 0) {
      delete next.dueDate;
    } else {
      next.dueDate = dueDate;
    }
  }
  if (input.status !== undefined) {
    next.status = input.status;
    if (input.status === "done") {
      next.completedAt = new Date().toISOString();
    } else {
      delete next.completedAt;
    }
  }

  const chores = store.chores.slice();
  chores[index] = next;
  return { ok: true, store: { chores }, chore: next };
}
