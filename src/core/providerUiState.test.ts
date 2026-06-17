import { describe, expect, it } from "vitest";
import {
  aiErrorStatusMessage,
  buildProviderCards,
  canRunAiRequest,
  classifyAiError,
  isAiAssistReady,
  isExecutableProvider,
  isProviderConfiguredForAi,
  providerAuthLabel,
  providerModelRoutingKey,
  providerStatusLabel,
  providerToggleStatus,
  type ProviderCardInput,
} from "./providerUiState";

describe("provider ui state helpers", () => {
  it("gates AI request execution by opt-in and in-flight status", () => {
    expect(canRunAiRequest(true, false)).toBe(true);
    expect(canRunAiRequest(false, false)).toBe(false);
    expect(canRunAiRequest(true, true)).toBe(false);
  });

  it("requires routing opt-in, enabled default provider, and credentials when needed", () => {
    const providers: ProviderCardInput[] = [
      { id: "openai", name: "OpenAI", kind: "cloud", status: "available", enabled: true, hasStoredKey: false },
      { id: "ollama", name: "Ollama", kind: "local", status: "available", enabled: true },
    ];
    expect(isAiAssistReady(false, "ollama", providers)).toBe(false);
    expect(isAiAssistReady(true, "openai", providers)).toBe(false);
    expect(isAiAssistReady(true, "ollama", providers)).toBe(true);
    expect(
      isAiAssistReady(true, "openai", [{ ...providers[0], hasStoredKey: true }]),
    ).toBe(true);
    expect(isProviderConfiguredForAi({ id: "ollama", enabled: false })).toBe(false);
  });

  it("formats provider toggle status for enable/disable transitions", () => {
    expect(providerToggleStatus("ollama", true)).toBe("Enabled provider ollama.");
    expect(providerToggleStatus("openai", false)).toBe("Disabled provider openai.");
  });

  it("marks only runtime-supported providers as executable", () => {
    expect(isExecutableProvider("ollama")).toBe(true);
    expect(isExecutableProvider("openai")).toBe(true);
    expect(isExecutableProvider("anthropic")).toBe(true);
    expect(isExecutableProvider("custom-openai")).toBe(true);
  });

  it("classifies backend AI errors into stable frontend categories", () => {
    expect(classifyAiError("AI routing is disabled. Enable AI opt-in in provider routing settings before sending AI requests."))
      .toBe("routing_disabled");
    expect(classifyAiError("Provider `ollama` is disabled. Enable it in settings before sending AI requests."))
      .toBe("provider_disabled");
    expect(
      classifyAiError(
        "Provider `openai` is missing credentials. Set an API key in settings or configure its environment variable.",
      ),
    ).toBe("auth_missing");
    expect(classifyAiError("Secure provider key storage is unavailable. service unavailable"))
      .toBe("secret_unavailable");
    expect(classifyAiError("Provider endpoint is unreachable. connection refused"))
      .toBe("endpoint_unreachable");
    expect(classifyAiError("Provider endpoint is invalid. missing host"))
      .toBe("invalid_endpoint");
    expect(classifyAiError("Provider returned an error response. 500"))
      .toBe("upstream_error");
    expect(classifyAiError("Provider response could not be decoded. EOF"))
      .toBe("decode_error");
  });

  it("maps backend errors to user-facing status text", () => {
    expect(aiErrorStatusMessage("Provider endpoint is unreachable. timeout")).toBe("Provider endpoint is unreachable.");
    expect(aiErrorStatusMessage("Provider `openai` is missing credentials.")).toBe("Provider credentials are missing.");
    expect(aiErrorStatusMessage("something totally unexpected")).toBe("AI request failed.");
  });

  it("maps provider ids to their routing model field", () => {
    expect(providerModelRoutingKey("openai")).toBe("openai_model");
    expect(providerModelRoutingKey("anthropic")).toBe("anthropic_model");
    expect(providerModelRoutingKey("ollama")).toBe("ollama_model");
    expect(providerModelRoutingKey("custom-openai")).toBe("custom_openai_model");
    expect(providerModelRoutingKey("mystery")).toBeNull();
  });

  it("derives a single status word per provider row", () => {
    expect(providerStatusLabel({ id: "ollama", status: "available", enabled: true })).toBe("enabled");
    expect(providerStatusLabel({ id: "ollama", status: "available", enabled: false })).toBe("available");
    expect(providerStatusLabel({ id: "ollama", status: "disabled", enabled: false })).toBe("disabled");
    expect(providerStatusLabel({ id: "mystery", status: "available", enabled: true })).toBe("unavailable");
  });

  it("describes credential location with optional env fallback", () => {
    expect(providerAuthLabel({ hasStoredKey: true })).toBe("Key stored in secure keychain");
    expect(providerAuthLabel({ hasStoredKey: false })).toBe("No stored key");
    expect(providerAuthLabel({ hasStoredKey: false, envHint: "OPENAI_API_KEY" })).toBe(
      "No stored key · env fallback: OPENAI_API_KEY",
    );
  });

  it("builds one canonical provider card view-model per row", () => {
    const providers: ProviderCardInput[] = [
      { id: "openai", name: "OpenAI", kind: "cloud", status: "disabled", enabled: false, envHint: "OPENAI_API_KEY" },
      { id: "ollama", name: "Ollama (localhost)", kind: "local", status: "available", enabled: true },
      { id: "mystery", name: "Mystery", kind: "custom", status: "available", enabled: false },
    ];
    const cards = buildProviderCards(providers, "ollama");

    expect(cards[0]).toEqual({
      id: "openai",
      name: "OpenAI",
      kind: "cloud",
      executable: true,
      enabled: false,
      statusLabel: "disabled",
      isDefault: false,
      modelKey: "openai_model",
      authLabel: "No stored key · env fallback: OPENAI_API_KEY",
    });
    expect(cards[1].isDefault).toBe(true);
    expect(cards[1].statusLabel).toBe("enabled");
    expect(cards[2].executable).toBe(false);
    expect(cards[2].modelKey).toBeNull();
  });
});
