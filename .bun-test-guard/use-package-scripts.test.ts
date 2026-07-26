import { test } from "bun:test";

test("use package.json scripts, not bun test", () => {
  throw new Error(
    [
      "This project does not use Bun's test runner.",
      "  Unit/component:  bun run test",
      "  End-to-end:      bun run test:e2e",
    ].join("\n"),
  );
});
