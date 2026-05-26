use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};
use tauri::{Manager, Runtime};

mod openai_runtime;
mod settings;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum ValidationProfile {
    LocalValid,
    Publishable,
    Trusted,
    Verified,
}

impl ValidationProfile {
    fn as_str(&self) -> &'static str {
        match self {
            Self::LocalValid => "local-valid",
            Self::Publishable => "publishable",
            Self::Trusted => "trusted",
            Self::Verified => "verified",
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum AgentKitTemplate {
    Blank,
    FinancialReview,
}

impl AgentKitTemplate {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Blank => "blank",
            Self::FinancialReview => "financial-review",
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateAgentKitFromTemplateInput {
    output_folder: String,
    id: String,
    name: String,
    description: String,
    template: AgentKitTemplate,
    force: bool,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CreateAgentKitResult {
    root_path: String,
    template: String,
    files: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportAgentKitOneFileInput {
    root_path: String,
    output_path: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportAgentKitOneFileResult {
    file_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RenderAgentKitDraftInput {
    draft_file_path: String,
    output_folder: String,
    force: bool,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RenderAgentKitDraftResult {
    root_path: String,
    files: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize)]
struct ValidationIssue {
    severity: String,
    code: String,
    message: String,
    path: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ValidationReport {
    valid: bool,
    profile: String,
    root_path: String,
    issues: Vec<ValidationIssue>,
}

#[tauri::command]
fn select_agent_kit_folder() -> Result<Option<String>, String> {
    let folder = rfd::FileDialog::new()
        .set_title("Select Agent Kit Folder")
        .pick_folder();

    Ok(folder.map(|path| path.to_string_lossy().into_owned()))
}

#[tauri::command]
fn select_onefile_output_path() -> Result<Option<String>, String> {
    let file = rfd::FileDialog::new()
        .set_title("Export Agent Kit Markdown")
        .add_filter("Markdown", &["md"])
        .set_file_name("agent-kit.md")
        .save_file();

    Ok(file.map(|path| path.to_string_lossy().into_owned()))
}

#[tauri::command]
fn select_json_file() -> Result<Option<String>, String> {
    let file = rfd::FileDialog::new()
        .set_title("Select AgentKitDraft JSON")
        .add_filter("JSON", &["json"])
        .pick_file();

    Ok(file.map(|path| path.to_string_lossy().into_owned()))
}

#[tauri::command]
fn validate_agent_kit<R: Runtime>(
    app: tauri::AppHandle<R>,
    root_path: String,
    profile: ValidationProfile,
) -> Result<ValidationReport, String> {
    let root_path = canonicalize_directory(&root_path)?;
    let bridge_script = resolve_validation_bridge(&app)?;
    let node_command = resolve_node_command()?;

    let output = Command::new(node_command)
        .arg(&bridge_script)
        .arg(&root_path)
        .arg(profile.as_str())
        .current_dir(resolve_command_working_directory(&app))
        .output()
        .map_err(|error| format!("Unable to run agentkitforge-core validation: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if stderr.is_empty() { stdout } else { stderr };
        return Err(if detail.is_empty() {
            "agentkitforge-core validation failed without output".to_string()
        } else {
            detail
        });
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Unable to parse validation report: {error}"))
}

#[tauri::command]
fn create_agent_kit_from_template<R: Runtime>(
    app: tauri::AppHandle<R>,
    input: CreateAgentKitFromTemplateInput,
) -> Result<CreateAgentKitResult, String> {
    let output_folder = canonicalize_directory(&input.output_folder)?;
    let id = clean_required_value("Kit id", &input.id)?;
    let name = clean_required_value("Kit name", &input.name)?;
    let description = clean_required_value("Kit description", &input.description)?;
    validate_kit_id(&id)?;

    let target_path = output_folder.join(&id);
    if !target_path.starts_with(&output_folder) {
        return Err("Kit id must stay inside the selected output folder.".to_string());
    }

    let bridge_script = resolve_create_bridge(&app)?;
    let node_command = resolve_node_command()?;

    let output = Command::new(node_command)
        .arg(&bridge_script)
        .arg(&target_path)
        .arg(input.template.as_str())
        .arg(&id)
        .arg(&name)
        .arg(&description)
        .arg(if input.force { "true" } else { "false" })
        .current_dir(resolve_command_working_directory(&app))
        .output()
        .map_err(|error| format!("Unable to run agentkitforge-core scaffolding: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if stderr.is_empty() { stdout } else { stderr };
        return Err(if detail.is_empty() {
            "agentkitforge-core scaffolding failed without output".to_string()
        } else {
            detail
        });
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Unable to parse create result: {error}"))
}

#[tauri::command]
fn export_agent_kit_onefile<R: Runtime>(
    app: tauri::AppHandle<R>,
    input: ExportAgentKitOneFileInput,
) -> Result<ExportAgentKitOneFileResult, String> {
    let root_path = canonicalize_directory(&input.root_path)?;
    let output_path = resolve_markdown_output_path(&root_path, &input.output_path)?;
    let bridge_script = resolve_export_bridge(&app)?;
    let node_command = resolve_node_command()?;

    let output = Command::new(node_command)
        .arg(&bridge_script)
        .arg(&root_path)
        .arg(&output_path)
        .current_dir(resolve_command_working_directory(&app))
        .output()
        .map_err(|error| format!("Unable to run agentkitforge-core one-file export: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if stderr.is_empty() { stdout } else { stderr };
        return Err(if detail.is_empty() {
            "agentkitforge-core one-file export failed without output".to_string()
        } else {
            detail
        });
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Unable to parse export result: {error}"))
}

#[tauri::command]
fn render_agent_kit_draft<R: Runtime>(
    app: tauri::AppHandle<R>,
    input: RenderAgentKitDraftInput,
) -> Result<RenderAgentKitDraftResult, String> {
    let draft_file_path = canonicalize_json_file(&input.draft_file_path)?;
    let output_folder = canonicalize_directory(&input.output_folder)?;
    let bridge_script = resolve_render_draft_bridge(&app)?;
    let node_command = resolve_node_command()?;

    let output = Command::new(node_command)
        .arg(&bridge_script)
        .arg(&draft_file_path)
        .arg(&output_folder)
        .arg(if input.force { "true" } else { "false" })
        .current_dir(resolve_command_working_directory(&app))
        .output()
        .map_err(|error| format!("Unable to run agentkitforge-core draft render: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if stderr.is_empty() { stdout } else { stderr };
        return Err(if detail.is_empty() {
            "agentkitforge-core draft render failed without output".to_string()
        } else {
            detail
        });
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Unable to parse draft render result: {error}"))
}

#[tauri::command]
fn get_app_settings<R: Runtime>(app: tauri::AppHandle<R>) -> Result<settings::PublicSettings, String> {
    settings::get_public_settings(&app)
}

#[tauri::command]
fn save_openai_api_key<R: Runtime>(
    app: tauri::AppHandle<R>,
    api_key: String,
) -> Result<settings::PublicSettings, String> {
    settings::save_openai_api_key(&app, api_key)
}

#[tauri::command]
fn clear_openai_api_key<R: Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<settings::PublicSettings, String> {
    settings::clear_openai_api_key(&app)
}

#[tauri::command]
fn save_default_model<R: Runtime>(
    app: tauri::AppHandle<R>,
    model: String,
) -> Result<settings::PublicSettings, String> {
    settings::save_default_model(&app, model)
}

#[tauri::command]
async fn run_agent_kit_with_openai<R: Runtime>(
    app: tauri::AppHandle<R>,
    input: openai_runtime::RunAgentKitInput,
) -> Result<openai_runtime::RunAgentKitResult, String> {
    let api_key = settings::get_openai_api_key(&app)?;
    openai_runtime::run_agent_kit_with_openai(api_key, input).await
}

fn canonicalize_directory(root_path: &str) -> Result<PathBuf, String> {
    let trimmed = root_path.trim();
    if trimmed.is_empty() {
        return Err("Select an Agent Kit folder before validating.".to_string());
    }

    let resolved = Path::new(trimmed)
        .canonicalize()
        .map_err(|error| format!("Unable to access selected folder: {error}"))?;

    if !resolved.is_dir() {
        return Err("Selected path is not a folder.".to_string());
    }

    Ok(resolved)
}

fn canonicalize_json_file(file_path: &str) -> Result<PathBuf, String> {
    let trimmed = file_path.trim();
    if trimmed.is_empty() {
        return Err("Select an AgentKitDraft JSON file before rendering.".to_string());
    }

    let resolved = Path::new(trimmed)
        .canonicalize()
        .map_err(|error| format!("Unable to access selected draft file: {error}"))?;

    if !resolved.is_file() {
        return Err("Selected draft path is not a file.".to_string());
    }

    if resolved.extension().and_then(|value| value.to_str()) != Some("json") {
        return Err("Selected draft file must be a .json file.".to_string());
    }

    Ok(resolved)
}


fn resolve_validation_bridge<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    resolve_backend_script(app, "validate-agent-kit.mjs")
}

fn resolve_create_bridge<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    resolve_backend_script(app, "create-agent-kit.mjs")
}

fn resolve_export_bridge<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    resolve_backend_script(app, "export-agent-kit-onefile.mjs")
}

fn resolve_render_draft_bridge<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    resolve_backend_script(app, "render-agent-kit-draft.mjs")
}

fn resolve_backend_script<R: Runtime>(
    app: &tauri::AppHandle<R>,
    script_name: &str,
) -> Result<PathBuf, String> {
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("backend")
        .join(script_name);
    if dev_path.exists() {
        return Ok(dev_path);
    }

    app.path()
        .resolve(
            format!("backend/{script_name}"),
            tauri::path::BaseDirectory::Resource,
        )
        .map_err(|error| format!("Unable to locate backend bridge: {error}"))
}

fn resolve_node_command() -> Result<String, String> {
    if let Ok(node_path) = std::env::var("AGENTKITFORGE_NODE") {
        if !node_path.trim().is_empty() {
            return Ok(node_path);
        }
    }

    Ok("node".to_string())
}

fn resolve_command_working_directory<R: Runtime>(app: &tauri::AppHandle<R>) -> PathBuf {
    let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
    if repo_root.exists() {
        return repo_root;
    }

    app.path()
        .app_local_data_dir()
        .or_else(|_| std::env::current_dir())
        .unwrap_or_else(|_| PathBuf::from("."))
}

fn clean_required_value(label: &str, value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(format!("{label} is required."));
    }

    Ok(trimmed.to_string())
}

fn validate_kit_id(id: &str) -> Result<(), String> {
    if id.contains('/') || id.contains('\\') || id == "." || id == ".." || id.contains("..") {
        return Err(
            "Kit id can contain letters, numbers, dashes, and underscores only.".to_string(),
        );
    }

    if !id
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '_')
    {
        return Err(
            "Kit id can contain letters, numbers, dashes, and underscores only.".to_string(),
        );
    }

    Ok(())
}

fn resolve_markdown_output_path(root_path: &Path, output_path: &str) -> Result<PathBuf, String> {
    let trimmed = output_path.trim();
    if trimmed.is_empty() {
        return Err("Select an output file path or output folder before exporting.".to_string());
    }

    let candidate = PathBuf::from(trimmed);

    if candidate.exists() {
        let metadata = fs::metadata(&candidate)
            .map_err(|error| format!("Unable to inspect output path: {error}"))?;
        if metadata.is_dir() {
            return Ok(candidate
                .canonicalize()
                .map_err(|error| format!("Unable to access output folder: {error}"))?
                .join(default_markdown_file_name(root_path)));
        }
    }

    let mut file_path = candidate;
    if file_path.extension().is_none() {
        file_path.set_extension("md");
    }

    let parent = file_path
        .parent()
        .ok_or_else(|| "Output file must have a parent folder.".to_string())?;

    let canonical_parent = parent
        .canonicalize()
        .map_err(|error| format!("Unable to access output folder: {error}"))?;

    if !canonical_parent.is_dir() {
        return Err("Output parent path is not a folder.".to_string());
    }

    let file_name = file_path
        .file_name()
        .ok_or_else(|| "Output file path must include a file name.".to_string())?;

    Ok(canonical_parent.join(file_name))
}

fn default_markdown_file_name(root_path: &Path) -> String {
    let stem = root_path
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.trim().is_empty())
        .unwrap_or("agent-kit");

    format!("{stem}.md")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            select_agent_kit_folder,
            select_onefile_output_path,
            select_json_file,
            validate_agent_kit,
            create_agent_kit_from_template,
            export_agent_kit_onefile,
            render_agent_kit_draft,
            get_app_settings,
            save_openai_api_key,
            clear_openai_api_key,
            save_default_model,
            run_agent_kit_with_openai
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
