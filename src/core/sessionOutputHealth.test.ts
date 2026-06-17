import { describe, expect, it } from "vitest";
import { isSessionOutputStale, SESSION_OUTPUT_STALE_MS } from "./sessionOutputHealth";

describe("sessionOutputHealth", () => {
  it("flags running sessions with no recent output", () => {
    const now = 100_000;
    expect(isSessionOutputStale("running", now - SESSION_OUTPUT_STALE_MS - 1, now)).toBe(true);
  });

  it("ignores exited or never-output sessions", () => {
    const now = 100_000;
    expect(isSessionOutputStale("stopped", now - 999_999, now)).toBe(false);
    expect(isSessionOutputStale("running", undefined, now)).toBe(false);
  });
});
