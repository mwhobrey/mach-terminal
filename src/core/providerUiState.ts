export type AiErrorCategory =
  | "routing_disabled"
  | "provider_disabled"
  | "auth_missing"
  | "secret_unavailable"
  | "endpoint_unreachable"
  | "invalid_endpoint"
  | "upstream_error"
  | "decode_error"
  | "generic";

const EXECUTABLE_PROVIDER_IDS = new Set(["openai", "anthropic", "ollama", "custom-openai"]);

export function canRunAiRequest(aiOptInEnabled: boolean, requestInFlight: boolean): boolean {
  return aiOptInEnabled && !requestInFlight;
}

/** Cloud/custom adapters require a stored key before the backend will execute. */
export function providerRequiresApiKey(providerId: string): boolean {
  return providerId === "openai" || providerId === "anthropic" || providerId === "custom-openai";
}

/**
 * True when a provider row is enabled, executable, and has credentials when required.
 * Ollama is ready when enabled; cloud providers need a stored API key.
 */
export function isProviderConfiguredForAi(
  provider: Pick<ProviderCardInput, "id" | "enabled" | "hasStoredKey">,
): boolean {
  if (!isExecutableProvider(provider.id) || !provider.enabled) {
    return false;
  }
  if (providerRequiresApiKey(provider.id)) {
    return provider.hasStoredKey === true;
  }
  return true;
}

/**
 * AI assist surfaces (Explain, Safer, chat, ops-rail AI) are ready only when routing
 * opt-in is on and the default provider is enabled and configured.
 */
export function isAiAssistReady(
  aiFeatureEnabled: boolean,
  defaultProviderId: string,
  providers: readonly Pick<ProviderCardInput, "id" | "enabled" | "hasStoredKey">[],
): boolean {
  if (!aiFeatureEnabled || !isExecutableProvider(defaultProviderId)) {
    return false;
  }
  const defaultProvider = providers.find((provider) => provider.id === defaultProviderId);
  if (!defaultProvider) {
    return false;
  }
  return isProviderConfiguredForAi(defaultProvider);
}

export function aiAssistNotReadyStatus(): string {
  return "Configure and enable an AI provider in settings first.";
}

export function isExecutableProvider(providerId: string): boolean {
  return EXECUTABLE_PROVIDER_IDS.has(providerId);
}

export function providerToggleStatus(providerId: string, enabled: boolean): string {
  return `${enabled ? "Enabled" : "Disabled"} provider ${providerId}.`;
}

export function providerUnavailableStatus(providerId: string): string {
  return `Provider ${providerId} is unavailable in this build.`;
}

export function providerOptionSuffix(executable: boolean): string {
  return executable ? "" : " (unavailable)";
}

/** Routing keys that hold the per-provider model id. */
export type RoutingModelKey = "openai_model" | "anthropic_model" | "ollama_model" | "custom_openai_model";

/** Maps a provider id to the routing draft field that holds its model, or null when it has none. */
export function providerModelRoutingKey(providerId: string): RoutingModelKey | null {
  switch (providerId) {
    case "openai":
      return "openai_model";
    case "anthropic":
      return "anthropic_model";
    case "ollama":
      return "ollama_model";
    case "custom-openai":
      return "custom_openai_model";
    default:
      return null;
  }
}

/** Minimal provider shape the card view-model needs (a structural subset of ProviderDescriptor). */
export interface ProviderCardInput {
  id: string;
  name: string;
  kind: string;
  status: string;
  enabled: boolean;
  envHint?: string;
  hasStoredKey?: boolean;
}

/** Canonical, presentation-ready provider row shared by every provider surface. */
export interface ProviderCardModel {
  id: string;
  name: string;
  kind: string;
  executable: boolean;
  enabled: boolean;
  statusLabel: string;
  isDefault: boolean;
  modelKey: RoutingModelKey | null;
  authLabel: string;
}

/** Short, single-source status word for a provider row. */
export function providerStatusLabel(provider: Pick<ProviderCardInput, "id" | "status" | "enabled">): string {
  if (!isExecutableProvider(provider.id)) {
    return "unavailable";
  }
  return provider.enabled ? "enabled" : provider.status;
}

/** One canonical sentence describing where a provider's credentials live. */
export function providerAuthLabel(provider: Pick<ProviderCardInput, "hasStoredKey" | "envHint">): string {
  const base = provider.hasStoredKey ? "Key stored in secure keychain" : "No stored key";
  return provider.envHint ? `${base} · env fallback: ${provider.envHint}` : base;
}

/**
 * Single source of truth for provider rows across Settings (and, in time, onboarding).
 * Folds executable-allowlist, enabled, default-routing, model field, and auth into one
 * view-model so the same intent renders the same way on every surface.
 */
export function buildProviderCards(providers: ProviderCardInput[], defaultProviderId: string): ProviderCardModel[] {
  return providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    kind: provider.kind,
    executable: isExecutableProvider(provider.id),
    enabled: provider.enabled,
    statusLabel: providerStatusLabel(provider),
    isDefault: provider.id === defaultProviderId,
    modelKey: providerModelRoutingKey(provider.id),
    authLabel: providerAuthLabel(provider),
  }));
}

export function providerEndpointSavedStatus(providerId: string): string {
  return `Saved endpoint for ${providerId}.`;
}

export function providerApiKeyRequiredStatus(providerId: string): string {
  return `Enter an API key for ${providerId} before saving.`;
}

export function providerApiKeySavedStatus(providerId: string): string {
  return `Saved API key for ${providerId}.`;
}

export function providerApiKeyClearedStatus(providerId: string): string {
  return `Cleared API key for ${providerId}.`;
}

export function providerRoutingSavedStatus(): string {
  return "Saved routing settings.";
}

export function aiRoutingOptInStatus(enabled: boolean): string {
  return enabled ? "AI routing enabled." : "AI routing disabled.";
}

export function aiPromptPendingStatus(): string {
  return "Running AI prompt...";
}

export function aiPromptReadyStatus(): string {
  return "AI response ready.";
}

export function aiOptInRequiredStatus(): string {
  return "AI is disabled in routing settings.";
}

export function classifyAiError(message: string): AiErrorCategory {
  const lowered = message.toLowerCase();
  if (lowered.includes("routing is disabled")) {
    return "routing_disabled";
  }
  if (lowered.includes("is disabled")) {
    return "provider_disabled";
  }
  if (lowered.includes("is missing credentials")) {
    return "auth_missing";
  }
  if (lowered.includes("secure provider key storage is unavailable")) {
    return "secret_unavailable";
  }
  if (lowered.includes("unreachable")) {
    return "endpoint_unreachable";
  }
  if (lowered.includes("endpoint is invalid")) {
    return "invalid_endpoint";
  }
  if (lowered.includes("error response")) {
    return "upstream_error";
  }
  if (lowered.includes("could not be decoded")) {
    return "decode_error";
  }
  return "generic";
}

export function aiErrorStatusMessage(message: string): string {
  const category = classifyAiError(message);
  switch (category) {
    case "routing_disabled":
      return "AI is disabled in routing settings.";
    case "provider_disabled":
      return "Selected provider is disabled.";
    case "auth_missing":
      return "Provider credentials are missing.";
    case "secret_unavailable":
      return "Secure key storage is unavailable.";
    case "endpoint_unreachable":
      return "Provider endpoint is unreachable.";
    case "invalid_endpoint":
      return "Provider endpoint URL is invalid.";
    case "upstream_error":
      return "Provider returned an error response.";
    case "decode_error":
      return "Provider response format was invalid.";
    default:
      return "AI request failed.";
  }
}
