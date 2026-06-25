import type { Dispatch, SetStateAction } from "react";
import {
  buildProviderCards,
  providerOptionSuffix,
  type ProviderCardModel,
  type RoutingModelKey,
} from "../core/providerUiState";
import { isExecutableProvider } from "../core/providerUiState";
import type { ProviderDescriptor } from "../core/providers";
import type { ProviderRoutingSettings } from "../core/terminal";

export type ProviderRoutingDraft = {
  default_provider: string;
  ollama_model: string;
  openai_model: string;
  anthropic_model: string;
  custom_openai_model: string;
};

export type ProviderAiProvidersPanelProps<TRouting extends ProviderRoutingDraft = ProviderRoutingDraft> = {
  providers: ProviderDescriptor[];
  routing: Pick<ProviderRoutingSettings, "ai_feature_enabled" | "default_provider">;
  routingDraft: TRouting;
  setRoutingDraft: Dispatch<SetStateAction<TRouting>>;
  providerConfigStatus: string | null;
  providerEndpointDrafts: Record<string, string>;
  providerApiKeyDrafts: Record<string, string>;
  updateProviderEndpointDraft: (id: string, value: string) => void;
  updateProviderApiKeyDraft: (id: string, value: string) => void;
  toggleProvider: (id: string, enabled: boolean) => void | Promise<void>;
  saveProviderEndpoint: (id: string) => void | Promise<void>;
  saveProviderApiKey: (id: string) => void | Promise<void>;
  clearProviderApiKey: (id: string) => void | Promise<void>;
  setAiOptIn: (enabled: boolean) => void | Promise<void>;
  saveRoutingConfig: () => void | Promise<void>;
  showRoutingBar?: boolean;
  saveRoutingLabel?: string;
  showSaveRouting?: boolean;
};

export function buildProviderCardsFromDescriptors(
  providers: ProviderDescriptor[],
  defaultProviderId: string,
): ProviderCardModel[] {
  return buildProviderCards(
    providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      kind: provider.kind,
      status: provider.status,
      enabled: provider.enabled,
      envHint: provider.envHint,
      hasStoredKey: provider.hasStoredKey,
    })),
    defaultProviderId,
  );
}

/** Shared provider rows + routing header used by Settings and onboarding advanced AI. */
export function ProviderAiProvidersPanel<TRouting extends ProviderRoutingDraft>({
  providers,
  routing,
  routingDraft,
  setRoutingDraft,
  providerConfigStatus,
  providerEndpointDrafts,
  providerApiKeyDrafts,
  updateProviderEndpointDraft,
  updateProviderApiKeyDraft,
  toggleProvider,
  saveProviderEndpoint,
  saveProviderApiKey,
  clearProviderApiKey,
  setAiOptIn,
  saveRoutingConfig,
  showRoutingBar = true,
  saveRoutingLabel = "Save routing",
  showSaveRouting = true,
}: ProviderAiProvidersPanelProps<TRouting>) {
  const providerCards = buildProviderCardsFromDescriptors(providers, routingDraft.default_provider);

  return (
    <>
      {providerConfigStatus ? <p className="muted-block">{providerConfigStatus}</p> : null}
      {showRoutingBar ? (
        <div className="ai-routing-bar">
          <label className="toggle-row ai-routing-optin">
            <input
              type="checkbox"
              checked={routing.ai_feature_enabled}
              onChange={(event) => void setAiOptIn(event.currentTarget.checked)}
            />
            Enable AI features
          </label>
          <label className="field-row ai-routing-default">
            <span>Default provider</span>
            <select
              value={routingDraft.default_provider}
              onChange={(event) =>
                setRoutingDraft((current) => ({ ...current, default_provider: event.currentTarget.value }))
              }
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id} disabled={!isExecutableProvider(provider.id)}>
                  {provider.name}
                  {providerOptionSuffix(isExecutableProvider(provider.id))}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <ul className="provider-block-list">
        {providerCards.map((card) => {
          const modelKey: RoutingModelKey | null = card.modelKey;
          return (
            <li key={card.id}>
              <div className="provider-block-head">
                <span>
                  {card.name}
                  <small>
                    {card.kind}
                    {card.isDefault ? " · default" : ""}
                  </small>
                </span>
                <strong>{card.statusLabel}</strong>
                <button
                  type="button"
                  onClick={() => void toggleProvider(card.id, !card.enabled)}
                  className="inline-btn"
                  disabled={!card.executable && !card.enabled}
                >
                  {card.enabled ? "Disable" : "Enable"}
                </button>
              </div>
              <div className="provider-block-endpoint">
                <input
                  value={providerEndpointDrafts[card.id] ?? ""}
                  onChange={(event) => updateProviderEndpointDraft(card.id, event.currentTarget.value)}
                  placeholder="Endpoint URL"
                  className="inline-input"
                  aria-label={`${card.id} endpoint`}
                  disabled={!card.executable}
                />
                <button
                  type="button"
                  className="inline-btn ghost"
                  onClick={() => void saveProviderEndpoint(card.id)}
                  disabled={!card.executable}
                >
                  Save endpoint
                </button>
              </div>
              <div className="provider-block-endpoint">
                <input
                  type="password"
                  value={providerApiKeyDrafts[card.id] ?? ""}
                  onChange={(event) => updateProviderApiKeyDraft(card.id, event.currentTarget.value)}
                  placeholder={card.authLabel.startsWith("Key stored") ? "Key stored (enter to replace)" : "API key"}
                  className="inline-input"
                  aria-label={`${card.id} api key`}
                  disabled={!card.executable}
                />
                <button
                  type="button"
                  className="inline-btn ghost"
                  onClick={() => void saveProviderApiKey(card.id)}
                  disabled={!card.executable}
                >
                  Save key
                </button>
                <button
                  type="button"
                  className="inline-btn ghost"
                  onClick={() => void clearProviderApiKey(card.id)}
                  disabled={!card.executable}
                >
                  Clear key
                </button>
              </div>
              {modelKey ? (
                <div className="provider-block-endpoint provider-block-model">
                  <span className="provider-block-model-label">Model</span>
                  <input
                    type="text"
                    className="inline-input"
                    placeholder="Model id"
                    aria-label={`${card.id} model`}
                    value={routingDraft[modelKey]}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setRoutingDraft((current) => ({ ...current, [modelKey]: value }));
                    }}
                    disabled={!card.executable}
                  />
                </div>
              ) : null}
              <p className="muted-block">{card.authLabel}</p>
            </li>
          );
        })}
      </ul>
      {showSaveRouting ? (
        <div className="inline-controls">
          <button type="button" className="inline-btn" onClick={() => void saveRoutingConfig()}>
            {saveRoutingLabel}
          </button>
        </div>
      ) : null}
    </>
  );
}
