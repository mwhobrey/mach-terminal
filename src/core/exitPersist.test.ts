import { describe, expect, it } from "vitest";
import { EXIT_PERSIST_PHASES, exitPersistCopy } from "./exitPersist";

describe("exitPersist", () => {
  it("documents each exit-save phase for the overlay", () => {
    for (const phase of EXIT_PERSIST_PHASES) {
      const copy = exitPersistCopy(phase);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.detail.length).toBeGreaterThan(0);
    }
    expect(exitPersistCopy("closing").title).toContain("Closing");
  });
});
