import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { loadStore, saveStore, updateChore } from "../lib/store.js";

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
    const result = updateChore(store, input);
    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }
    await saveStore(ctx.host.kv, result.store);
    return { ok: true as const, chore: result.chore };
  },
});
