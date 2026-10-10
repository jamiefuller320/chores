import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { loadStore, newChoreId, saveStore } from "../lib/store.js";

export default defineTool({
  description:
    "Add a new household chore. Use when the user asks to create, schedule, or track a new chore.",
  effect: "write",
  inputSchema: z.object({
    title: z.string().min(1).describe("Short chore title, e.g. Take out trash."),
    description: z.string().optional().describe("Optional details or notes."),
    assignee: z
      .string()
      .optional()
      .describe("Person responsible, using the name the household uses."),
    dueDate: z
      .string()
      .optional()
      .describe("Optional due date as YYYY-MM-DD."),
  }),
  async execute({ title, description, assignee, dueDate }, ctx) {
    const store = await loadStore(ctx.host.kv);
    const chore = {
      id: newChoreId(),
      title: title.trim(),
      ...(description?.trim() ? { description: description.trim() } : {}),
      ...(assignee?.trim() ? { assignee: assignee.trim() } : {}),
      status: "open" as const,
      ...(dueDate?.trim() ? { dueDate: dueDate.trim() } : {}),
      createdAt: new Date().toISOString(),
    };
    store.chores.push(chore);
    await saveStore(ctx.host.kv, store);
    return { ok: true as const, chore };
  },
});
