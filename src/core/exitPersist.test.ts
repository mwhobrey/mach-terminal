import { describe, expect, it, vi } from "vitest";
import { EXIT_PERSIST_PHASES, exitPersistCopy, runExitPersistAndClose } from "./exitPersist";

describe("exitPersist", () => {
  it("documents each exit-save phase for the overlay", () => {
    for (const phase of EXIT_PERSIST_PHASES) {
      const copy = exitPersistCopy(phase);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.detail.length).toBeGreaterThan(0);
    }
    expect(exitPersistCopy("closing").title).toContain("Closing");
  });

  it("still destroys the window when flush fails", async () => {
    const destroyWindow = vi.fn(async () => undefined);
    const result = await runExitPersistAndClose(
      async () => {
        throw new Error("disk full");
      },
      destroyWindow,
    );
    expect(result).toBe("closed");
    expect(destroyWindow).toHaveBeenCalledTimes(1);
  });

  it("reports close failure without throwing", async () => {
    const destroyWindow = vi.fn(async () => {
      throw new Error("permission denied");
    });
    const result = await runExitPersistAndClose(async () => undefined, destroyWindow);
    expect(result).toBe("close-failed");
  });
});
