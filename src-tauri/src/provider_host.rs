use crate::models::{
    AiExecuteRequest, AiExecuteResponse, AppSettings, ProviderDescriptor, ProviderRoutingSettings,
    ProviderSettings,
};
use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::time::Duration;
use tracing::{info, instrument, warn};

#[derive(Debug, Serialize)]
struct OllamaGenerateRequest {
    model: String,
    prompt: String,
    stream: bool,
}

#[derive(Debug, Deserialize)]
struct OllamaGenerateResponse {
    response: String,
}

fn provider_name(provider_id: &str) -> &'static str {
    match provider_id {
        "openai" => "OpenAI",
        "anthropic" => "Anthropic",
        "ollama" => "Ollama (localhost)",
        "custom-openai" => "Custom OpenAI-compatible",
        _ => "Unknown provider",
    }
}

fn provider_kind(provider_id: &str) -> &'static str {
    match provider_id {
        "ollama" => "local",
        "custom-openai" => "custom",
        _ => "cloud",
    }
}

#[instrument(skip(providers))]
pub fn provider_descriptors(providers: &[ProviderSettings]) -> Vec<ProviderDescriptor> {
    providers
        .iter()
        .map(|provider| ProviderDescriptor {
            id: provider.id.clone(),
            name: provider_name(&provider.id).to_string(),
            kind: provider_kind(&provider.id).to_string(),
            enabled: provider.enabled,
            endpoint: provider.endpoint.clone(),
            status: if provider.enabled {
                "available".to_string()
            } else {
                "disabled".to_string()
            },
        })
        .collect()
}

fn resolve_provider(settings: &AppSettings, requested: Option<&str>) -> Result<ProviderSettings, String> {
    let route_to = requested
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(settings.provider_routing.default_provider.as_str());
    settings
        .providers
        .iter()
        .find(|provider| provider.id == route_to)
        .cloned()
        .ok_or_else(|| AiExecutionError::ProviderNotConfigured(route_to.to_string()).to_string())
}

#[derive(Debug)]
enum AiExecutionError {
    RoutingDisabled,
    ProviderNotConfigured(String),
    ProviderDisabled(String),
    ProviderAdapterMissing(String),
    InvalidEndpoint(String),
    EndpointUnreachable(String),
    UpstreamStatus(String),
    DecodeFailure(String),
}

impl fmt::Display for AiExecutionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AiExecutionError::RoutingDisabled => write!(
                f,
                "AI routing is disabled. Enable AI opt-in in provider routing settings before sending AI requests."
            ),
            AiExecutionError::ProviderNotConfigured(provider_id) => {
                write!(f, "Provider `{provider_id}` is not configured.")
            }
            AiExecutionError::ProviderDisabled(provider_id) => write!(
                f,
                "Provider `{provider_id}` is disabled. Enable it in settings before sending AI requests."
            ),
            AiExecutionError::ProviderAdapterMissing(provider_id) => write!(
                f,
                "Provider `{provider_id}` is configured but has no execution adapter yet."
            ),
            AiExecutionError::InvalidEndpoint(message) => {
                write!(f, "Provider endpoint is invalid. {message}")
            }
            AiExecutionError::EndpointUnreachable(message) => {
                write!(f, "Provider endpoint is unreachable. {message}")
            }
            AiExecutionError::UpstreamStatus(message) => {
                write!(f, "Provider returned an error response. {message}")
            }
            AiExecutionError::DecodeFailure(message) => {
                write!(f, "Provider response could not be decoded. {message}")
            }
        }
    }
}

fn normalize_ollama_base_url(provider: &ProviderSettings) -> Result<Url, AiExecutionError> {
    let endpoint = provider
        .endpoint
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("http://127.0.0.1:11434");
    let parsed = Url::parse(endpoint)
        .map_err(|error| AiExecutionError::InvalidEndpoint(format!("`{endpoint}` ({error})")))?;
    match parsed.scheme() {
        "http" | "https" => {}
        scheme => {
            return Err(AiExecutionError::InvalidEndpoint(format!(
                "`{endpoint}` uses unsupported scheme `{scheme}` (expected http or https)"
            )))
        }
    }
    Ok(parsed)
}

#[instrument(skip(client, provider, routing, prompt))]
async fn run_ollama(
    client: &Client,
    provider: &ProviderSettings,
    routing: &ProviderRoutingSettings,
    prompt: &str,
) -> Result<String, String> {
    let base_url = normalize_ollama_base_url(provider).map_err(|error| error.to_string())?;
    let generate_url = base_url
        .join("/api/generate")
        .map_err(|error| {
            AiExecutionError::InvalidEndpoint(format!("failed to construct Ollama generate endpoint ({error})"))
        })
        .map_err(|error| error.to_string())?;
    let request = OllamaGenerateRequest {
        model: routing.ollama_model.clone(),
        prompt: prompt.to_string(),
        stream: false,
    };

    let response = client
        .post(generate_url)
        .json(&request)
        .send()
        .await
        .map_err(|error| {
            if error.is_connect() || error.is_timeout() {
                AiExecutionError::EndpointUnreachable(error.to_string()).to_string()
            } else {
                AiExecutionError::UpstreamStatus(error.to_string()).to_string()
            }
        })?;

    let response = response
        .error_for_status()
        .map_err(|error| AiExecutionError::UpstreamStatus(error.to_string()).to_string())?;

    response
        .json::<OllamaGenerateResponse>()
        .await
        .map(|payload| payload.response)
        .map_err(|error| AiExecutionError::DecodeFailure(error.to_string()).to_string())
}

pub async fn execute_ai_request(
    client: &Client,
    settings: &AppSettings,
    request: &AiExecuteRequest,
) -> Result<AiExecuteResponse, String> {
    if !settings.provider_routing.ai_feature_enabled {
        return Err(AiExecutionError::RoutingDisabled.to_string());
    }

    let provider = resolve_provider(settings, request.provider_id.as_deref())?;
    if !provider.enabled {
        return Err(AiExecutionError::ProviderDisabled(provider.id.clone()).to_string());
    }

    info!(provider_id = provider.id, "executing ai request");
    let output = match provider.id.as_str() {
        "ollama" => run_ollama(client, &provider, &settings.provider_routing, &request.prompt).await?,
        _ => {
            warn!(provider_id = provider.id, "provider configured without execution adapter");
            return Err(AiExecutionError::ProviderAdapterMissing(provider.id).to_string());
        }
    };

    Ok(AiExecuteResponse {
        provider_id: provider.id,
        output,
    })
}

pub fn default_runtime_client() -> Result<Client, String> {
    Client::builder()
        .connect_timeout(Duration::from_secs(4))
        .timeout(Duration::from_secs(20))
        .pool_idle_timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| format!("failed to configure runtime http client: {error}"))
}
