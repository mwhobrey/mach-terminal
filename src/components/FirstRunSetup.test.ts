import { describe, expect, it } from "vitest";
import { shouldShowOnboardingPwshCta } from "./FirstRunSetup";

describe("shouldShowOnboardingPwshCta", () => {
  it("shows CTA only when prompt is unseen and hook is not installed", () => {
    expect(
      shouldShowOnboardingPwshCta({
        tauri: true,
        promptSeen: false,
        alreadyInstalled: false,
        hardStatusError: false,
      }),
    ).toBe(true);
  });

  it("hides CTA once prompt is marked seen", () => {
    expect(
      shouldShowOnboardingPwshCta({
        tauri: true,
        promptSeen: true,
        alreadyInstalled: false,
        hardStatusError: false,
      }),
    ).toBe(false);
  });

  it("hides CTA when hook is already installed", () => {
    expect(
      shouldShowOnboardingPwshCta({
        tauri: true,
        promptSeen: false,
        alreadyInstalled: true,
        hardStatusError: false,
      }),
    ).toBe(false);
  });
});
