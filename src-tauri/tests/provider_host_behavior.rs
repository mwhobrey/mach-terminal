use mach_terminal_lib::models::{AiExecuteRequest, AppSettings};
use mach_terminal_lib::provider_host::{default_runtime_client, execute_ai_request};

fn request() -> AiExecuteRequest {
    AiExecuteRequest {
        session_id: "session-test".to_string(),
        prompt: "explain ls -la".to_string(),
        provider_id: None,
    }
}

fn settings_with_ollama_enabled() -> AppSettings {
    let mut settings = AppSettings::default();
    settings.provider_routing.ai_feature_enabled = true;
    settings.provider_routing.default_provider = "ollama".to_string();
    for provider in &mut settings.providers {
        if provider.id == "ollama" {
            provider.enabled = true;
        }
    }
    settings
}

#[tokio::test]
async fn rejects_when_ai_routing_opt_in_is_disabled() {
    let client = default_runtime_client().expect("runtime client");
    let settings = AppSettings::default();
    let error = execute_ai_request(&client, &settings, &request())
        .await
        .expect_err("routing opt-in gate should reject");
    assert!(error.contains("AI routing is disabled"));
}

#[tokio::test]
async fn rejects_when_provider_is_disabled() {
    let client = default_runtime_client().expect("runtime client");
    let mut settings = AppSettings::default();
    settings.provider_routing.ai_feature_enabled = true;
    settings.provider_routing.default_provider = "openai".to_string();
    let error = execute_ai_request(&client, &settings, &request())
        .await
        .expect_err("disabled provider should reject");
    assert!(error.contains("disabled"));
}

#[tokio::test]
async fn rejects_when_default_provider_is_not_configured() {
    let client = default_runtime_client().expect("runtime client");
    let mut settings = AppSettings::default();
    settings.provider_routing.ai_feature_enabled = true;
    settings.provider_routing.default_provider = "missing-provider".to_string();
    let error = execute_ai_request(&client, &settings, &request())
        .await
        .expect_err("missing provider should reject");
    assert!(error.contains("not configured"));
}

#[tokio::test]
async fn rejects_configured_provider_without_adapter() {
    let client = default_runtime_client().expect("runtime client");
    let mut settings = AppSettings::default();
    settings.provider_routing.ai_feature_enabled = true;
    settings.provider_routing.default_provider = "openai".to_string();
    for provider in &mut settings.providers {
        if provider.id == "openai" {
            provider.enabled = true;
        }
    }
    let error = execute_ai_request(&client, &settings, &request())
        .await
        .expect_err("unimplemented adapter should reject");
    assert!(error.contains("no execution adapter"));
}

#[tokio::test]
async fn rejects_invalid_ollama_endpoint_scheme() {
    let client = default_runtime_client().expect("runtime client");
    let mut settings = settings_with_ollama_enabled();
    for provider in &mut settings.providers {
        if provider.id == "ollama" {
            provider.endpoint = Some("ftp://localhost:11434".to_string());
        }
    }

    let error = execute_ai_request(&client, &settings, &request())
        .await
        .expect_err("invalid endpoint should reject");
    assert!(error.contains("unsupported scheme"));
}

#[tokio::test]
async fn surfaces_unreachable_ollama_endpoint_failures() {
    let client = default_runtime_client().expect("runtime client");
    let mut settings = settings_with_ollama_enabled();
    for provider in &mut settings.providers {
        if provider.id == "ollama" {
            provider.endpoint = Some("http://127.0.0.1:1".to_string());
        }
    }

    let error = execute_ai_request(&client, &settings, &request())
        .await
        .expect_err("unreachable endpoint should reject");
    assert!(error.contains("unreachable"));
}
