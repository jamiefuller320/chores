import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { listChores, loadStore } from "../lib/store.js";

export default defineTool({
  description:
    "List household chores. Optionally filter by status or assignee. Call this before summarizing what is open or overdue.",
  effect: "read",
  inputSchema: z.object({
    status: z
      .enum(["open", "done", "all"])
      .default("open")
      .describe("Which chores to return. Defaults to open."),
    assignee: z
      .string()
      .optional()
      .describe("If set, only chores assigned to this person (case-insensitive)."),
  }),
  async execute({ status, assignee }, ctx) {
    const store = await loadStore(ctx.host.kv);
    const chores = listChores(store, { status, assignee });
    return {
      count: chores.length,
      chores,
    };
  },
});
