use crate::models::{
    AiExecuteRequest, AiExecuteResponse, AppSettings, ProviderDescriptor, ProviderRoutingSettings,
    ProviderSettings,
};
use crate::provider_secrets;
use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use std::env;
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

#[derive(Debug, Serialize)]
struct OpenAiCompatibleChatRequest {
    model: String,
    messages: Vec<OpenAiCompatibleMessage>,
    stream: bool,
}

#[derive(Debug, Serialize)]
struct OpenAiCompatibleMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct OpenAiCompatibleChatResponse {
    choices: Vec<OpenAiCompatibleChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAiCompatibleChoice {
    message: OpenAiCompatibleChoiceMessage,
}

#[derive(Debug, Deserialize)]
struct OpenAiCompatibleChoiceMessage {
    content: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct AnthropicMessagesRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<AnthropicInputMessage>,
}

#[derive(Debug, Serialize)]
struct AnthropicInputMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicMessagesResponse {
    content: Vec<AnthropicContentBlock>,
}

#[derive(Debug, Deserialize)]
struct AnthropicContentBlock {
    #[serde(rename = "type")]
    kind: String,
    text: Option<String>,
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
            env_hint: provider.api_key_env.clone(),
            status: if provider.enabled {
                "available".to_string()
            } else {
                "disabled".to_string()
            },
            has_stored_key: false,
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
    ProviderAuthMissing(String),
    ProviderSecretUnavailable(String),
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
            AiExecutionError::ProviderAuthMissing(provider_id) => write!(
                f,
                "Provider `{provider_id}` is missing credentials. Set an API key in settings or configure its environment variable."
            ),
            AiExecutionError::ProviderSecretUnavailable(message) => {
                write!(f, "Secure provider key storage is unavailable. {message}")
            }
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

fn normalize_http_base_url(
    endpoint: Option<&str>,
    default_endpoint: Option<&str>,
) -> Result<Url, AiExecutionError> {
    let raw = endpoint
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .or(default_endpoint)
        .ok_or_else(|| AiExecutionError::InvalidEndpoint("endpoint is required".to_string()))?;
    let parsed = Url::parse(raw)
        .map_err(|error| AiExecutionError::InvalidEndpoint(format!("`{raw}` ({error})")))?;
    match parsed.scheme() {
        "http" | "https" => Ok(parsed),
        scheme => Err(AiExecutionError::InvalidEndpoint(format!(
            "`{raw}` uses unsupported scheme `{scheme}` (expected http or https)"
        ))),
    }
}

fn normalize_ollama_base_url(provider: &ProviderSettings) -> Result<Url, AiExecutionError> {
    normalize_http_base_url(provider.endpoint.as_deref(), Some("http://127.0.0.1:11434"))
}

fn provider_join_endpoint(base_url: Url, suffix: &str) -> Result<Url, AiExecutionError> {
    let base = base_url.as_str().trim_end_matches('/');
    let suffix = suffix.trim_start_matches('/');
    let endpoint = if base.ends_with(suffix) {
        base.to_string()
    } else if base.ends_with("/v1") && suffix.starts_with("v1/") {
        format!("{base}/{}", suffix.trim_start_matches("v1/"))
    } else if base.ends_with("/v1/") && suffix.starts_with("v1/") {
        format!("{}{}", base.trim_end_matches('/'), &suffix[2..])
    } else {
        format!("{base}/{suffix}")
    };
    Url::parse(&endpoint).map_err(|error| {
        AiExecutionError::InvalidEndpoint(format!("failed to construct provider endpoint `{endpoint}` ({error})"))
    })
}

fn normalize_openai_chat_url(provider: &ProviderSettings) -> Result<Url, AiExecutionError> {
    let default_endpoint = if provider.id == "custom-openai" {
        None
    } else {
        Some("https://api.openai.com")
    };
    let base_url = normalize_http_base_url(provider.endpoint.as_deref(), default_endpoint)?;
    provider_join_endpoint(base_url, "v1/chat/completions")
}

fn normalize_anthropic_messages_url(provider: &ProviderSettings) -> Result<Url, AiExecutionError> {
    let base_url = normalize_http_base_url(provider.endpoint.as_deref(), Some("https://api.anthropic.com"))?;
    provider_join_endpoint(base_url, "v1/messages")
}

fn resolve_provider_api_key(provider: &ProviderSettings) -> Result<String, AiExecutionError> {
    if let Some(secret) = provider_secrets::provider_api_key(&provider.id)
        .map_err(|error| AiExecutionError::ProviderSecretUnavailable(error.to_string()))?
        .filter(|value| !value.trim().is_empty())
    {
        return Ok(secret);
    }

    if let Some(env_key_name) = provider
        .api_key_env
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if let Some(value) = env::var(env_key_name).ok().filter(|value| !value.trim().is_empty()) {
            return Ok(value);
        }
    }

    Err(AiExecutionError::ProviderAuthMissing(provider.id.clone()))
}

fn parse_openai_message_content(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(text) => Some(text.trim().to_string()),
        serde_json::Value::Array(parts) => {
            let mut out: Vec<String> = Vec::new();
            for part in parts {
                if let Some(text) = part
                    .get("text")
                    .and_then(serde_json::Value::as_str)
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                {
                    out.push(text.to_string());
                }
            }
            if out.is_empty() {
                None
            } else {
                Some(out.join("\n"))
            }
        }
        _ => None,
    }
}

fn parse_anthropic_text(blocks: &[AnthropicContentBlock]) -> Option<String> {
    let text: Vec<String> = blocks
        .iter()
        .filter(|block| block.kind == "text")
        .filter_map(|block| block.text.as_deref())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect();
    if text.is_empty() {
        None
    } else {
        Some(text.join("\n"))
    }
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

fn routing_model_for_provider(provider_id: &str, routing: &ProviderRoutingSettings) -> String {
    match provider_id {
        "openai" => routing.openai_model.clone(),
        "anthropic" => routing.anthropic_model.clone(),
        "custom-openai" => routing.custom_openai_model.clone(),
        _ => routing.ollama_model.clone(),
    }
}

#[instrument(skip(client, provider, routing, prompt))]
async fn run_openai_compatible(
    client: &Client,
    provider: &ProviderSettings,
    routing: &ProviderRoutingSettings,
    prompt: &str,
) -> Result<String, String> {
    let endpoint = normalize_openai_chat_url(provider).map_err(|error| error.to_string())?;
    let api_key = resolve_provider_api_key(provider).map_err(|error| error.to_string())?;
    let request = OpenAiCompatibleChatRequest {
        model: routing_model_for_provider(provider.id.as_str(), routing),
        messages: vec![OpenAiCompatibleMessage {
            role: "user".to_string(),
            content: prompt.to_string(),
        }],
        stream: false,
    };
    let response = client
        .post(endpoint)
        .bearer_auth(api_key)
        .json(&request)
        .send()
        .await
        .map_err(|error| {
            if error.is_connect() || error.is_timeout() {
                AiExecutionError::EndpointUnreachable(error.to_string()).to_string()
            } else {
                AiExecutionError::UpstreamStatus(error.to_string()).to_string()
            }
        })?
        .error_for_status()
        .map_err(|error| AiExecutionError::UpstreamStatus(error.to_string()).to_string())?;

    let payload = response
        .json::<OpenAiCompatibleChatResponse>()
        .await
        .map_err(|error| AiExecutionError::DecodeFailure(error.to_string()).to_string())?;
    payload
        .choices
        .first()
        .and_then(|choice| parse_openai_message_content(&choice.message.content))
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AiExecutionError::DecodeFailure("missing response text in provider payload".to_string()).to_string())
}

#[instrument(skip(client, provider, routing, prompt))]
async fn run_anthropic(
    client: &Client,
    provider: &ProviderSettings,
    routing: &ProviderRoutingSettings,
    prompt: &str,
) -> Result<String, String> {
    let endpoint = normalize_anthropic_messages_url(provider).map_err(|error| error.to_string())?;
    let api_key = resolve_provider_api_key(provider).map_err(|error| error.to_string())?;
    let request = AnthropicMessagesRequest {
        model: routing_model_for_provider("anthropic", routing),
        max_tokens: 1024,
        messages: vec![AnthropicInputMessage {
            role: "user".to_string(),
            content: prompt.to_string(),
        }],
    };
    let response = client
        .post(endpoint)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&request)
        .send()
        .await
        .map_err(|error| {
            if error.is_connect() || error.is_timeout() {
                AiExecutionError::EndpointUnreachable(error.to_string()).to_string()
            } else {
                AiExecutionError::UpstreamStatus(error.to_string()).to_string()
            }
        })?
        .error_for_status()
        .map_err(|error| AiExecutionError::UpstreamStatus(error.to_string()).to_string())?;

    let payload = response
        .json::<AnthropicMessagesResponse>()
        .await
        .map_err(|error| AiExecutionError::DecodeFailure(error.to_string()).to_string())?;
    parse_anthropic_text(&payload.content)
        .ok_or_else(|| AiExecutionError::DecodeFailure("missing text blocks in provider payload".to_string()).to_string())
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
        "openai" | "custom-openai" => {
            run_openai_compatible(client, &provider, &settings.provider_routing, &prompt).await?
        }
        "anthropic" => run_anthropic(client, &provider, &settings.provider_routing, &prompt).await?,
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
    use crate::models::{AiExecuteRequest, AiPromptContext, ProviderRoutingSettings};
    use crate::provider_host::{
        assemble_prompt, parse_anthropic_text, parse_openai_message_content, routing_model_for_provider,
        AnthropicContentBlock,
    };
    use serde_json::json;

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

    #[test]
    fn parses_openai_text_content_from_string_and_array() {
        let string_payload = json!("single response");
        let array_payload = json!([
            { "type": "text", "text": "line one" },
            { "type": "text", "text": "line two" }
        ]);
        assert_eq!(
            parse_openai_message_content(&string_payload).as_deref(),
            Some("single response")
        );
        assert_eq!(
            parse_openai_message_content(&array_payload).as_deref(),
            Some("line one\nline two")
        );
    }

    #[test]
    fn parses_anthropic_text_blocks_only() {
        let blocks = vec![
            AnthropicContentBlock {
                kind: "text".to_string(),
                text: Some("first".to_string()),
            },
            AnthropicContentBlock {
                kind: "tool_use".to_string(),
                text: None,
            },
            AnthropicContentBlock {
                kind: "text".to_string(),
                text: Some("second".to_string()),
            },
        ];
        assert_eq!(parse_anthropic_text(&blocks).as_deref(), Some("first\nsecond"));
    }

    #[test]
    fn resolves_routing_model_by_provider() {
        let routing = ProviderRoutingSettings {
            default_provider: "openai".to_string(),
            ollama_model: "llama3.2".to_string(),
            openai_model: "gpt-4o-mini".to_string(),
            anthropic_model: "claude-3-5-haiku-latest".to_string(),
            custom_openai_model: "qwen2.5-coder".to_string(),
            ai_feature_enabled: true,
        };
        assert_eq!(routing_model_for_provider("openai", &routing), "gpt-4o-mini");
        assert_eq!(
            routing_model_for_provider("anthropic", &routing),
            "claude-3-5-haiku-latest"
        );
        assert_eq!(
            routing_model_for_provider("custom-openai", &routing),
            "qwen2.5-coder"
        );
        assert_eq!(routing_model_for_provider("ollama", &routing), "llama3.2");
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
