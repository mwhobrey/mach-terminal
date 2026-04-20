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

/// Hard cap on scrollback excerpt characters appended to prompts (aligned with frontend).
const MAX_CONTEXT_EXCERPT_CHARS: usize = 6000;

/// Keep the **trailing** `max_chars` characters (matches frontend scrollback tail policy).
fn truncate_chars(value: &str, max_chars: usize) -> String {
    let count = value.chars().count();
    if count <= max_chars {
        return value.to_string();
    }
    let skip = count - max_chars;
    value.chars().skip(skip).collect()
}

/// Compose a single prompt string for adapters (provider-specific templates can branch on `intent` later).
pub(crate) fn assemble_prompt(request: &AiExecuteRequest) -> String {
    let mut sections: Vec<String> = Vec::new();
    if let Some(ctx) = &request.context {
        let mut lines: Vec<String> = Vec::new();
        if let Some(cwd) = ctx.cwd.as_ref().filter(|value| !value.trim().is_empty()) {
            lines.push(format!("cwd: {cwd}"));
        }
        if let Some(shell) = ctx.shell.as_ref().filter(|value| !value.trim().is_empty()) {
            lines.push(format!("shell: {shell}"));
        }
        if let Some(branch) = ctx.git_branch.as_ref().filter(|value| !value.trim().is_empty()) {
            lines.push(format!("git_branch: {branch}"));
        }
        if let Some(cmd) = ctx.command_text.as_ref().filter(|value| !value.trim().is_empty()) {
            lines.push(format!("command_text:\n{cmd}"));
        }
        if let Some(excerpt) = ctx.output_excerpt.as_ref().filter(|value| !value.trim().is_empty()) {
            let clipped = truncate_chars(excerpt, MAX_CONTEXT_EXCERPT_CHARS);
            lines.push(format!("recent_terminal_output_tail:\n{clipped}"));
        }
        if !lines.is_empty() {
            sections.push(format!("Session context:\n{}", lines.join("\n")));
        }
    }
    let mut out = sections.join("\n\n");
    if !out.is_empty() {
        out.push_str("\n\n---\n\n");
    }
    out.push_str(request.prompt.trim());
    out
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

    info!(
        provider_id = provider.id,
        intent = ?request.intent,
        has_context = request.context.is_some(),
        "executing ai request"
    );
    let prompt = assemble_prompt(request);
    let output = match provider.id.as_str() {
        "ollama" => run_ollama(client, &provider, &settings.provider_routing, &prompt).await?,
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

#[cfg(test)]
mod assemble_tests {
    use crate::models::{AiExecuteRequest, AiPromptContext};
    use crate::provider_host::assemble_prompt;

    #[test]
    fn prepends_bounded_session_context_sections() {
        let excerpt = format!("{}{}", "x".repeat(7000), "tail-marker");
        let request = AiExecuteRequest {
            session_id: "sid".into(),
            prompt: "Explain the error.".into(),
            provider_id: None,
            intent: Some("explain_command".into()),
            context: Some(AiPromptContext {
                cwd: Some("/tmp/project".into()),
                shell: Some("/bin/bash".into()),
                git_branch: Some("main".into()),
                command_text: Some("cargo build".into()),
                output_excerpt: Some(excerpt),
            }),
        };
        let built = assemble_prompt(&request);
        assert!(built.contains("cwd: /tmp/project"));
        assert!(built.contains("shell: /bin/bash"));
        assert!(built.contains("git_branch: main"));
        assert!(built.contains("command_text:\ncargo build"));
        assert!(built.ends_with("Explain the error."));
        assert!(
            built.contains("tail-marker"),
            "tail of long excerpt should be preserved after clipping"
        );
    }
}

pub fn default_runtime_client() -> Result<Client, String> {
    Client::builder()
        .connect_timeout(Duration::from_secs(4))
        .timeout(Duration::from_secs(20))
        .pool_idle_timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| format!("failed to configure runtime http client: {error}"))
}
