import { describe, expect, it } from "vitest";
import {
  onboardingQuickStartFailedFallback,
  onboardingSaveFailedFallback,
} from "../core/providerUiState";
import { surfaceErrorMessage } from "../core/errors";
import {
  shouldDisablePwshPromptActions,
  shouldShowOnboardingPwshCta,
} from "./FirstRunSetup";

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

describe("FirstRunSetup provider/onboarding reliability helpers", () => {
  it("maps save/quick-start failures to stable fallback strings", () => {
    expect(surfaceErrorMessage(new Error("network timeout"), onboardingSaveFailedFallback())).toBe("network timeout");
    expect(surfaceErrorMessage("unknown", onboardingQuickStartFailedFallback())).toBe(onboardingQuickStartFailedFallback());
  });

  it("locks onboarding hook actions while loading or hook operations are pending", () => {
    expect(
      shouldDisablePwshPromptActions({
        loading: false,
        pwshHookBusy: false,
        pwshPromptDismissBusy: false,
      }),
    ).toBe(false);
    expect(
      shouldDisablePwshPromptActions({
        loading: true,
        pwshHookBusy: false,
        pwshPromptDismissBusy: false,
      }),
    ).toBe(true);
    expect(
      shouldDisablePwshPromptActions({
        loading: false,
        pwshHookBusy: true,
        pwshPromptDismissBusy: false,
      }),
    ).toBe(true);
    expect(
      shouldDisablePwshPromptActions({
        loading: false,
        pwshHookBusy: false,
        pwshPromptDismissBusy: true,
      }),
    ).toBe(true);
  });
});
