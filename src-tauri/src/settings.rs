use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{Manager, Runtime};

#[derive(Debug, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct StoredSettings {
    openai_api_key: Option<String>,
    default_model: Option<String>,
    default_output_folder: Option<String>,
    preferred_validation_profile: Option<String>,
    preferred_context_mode: Option<String>,
    include_policies: Option<bool>,
    include_templates: Option<bool>,
    include_workflows: Option<bool>,
    include_references: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPreferencesInput {
    pub default_model: String,
    pub default_output_folder: String,
    pub preferred_validation_profile: String,
    pub preferred_context_mode: String,
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
    pub default_output_folder: String,
    pub preferred_validation_profile: String,
    pub preferred_context_mode: String,
    pub include_policies: bool,
    pub include_templates: bool,
    pub include_workflows: bool,
    pub include_references: bool,
    pub settings_path: String,
}

const DEFAULT_MODEL: &str = "gpt-5-mini";

pub fn get_public_settings<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PublicSettings, String> {
    let settings = read_settings(app)?;
    let path = settings_path(app)?;

    Ok(PublicSettings {
        has_openai_api_key: settings
            .openai_api_key
            .as_ref()
            .is_some_and(|key| !key.trim().is_empty()),
        default_model: settings
            .default_model
            .filter(|model| !model.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_MODEL.to_string()),
        default_output_folder: settings.default_output_folder.unwrap_or_default(),
        preferred_validation_profile: settings
            .preferred_validation_profile
            .filter(|profile| !profile.trim().is_empty())
            .unwrap_or_else(|| "local-valid".to_string()),
        preferred_context_mode: settings
            .preferred_context_mode
            .filter(|mode| !mode.trim().is_empty())
            .unwrap_or_else(|| "triggered".to_string()),
        include_policies: settings.include_policies.unwrap_or(true),
        include_templates: settings.include_templates.unwrap_or(true),
        include_workflows: settings.include_workflows.unwrap_or(true),
        include_references: settings.include_references.unwrap_or(false),
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

    let mut settings = read_settings(app)?;
    settings.openai_api_key = Some(api_key);
    write_settings(app, &settings)?;
    get_public_settings(app)
}

pub fn clear_openai_api_key<R: Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<PublicSettings, String> {
    let mut settings = read_settings(app)?;
    settings.openai_api_key = None;
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

    let mut settings = read_settings(app)?;
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

    let mut settings = read_settings(app)?;
    settings.default_model = Some(default_model);
    settings.default_output_folder = Some(input.default_output_folder.trim().to_string());
    settings.preferred_validation_profile = Some(input.preferred_validation_profile);
    settings.preferred_context_mode = Some(input.preferred_context_mode);
    settings.include_policies = Some(input.include_policies);
    settings.include_templates = Some(input.include_templates);
    settings.include_workflows = Some(input.include_workflows);
    settings.include_references = Some(input.include_references);
    write_settings(app, &settings)?;
    get_public_settings(app)
}

pub fn get_openai_api_key<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<String, String> {
    let settings = read_settings(app)?;
    let api_key = settings
        .openai_api_key
        .unwrap_or_default()
        .trim()
        .to_string();

    if api_key.is_empty() {
        return Err("Add an OpenAI API key in Settings before using Forge runtime.".to_string());
    }

    Ok(api_key)
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
