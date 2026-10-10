import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { loadStore, saveStore, type Chore } from "../lib/store.js";

export default defineTool({
  description:
    "Update an existing chore: reassign, change due date, edit title/notes, or mark done/reopen. Prefer listing chores first when the id is unknown.",
  effect: "write",
  inputSchema: z.object({
    id: z.string().min(1).describe("Chore id from list_chores."),
    title: z.string().optional(),
    description: z.string().optional(),
    assignee: z
      .string()
      .optional()
      .describe("Set assignee. Pass empty string to clear."),
    dueDate: z
      .string()
      .optional()
      .describe("YYYY-MM-DD, or empty string to clear."),
    status: z.enum(["open", "done"]).optional(),
  }),
  async execute(input, ctx) {
    const store = await loadStore(ctx.host.kv);
    const index = store.chores.findIndex((chore) => chore.id === input.id);
    if (index < 0) {
      return {
        ok: false as const,
        error: `No chore with id ${input.id}`,
      };
    }

    const current = store.chores[index]!;
    const next: Chore = { ...current };

    if (input.title !== undefined) {
      const title = input.title.trim();
      if (title.length === 0) {
        return { ok: false as const, error: "title cannot be empty" };
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

    store.chores[index] = next;
    await saveStore(ctx.host.kv, store);
    return { ok: true as const, chore: next };
  },
});
