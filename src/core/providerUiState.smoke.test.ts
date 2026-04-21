import { describe, expect, it } from "vitest";
import {
  aiOptInRequiredStatus,
  aiPromptPendingStatus,
  aiPromptReadyStatus,
  aiRoutingOptInStatus,
  aiErrorStatusMessage,
  canRunAiRequest,
  isExecutableProvider,
  providerApiKeyClearedStatus,
  providerApiKeyRequiredStatus,
  providerApiKeySavedStatus,
  providerEndpointSavedStatus,
  providerOptionSuffix,
  providerRoutingSavedStatus,
  providerToggleStatus,
  providerUnavailableStatus,
} from "./providerUiState";

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
});
