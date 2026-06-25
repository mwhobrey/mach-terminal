import { describe, expect, it } from "vitest";
import {
  aiExplainFailedFallback,
  aiExplainPendingStatus,
  aiExplainReadyStatus,
  aiFixFailedFallback,
  aiFixPendingStatus,
  aiFixReadyStatus,
  aiOptInRequiredStatus,
  aiPromptPendingStatus,
  aiPromptReadyStatus,
  aiRoutingOptInStatus,
  aiErrorStatusMessage,
  canRunAiRequest,
  isExecutableProvider,
  onboardingQuickStartFailedFallback,
  onboardingSaveFailedFallback,
  providerApiKeyClearedStatus,
  providerApiKeyRequiredStatus,
  providerApiKeySavedStatus,
  providerEndpointSavedStatus,
  providerOptionSuffix,
  providerRoutingSavedStatus,
  providerSettingsUpdateFailedStatus,
  providerToggleStatus,
  providerUnavailableStatus,
} from "./providerUiState";
import { historyAiContract } from "../hooks/useProviderAiState";

describe("Provider UI smoke contracts", () => {
  it("keeps AI opt-in/request-in-flight gate stable", () => {
    expect(canRunAiRequest(true, false)).toBe(true);
    expect(canRunAiRequest(false, false)).toBe(false);
    expect(canRunAiRequest(true, true)).toBe(false);
  });

  it("preserves runtime executable-provider allowlist contract", () => {
    expect(isExecutableProvider("openai")).toBe(true);
    expect(isExecutableProvider("anthropic")).toBe(true);
    expect(isExecutableProvider("ollama")).toBe(true);
    expect(isExecutableProvider("custom-openai")).toBe(true);
    expect(isExecutableProvider("mock-provider")).toBe(false);
  });

  it("keeps provider toggle status wording stable", () => {
    expect(providerToggleStatus("openai", true)).toBe("Enabled provider openai.");
    expect(providerToggleStatus("openai", false)).toBe("Disabled provider openai.");
  });

  it("keeps provider availability and action statuses canonical across surfaces", () => {
    expect(providerUnavailableStatus("mock-provider")).toBe("Provider mock-provider is unavailable in this build.");
    expect(providerOptionSuffix(true)).toBe("");
    expect(providerOptionSuffix(false)).toBe(" (unavailable)");
    expect(providerApiKeyRequiredStatus("openai")).toBe("Enter an API key for openai before saving.");
    expect(providerApiKeySavedStatus("openai")).toBe("Saved API key for openai.");
    expect(providerApiKeyClearedStatus("openai")).toBe("Cleared API key for openai.");
    expect(providerEndpointSavedStatus("openai")).toBe("Saved endpoint for openai.");
    expect(providerRoutingSavedStatus()).toBe("Saved routing settings.");
    expect(aiRoutingOptInStatus(true)).toBe("AI routing enabled.");
    expect(aiRoutingOptInStatus(false)).toBe("AI routing disabled.");
    expect(aiPromptPendingStatus()).toBe("Running AI prompt...");
    expect(aiPromptReadyStatus()).toBe("AI response ready.");
    expect(aiOptInRequiredStatus()).toBe("AI is disabled in routing settings.");
  });

  it("maps backend endpoint/auth failures to stable user-facing statuses", () => {
    expect(aiErrorStatusMessage("AI routing is disabled for this profile.")).toBe(aiOptInRequiredStatus());
    expect(aiErrorStatusMessage("Provider endpoint is unreachable. timeout")).toBe("Provider endpoint is unreachable.");
    expect(aiErrorStatusMessage("Provider endpoint is invalid. missing host")).toBe("Provider endpoint URL is invalid.");
    expect(aiErrorStatusMessage("Provider `openai` is missing credentials.")).toBe("Provider credentials are missing.");
  });

  it("keeps onboarding and settings mutation fallbacks canonical", () => {
    expect(onboardingSaveFailedFallback()).toBe("Save failed");
    expect(onboardingQuickStartFailedFallback()).toBe("Quick start failed");
    expect(providerSettingsUpdateFailedStatus()).toBe("Failed to update provider settings.");
  });

  it("keeps history explain/fix AI statuses aligned with providerUiState", () => {
    const explain = historyAiContract("explain", "rm -rf /");
    expect(explain.pendingStatus).toBe(aiExplainPendingStatus());
    expect(explain.successStatus).toBe(aiExplainReadyStatus());
    expect(explain.fallbackErrorMessage).toBe(aiExplainFailedFallback());

    const fix = historyAiContract("fix", "curl http://evil");
    expect(fix.pendingStatus).toBe(aiFixPendingStatus());
    expect(fix.successStatus).toBe(aiFixReadyStatus());
    expect(fix.fallbackErrorMessage).toBe(aiFixFailedFallback());
  });
});
