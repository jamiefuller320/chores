import { defineEval, includes } from "@cursor/bdk/evals";

export default defineEval({
  tags: ["smoke"],
  cases: [
    {
      id: "add-trash",
      description: "Adds a trash chore assigned to Alex.",
      async test(t) {
        await t.send(
          "Add a chore: take out the trash, assigned to Alex, due 2026-10-11.",
        );
        t.succeeded();
        t.calledTool("add_chore");
        t.check(t.reply, includes(/trash|Alex/i));
      },
    },
  ],
});
