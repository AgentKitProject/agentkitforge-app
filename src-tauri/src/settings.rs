use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{Manager, Runtime};

use crate::ai_providers::{
    public_provider, validate_provider_config, AiProviderConfig, AiProviderInput, AiProviderType,
    PublicAiProviderConfig,
};

#[derive(Debug, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct StoredSettings {
    openai_api_key: Option<String>,
    default_model: Option<String>,
    ai_providers: Option<Vec<AiProviderConfig>>,
    default_ai_provider_id: Option<String>,
    default_output_folder: Option<String>,
    preferred_validation_profile: Option<String>,
    preferred_context_mode: Option<String>,
    theme: Option<String>,
    include_policies: Option<bool>,
    include_templates: Option<bool>,
    include_workflows: Option<bool>,
    include_references: Option<bool>,
    last_update_check_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPreferencesInput {
    pub default_model: String,
    pub default_output_folder: String,
    pub preferred_validation_profile: String,
    pub preferred_context_mode: String,
    pub theme: String,
    pub include_policies: bool,
    pub include_templates: bool,
    pub include_workflows: bool,
    pub include_references: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicSettings {
    pub has_openai_api_key: bool,
    pub default_model: String,
    pub ai_providers: Vec<PublicAiProviderConfig>,
    pub default_ai_provider_id: Option<String>,
    pub default_output_folder: String,
    pub preferred_validation_profile: String,
    pub preferred_context_mode: String,
    pub theme: String,
    pub include_policies: bool,
    pub include_templates: bool,
    pub include_workflows: bool,
    pub include_references: bool,
    pub last_update_check_at: Option<String>,
    pub settings_path: String,
}

const DEFAULT_MODEL: &str = "gpt-5.4-mini";

pub fn get_public_settings<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PublicSettings, String> {
    let settings = read_settings_with_migration(app)?;
    let path = settings_path(app)?;
    let providers = normalized_providers(&settings);
    let default_provider = default_provider(&providers, settings.default_ai_provider_id.as_deref());

    Ok(PublicSettings {
        has_openai_api_key: providers.iter().any(|provider| {
            provider.provider_type == AiProviderType::Openai
                && provider
                    .api_key
                    .as_ref()
                    .is_some_and(|key| !key.trim().is_empty())
        }),
        default_model: default_provider
            .map(|provider| provider.default_model.clone())
            .or_else(|| settings.default_model.filter(|model| !model.trim().is_empty()))
            .unwrap_or_else(|| DEFAULT_MODEL.to_string()),
        ai_providers: providers.iter().map(public_provider).collect(),
        default_ai_provider_id: default_provider.map(|provider| provider.id.clone()),
        default_output_folder: settings
            .default_output_folder
            .filter(|folder| !folder.trim().is_empty())
            .unwrap_or_else(|| default_library_folder(app).to_string_lossy().into_owned()),
        preferred_validation_profile: settings
            .preferred_validation_profile
            .filter(|profile| !profile.trim().is_empty())
            .unwrap_or_else(|| "local-valid".to_string()),
        preferred_context_mode: settings
            .preferred_context_mode
            .filter(|mode| !mode.trim().is_empty())
            .unwrap_or_else(|| "triggered".to_string()),
        theme: settings
            .theme
            .filter(|theme| !theme.trim().is_empty())
            .unwrap_or_else(|| "light".to_string()),
        include_policies: settings.include_policies.unwrap_or(true),
        include_templates: settings.include_templates.unwrap_or(true),
        include_workflows: settings.include_workflows.unwrap_or(true),
        include_references: settings.include_references.unwrap_or(false),
        last_update_check_at: settings.last_update_check_at,
        settings_path: path.to_string_lossy().into_owned(),
    })
}

pub fn save_openai_api_key<R: Runtime>(
    app: &tauri::AppHandle<R>,
    api_key: String,
) -> Result<PublicSettings, String> {
    let api_key = api_key.trim().to_string();
    if api_key.is_empty() {
        return Err("OpenAI API key is required.".to_string());
    }

    let mut settings = read_settings_with_migration(app)?;
    settings.openai_api_key = Some(api_key.clone());
    let mut providers = normalized_providers(&settings);
    if let Some(provider) = providers
        .iter_mut()
        .find(|provider| provider.provider_type == AiProviderType::Openai)
    {
        provider.api_key = Some(api_key);
        provider.updated_at = now_timestamp();
    } else {
        providers.push(default_openai_provider(Some(api_key), settings.default_model.clone()));
    }
    settings.ai_providers = Some(providers);
    if settings.default_ai_provider_id.is_none() {
        settings.default_ai_provider_id = settings
            .ai_providers
            .as_ref()
            .and_then(|providers| providers.first())
            .map(|provider| provider.id.clone());
    }
    write_settings(app, &settings)?;
    get_public_settings(app)
}

pub fn clear_openai_api_key<R: Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<PublicSettings, String> {
    let mut settings = read_settings_with_migration(app)?;
    settings.openai_api_key = None;
    if let Some(providers) = settings.ai_providers.as_mut() {
        for provider in providers
            .iter_mut()
            .filter(|provider| provider.provider_type == AiProviderType::Openai)
        {
            provider.api_key = None;
            provider.updated_at = now_timestamp();
        }
    }
    write_settings(app, &settings)?;
    get_public_settings(app)
}

pub fn save_default_model<R: Runtime>(
    app: &tauri::AppHandle<R>,
    model: String,
) -> Result<PublicSettings, String> {
    let model = model.trim().to_string();
    if model.is_empty() {
        return Err("Default model is required.".to_string());
    }

    let mut settings = read_settings_with_migration(app)?;
    settings.default_model = Some(model);
    write_settings(app, &settings)?;
    get_public_settings(app)
}

pub fn save_app_preferences<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: AppPreferencesInput,
) -> Result<PublicSettings, String> {
    let default_model = input.default_model.trim().to_string();
    if default_model.is_empty() {
        return Err("Default model is required.".to_string());
    }

    if !["local-valid", "publishable", "trusted", "verified"]
        .contains(&input.preferred_validation_profile.as_str())
    {
        return Err("Preferred validation profile is invalid.".to_string());
    }

    if !["all", "triggered"].contains(&input.preferred_context_mode.as_str()) {
        return Err("Preferred context mode is invalid.".to_string());
    }

    if !["light", "dark"].contains(&input.theme.as_str()) {
        return Err("Theme is invalid.".to_string());
    }

    let mut settings = read_settings_with_migration(app)?;
    settings.default_model = Some(default_model);
    settings.default_output_folder = Some(
        input
            .default_output_folder
            .trim()
            .to_string(),
    );
    settings.preferred_validation_profile = Some(input.preferred_validation_profile);
    settings.preferred_context_mode = Some(input.preferred_context_mode);
    settings.theme = Some(input.theme);
    settings.include_policies = Some(input.include_policies);
    settings.include_templates = Some(input.include_templates);
    settings.include_workflows = Some(input.include_workflows);
    settings.include_references = Some(input.include_references);
    write_settings(app, &settings)?;
    get_public_settings(app)
}

pub fn save_ai_provider<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: AiProviderInput,
) -> Result<PublicSettings, String> {
    let mut settings = read_settings_with_migration(app)?;
    let mut providers = normalized_providers(&settings);
    let now = now_timestamp();
    let id = input
        .id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| provider_id(&input.provider_type, &now));

    let existing = providers.iter().find(|provider| provider.id == id).cloned();
    let api_key = input
        .api_key
        .map(|key| key.trim().to_string())
        .filter(|key| !key.is_empty())
        .or_else(|| existing.as_ref().and_then(|provider| provider.api_key.clone()));

    let provider = AiProviderConfig {
        id: id.clone(),
        name: input.name.trim().to_string(),
        provider_type: input.provider_type,
        base_url: input
            .base_url
            .map(|url| url.trim().to_string())
            .filter(|url| !url.is_empty()),
        api_key,
        default_model: input.default_model.trim().to_string(),
        supports_structured_json: input.supports_structured_json,
        created_at: existing
            .map(|provider| provider.created_at)
            .unwrap_or_else(|| now.clone()),
        updated_at: now,
    };
    validate_provider_config(&provider)?;

    if let Some(index) = providers.iter().position(|current| current.id == id) {
        providers[index] = provider;
    } else {
        providers.push(provider);
    }

    if settings.default_ai_provider_id.is_none() {
        settings.default_ai_provider_id = Some(id);
    }

    settings.ai_providers = Some(providers);
    write_settings(app, &settings)?;
    get_public_settings(app)
}

pub fn remove_ai_provider<R: Runtime>(
    app: &tauri::AppHandle<R>,
    provider_id: String,
) -> Result<PublicSettings, String> {
    let mut settings = read_settings_with_migration(app)?;
    let mut providers = normalized_providers(&settings);
    providers.retain(|provider| provider.id != provider_id);
    if settings.default_ai_provider_id.as_deref() == Some(provider_id.as_str()) {
        settings.default_ai_provider_id = providers.first().map(|provider| provider.id.clone());
    }
    settings.ai_providers = Some(providers);
    write_settings(app, &settings)?;
    get_public_settings(app)
}

pub fn set_default_ai_provider<R: Runtime>(
    app: &tauri::AppHandle<R>,
    provider_id: String,
) -> Result<PublicSettings, String> {
    let mut settings = read_settings_with_migration(app)?;
    let providers = normalized_providers(&settings);
    if !providers.iter().any(|provider| provider.id == provider_id) {
        return Err("Selected AI provider was not found.".to_string());
    }
    settings.default_ai_provider_id = Some(provider_id);
    settings.ai_providers = Some(providers);
    write_settings(app, &settings)?;
    get_public_settings(app)
}

pub fn save_update_check_timestamp<R: Runtime>(
    app: &tauri::AppHandle<R>,
    checked_at: String,
) -> Result<PublicSettings, String> {
    let checked_at = checked_at.trim().to_string();
    if checked_at.is_empty() {
        return Err("Update check timestamp is required.".to_string());
    }

    let mut settings = read_settings_with_migration(app)?;
    settings.last_update_check_at = Some(checked_at);
    write_settings(app, &settings)?;
    get_public_settings(app)
}

pub fn get_ai_provider<R: Runtime>(
    app: &tauri::AppHandle<R>,
    provider_id: Option<&str>,
) -> Result<AiProviderConfig, String> {
    let settings = read_settings_with_migration(app)?;
    let providers = normalized_providers(&settings);
    if providers.is_empty() {
        return Err("Add an AI provider in Settings before using this feature.".to_string());
    }

    if let Some(provider_id) = provider_id.map(str::trim).filter(|value| !value.is_empty()) {
        return providers
            .into_iter()
            .find(|provider| provider.id == provider_id)
            .ok_or_else(|| "Selected AI provider was not found.".to_string());
    }

    default_provider(&providers, settings.default_ai_provider_id.as_deref())
        .cloned()
        .ok_or_else(|| "Select a default AI provider in Settings.".to_string())
}

fn read_settings<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<StoredSettings, String> {
    let path = settings_path(app)?;
    if !path.exists() {
        return Ok(StoredSettings::default());
    }

    let content = fs::read_to_string(&path)
        .map_err(|error| format!("Unable to read local settings file: {error}"))?;

    serde_json::from_str(&content)
        .map_err(|error| format!("Unable to parse local settings file: {error}"))
}

fn read_settings_with_migration<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<StoredSettings, String> {
    let mut settings = read_settings(app)?;
    let providers = normalized_providers(&settings);
    if settings.ai_providers.is_none() || settings.default_ai_provider_id.is_none() {
        settings.ai_providers = Some(providers);
        if settings.default_ai_provider_id.is_none() {
            settings.default_ai_provider_id = settings
                .ai_providers
                .as_ref()
                .and_then(|providers| providers.first())
                .map(|provider| provider.id.clone());
        }
        write_settings(app, &settings)?;
    }
    Ok(settings)
}

fn write_settings<R: Runtime>(
    app: &tauri::AppHandle<R>,
    settings: &StoredSettings,
) -> Result<(), String> {
    let path = settings_path(app)?;
    let parent = path
        .parent()
        .ok_or_else(|| "Unable to resolve local settings folder.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Unable to create local settings folder: {error}"))?;

    let content = serde_json::to_string_pretty(settings)
        .map_err(|error| format!("Unable to serialize local settings: {error}"))?;

    fs::write(path, content).map_err(|error| format!("Unable to save local settings: {error}"))
}

fn settings_path<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|path| path.join("settings.json"))
        .map_err(|error| format!("Unable to resolve local settings folder: {error}"))
}

fn default_library_folder<R: Runtime>(app: &tauri::AppHandle<R>) -> PathBuf {
    let path = app.path()
        .document_dir()
        .map(|path| path.join("AgentKitForge").join("Kits"))
        .or_else(|_| app.path().app_local_data_dir().map(|path| path.join("Kits")))
        .unwrap_or_else(|_| PathBuf::from("AgentKitForge").join("Kits"));
    let _ = fs::create_dir_all(&path);
    path
}

fn normalized_providers(settings: &StoredSettings) -> Vec<AiProviderConfig> {
    let mut providers = settings.ai_providers.clone().unwrap_or_default();
    if providers.is_empty() || settings.openai_api_key.as_ref().is_some_and(|key| !key.trim().is_empty()) {
        let api_key = settings
            .openai_api_key
            .as_ref()
            .map(|key| key.trim().to_string())
            .filter(|key| !key.is_empty());
        if let Some(existing) = providers
            .iter_mut()
            .find(|provider| provider.provider_type == AiProviderType::Openai)
        {
            if existing.api_key.as_ref().is_none_or(|key| key.trim().is_empty()) {
                existing.api_key = api_key;
            }
        } else {
            providers.push(default_openai_provider(api_key, settings.default_model.clone()));
        }
    }
    providers
}

fn default_provider<'a>(
    providers: &'a [AiProviderConfig],
    default_id: Option<&str>,
) -> Option<&'a AiProviderConfig> {
    default_id
        .and_then(|id| providers.iter().find(|provider| provider.id == id))
        .or_else(|| providers.first())
}

fn default_openai_provider(api_key: Option<String>, default_model: Option<String>) -> AiProviderConfig {
    let now = now_timestamp();
    AiProviderConfig {
        id: "openai-default".to_string(),
        name: "OpenAI".to_string(),
        provider_type: AiProviderType::Openai,
        base_url: Some("https://api.openai.com/v1".to_string()),
        api_key,
        default_model: default_model
            .filter(|model| !model.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_MODEL.to_string()),
        supports_structured_json: true,
        created_at: now.clone(),
        updated_at: now,
    }
}

fn provider_id(provider_type: &AiProviderType, timestamp: &str) -> String {
    let prefix = match provider_type {
        AiProviderType::Openai => "openai",
        AiProviderType::Anthropic => "anthropic",
        AiProviderType::Gemini => "gemini",
        AiProviderType::Ollama => "ollama",
        AiProviderType::OpenaiCompatible => "openai-compatible",
    };
    format!("{prefix}-{timestamp}")
}

fn now_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}
