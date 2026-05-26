use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File},
    io,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{Manager, Runtime};
use zip::ZipArchive;

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
struct PackageAgentKitInput {
    root_path: String,
    output_folder: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PackageAgentKitResult {
    artifact_path: String,
    artifact_type: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum KitLibrarySource {
    Built,
    Imported,
    Manual,
    Unknown,
}

impl KitLibrarySource {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Built => "built",
            Self::Imported => "imported",
            Self::Manual => "manual",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AddKitToLibraryInput {
    path: String,
    source: KitLibrarySource,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct MyKitEntry {
    id: String,
    name: String,
    version: String,
    description: Option<String>,
    path: String,
    source: String,
    last_validated_at: Option<String>,
    last_validated_profile: Option<String>,
    last_validation_valid: Option<bool>,
    last_used_at: Option<String>,
    created_at: String,
    updated_at: String,
    path_exists: bool,
}

#[derive(Debug, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct MyKitsLibrary {
    kits: Vec<MyKitEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImportAgentKitPackageInput {
    package_path: String,
    destination_root_folder: String,
    force: bool,
    validation_profile: Option<ValidationProfile>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportAgentKitPackageResult {
    extracted_path: String,
    validation_report: ValidationReport,
    metadata: MyKitEntry,
    files: Vec<String>,
}

struct KitMetadata {
    id: String,
    name: String,
    version: String,
    description: Option<String>,
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GenerateAgentKitDraftInput {
    user_request: String,
    target_users: Option<String>,
    domain: Option<String>,
    desired_validation_level: ValidationProfile,
    constraints: Option<String>,
    source_notes: Option<String>,
    model: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct GenerateAgentKitDraftResult {
    draft_json: serde_json::Value,
    draft_json_pretty: String,
    warnings: Vec<String>,
    model: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveAgentKitDraftJsonInput {
    draft_json: serde_json::Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RenderGeneratedAgentKitDraftInput {
    draft_json: serde_json::Value,
    output_folder: String,
    force: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveAgentKitDraftJsonResult {
    file_path: String,
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
fn select_json_output_path() -> Result<Option<String>, String> {
    let file = rfd::FileDialog::new()
        .set_title("Save AgentKitDraft JSON")
        .add_filter("JSON", &["json"])
        .set_file_name("agent-kit-draft.json")
        .save_file();

    Ok(file.map(|path| path.to_string_lossy().into_owned()))
}

#[tauri::command]
fn select_agent_kit_package_file() -> Result<Option<String>, String> {
    let file = rfd::FileDialog::new()
        .set_title("Select Agent Kit Package")
        .add_filter("Agent Kit Package", &["zip"])
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
    let output_folder = resolve_target_directory(&input.output_folder)?;
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
fn package_agent_kit<R: Runtime>(
    app: tauri::AppHandle<R>,
    input: PackageAgentKitInput,
) -> Result<PackageAgentKitResult, String> {
    let root_path = canonicalize_directory(&input.root_path)?;
    let output_folder = canonicalize_directory(&input.output_folder)?;
    let out_file = output_folder.join(format!("{}.agentkit.zip", default_artifact_stem(&root_path)));
    let bridge_script = resolve_package_bridge(&app)?;
    let node_command = resolve_node_command()?;

    let output = Command::new(node_command)
        .arg(&bridge_script)
        .arg(&root_path)
        .arg(&out_file)
        .current_dir(resolve_command_working_directory(&app))
        .output()
        .map_err(|error| format!("Unable to run agentkitforge-core package export: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if stderr.is_empty() { stdout } else { stderr };
        return Err(if detail.is_empty() {
            "agentkitforge-core package export failed without output".to_string()
        } else {
            detail
        });
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Unable to parse package result: {error}"))
}

#[tauri::command]
fn render_agent_kit_draft<R: Runtime>(
    app: tauri::AppHandle<R>,
    input: RenderAgentKitDraftInput,
) -> Result<RenderAgentKitDraftResult, String> {
    let draft_file_path = canonicalize_json_file(&input.draft_file_path)?;
    let output_folder = resolve_target_directory(&input.output_folder)?;
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
fn render_generated_agent_kit_draft<R: Runtime>(
    app: tauri::AppHandle<R>,
    input: RenderGeneratedAgentKitDraftInput,
) -> Result<RenderAgentKitDraftResult, String> {
    let output_folder = canonicalize_directory(&input.output_folder)?;
    let bridge_script = resolve_render_generated_draft_bridge(&app)?;
    let node_command = resolve_node_command()?;
    let draft_json = serde_json::to_string(&input.draft_json)
        .map_err(|error| format!("Unable to serialize generated draft JSON: {error}"))?;

    let output = Command::new(node_command)
        .arg(&bridge_script)
        .arg(draft_json)
        .arg(&output_folder)
        .arg(if input.force { "true" } else { "false" })
        .current_dir(resolve_command_working_directory(&app))
        .output()
        .map_err(|error| format!("Unable to run generated draft render: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if stderr.is_empty() { stdout } else { stderr };
        return Err(if detail.is_empty() {
            "Generated draft render failed without output".to_string()
        } else {
            detail
        });
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Unable to parse generated draft render result: {error}"))
}

#[tauri::command]
async fn generate_agent_kit_draft_with_openai<R: Runtime>(
    app: tauri::AppHandle<R>,
    input: GenerateAgentKitDraftInput,
) -> Result<GenerateAgentKitDraftResult, String> {
    let user_request = clean_required_value("Describe the Agent Kit you want", &input.user_request)?;
    let api_key = settings::get_openai_api_key(&app)?;
    let model = input
        .model
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("gpt-5-mini")
        .to_string();
    let bridge_script = resolve_generate_draft_bridge(&app)?;
    let node_command = resolve_node_command()?;

    let request = serde_json::json!({
        "userRequest": user_request,
        "targetUsers": split_lines_or_commas(input.target_users.as_deref()),
        "domain": clean_optional(input.domain.as_deref()),
        "desiredValidationLevel": input.desired_validation_level.as_str(),
        "constraints": split_lines_or_commas(input.constraints.as_deref()),
        "sourceNotes": split_lines_or_commas(input.source_notes.as_deref()),
        "model": model,
    });

    let request_json = serde_json::to_string(&request).map_err(|error| error.to_string())?;
    let working_directory = resolve_command_working_directory(&app);
    let output = tauri::async_runtime::spawn_blocking(move || {
        Command::new(node_command)
            .arg(&bridge_script)
            .env("AGENTKITFORGE_OPENAI_API_KEY", api_key)
            .arg(request_json)
            .current_dir(working_directory)
            .output()
    })
    .await
    .map_err(|error| format!("OpenAI draft generation task failed: {error}"))?
    .map_err(|error| format!("Unable to run OpenAI draft generation: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if stderr.is_empty() { stdout } else { stderr };
        return Err(if detail.is_empty() {
            "OpenAI draft generation failed without output".to_string()
        } else {
            detail
        });
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Unable to parse generated draft result: {error}"))
}

#[tauri::command]
fn save_agent_kit_draft_json(
    input: SaveAgentKitDraftJsonInput,
    output_path: String,
) -> Result<SaveAgentKitDraftJsonResult, String> {
    let output_path = resolve_json_output_path(&output_path)?;
    let content = serde_json::to_string_pretty(&input.draft_json)
        .map_err(|error| format!("Unable to serialize draft JSON: {error}"))?;
    fs::write(&output_path, format!("{content}\n"))
        .map_err(|error| format!("Unable to save draft JSON: {error}"))?;

    Ok(SaveAgentKitDraftJsonResult {
        file_path: output_path.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    let folder = canonicalize_directory(&path)?;

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(folder)
            .spawn()
            .map_err(|error| format!("Unable to open output folder: {error}"))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(folder)
            .spawn()
            .map_err(|error| format!("Unable to open output folder: {error}"))?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(folder)
            .spawn()
            .map_err(|error| format!("Unable to open output folder: {error}"))?;
    }

    Ok(())
}

#[tauri::command]
fn list_my_kits<R: Runtime>(app: tauri::AppHandle<R>) -> Result<Vec<MyKitEntry>, String> {
    let mut library = read_my_kits_library(&app)?;
    for kit in &mut library.kits {
        kit.path_exists = Path::new(&kit.path).is_dir();
    }
    library
        .kits
        .sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok(library.kits)
}

#[tauri::command]
fn add_kit_to_library<R: Runtime>(
    app: tauri::AppHandle<R>,
    input: AddKitToLibraryInput,
) -> Result<MyKitEntry, String> {
    let path = canonicalize_directory(&input.path)?;
    let metadata = read_kit_metadata(&path)?;
    let now = now_timestamp();
    let mut library = read_my_kits_library(&app)?;
    let normalized_path = path.to_string_lossy().into_owned();

    if let Some(existing) = library
        .kits
        .iter_mut()
        .find(|kit| paths_equal(&kit.path, &normalized_path))
    {
        existing.id = metadata.id;
        existing.name = metadata.name;
        existing.version = metadata.version;
        existing.description = metadata.description;
        existing.source = input.source.as_str().to_string();
        existing.updated_at = now;
        existing.path_exists = true;
        let entry = existing.clone();
        write_my_kits_library(&app, &library)?;
        return Ok(entry);
    }

    let entry = MyKitEntry {
        id: metadata.id,
        name: metadata.name,
        version: metadata.version,
        description: metadata.description,
        path: normalized_path,
        source: input.source.as_str().to_string(),
        last_validated_at: None,
        last_validated_profile: None,
        last_validation_valid: None,
        last_used_at: None,
        created_at: now.clone(),
        updated_at: now,
        path_exists: true,
    };
    library.kits.push(entry.clone());
    write_my_kits_library(&app, &library)?;
    Ok(entry)
}

#[tauri::command]
fn remove_kit_from_library<R: Runtime>(app: tauri::AppHandle<R>, path: String) -> Result<(), String> {
    let mut library = read_my_kits_library(&app)?;
    library.kits.retain(|kit| !paths_equal(&kit.path, &path));
    write_my_kits_library(&app, &library)
}

#[tauri::command]
fn refresh_kit_metadata<R: Runtime>(
    app: tauri::AppHandle<R>,
    path: String,
) -> Result<MyKitEntry, String> {
    let resolved_path = canonicalize_directory(&path)?;
    let metadata = read_kit_metadata(&resolved_path)?;
    let normalized_path = resolved_path.to_string_lossy().into_owned();
    let now = now_timestamp();
    let mut library = read_my_kits_library(&app)?;
    let entry = library
        .kits
        .iter_mut()
        .find(|kit| paths_equal(&kit.path, &normalized_path))
        .ok_or_else(|| "Kit is not in My Kits.".to_string())?;

    entry.id = metadata.id;
    entry.name = metadata.name;
    entry.version = metadata.version;
    entry.description = metadata.description;
    entry.updated_at = now;
    entry.path_exists = true;
    let updated = entry.clone();
    write_my_kits_library(&app, &library)?;
    Ok(updated)
}

#[tauri::command]
fn mark_library_kit_used<R: Runtime>(app: tauri::AppHandle<R>, path: String) -> Result<(), String> {
    let mut library = read_my_kits_library(&app)?;
    if let Some(entry) = library.kits.iter_mut().find(|kit| paths_equal(&kit.path, &path)) {
        let now = now_timestamp();
        entry.last_used_at = Some(now.clone());
        entry.updated_at = now;
        write_my_kits_library(&app, &library)?;
    }
    Ok(())
}

#[tauri::command]
fn validate_library_kit<R: Runtime>(
    app: tauri::AppHandle<R>,
    path: String,
    profile: ValidationProfile,
) -> Result<ValidationReport, String> {
    let report = validate_agent_kit(app.clone(), path.clone(), profile)?;
    let mut library = read_my_kits_library(&app)?;
    if let Some(entry) = library.kits.iter_mut().find(|kit| paths_equal(&kit.path, &path)) {
        let now = now_timestamp();
        entry.last_validated_at = Some(now.clone());
        entry.last_validated_profile = Some(report.profile.clone());
        entry.last_validation_valid = Some(report.valid);
        entry.updated_at = now;
        write_my_kits_library(&app, &library)?;
    }
    Ok(report)
}

#[tauri::command]
fn import_agent_kit_package<R: Runtime>(
    app: tauri::AppHandle<R>,
    input: ImportAgentKitPackageInput,
) -> Result<ImportAgentKitPackageResult, String> {
    let package_path = canonicalize_agent_kit_package(&input.package_path)?;
    let destination_root = canonicalize_directory(&input.destination_root_folder)?;
    let validation_profile = input
        .validation_profile
        .unwrap_or(ValidationProfile::LocalValid);
    let target_folder_name = package_stem(&package_path)?;
    let extraction_folder = unique_or_forced_extraction_folder(
        &destination_root,
        &target_folder_name,
        input.force,
    )?;

    let files = extract_agent_kit_zip(&package_path, &destination_root, &extraction_folder)?;
    let report = validate_agent_kit(
        app,
        extraction_folder.to_string_lossy().into_owned(),
        validation_profile,
    )?;
    let metadata = metadata_entry_from_path(&extraction_folder, KitLibrarySource::Imported)?;

    Ok(ImportAgentKitPackageResult {
        extracted_path: extraction_folder.to_string_lossy().into_owned(),
        validation_report: report,
        metadata,
        files,
    })
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

fn resolve_target_directory(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Select a target output folder before rendering.".to_string());
    }

    let candidate = PathBuf::from(trimmed);
    if candidate.exists() {
        let resolved = candidate
            .canonicalize()
            .map_err(|error| format!("Unable to access target output folder: {error}"))?;
        if !resolved.is_dir() {
            return Err("Target output path is not a folder.".to_string());
        }
        return Ok(resolved);
    }

    let parent = candidate
        .parent()
        .ok_or_else(|| "Target output folder must have a parent folder.".to_string())?;
    let canonical_parent = parent
        .canonicalize()
        .map_err(|error| format!("Unable to access target output parent folder: {error}"))?;

    if !canonical_parent.is_dir() {
        return Err("Target output parent path is not a folder.".to_string());
    }

    let folder_name = candidate
        .file_name()
        .ok_or_else(|| "Target output folder must include a folder name.".to_string())?;

    Ok(canonical_parent.join(folder_name))
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

fn resolve_package_bridge<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    resolve_backend_script(app, "package-agent-kit.mjs")
}

fn resolve_render_draft_bridge<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    resolve_backend_script(app, "render-agent-kit-draft.mjs")
}

fn resolve_generate_draft_bridge<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    resolve_backend_script(app, "generate-agent-kit-draft.mjs")
}

fn resolve_render_generated_draft_bridge<R: Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<PathBuf, String> {
    resolve_backend_script(app, "render-generated-agent-kit-draft.mjs")
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

fn resolve_json_output_path(output_path: &str) -> Result<PathBuf, String> {
    let trimmed = output_path.trim();
    if trimmed.is_empty() {
        return Err("Select a draft JSON output path before saving.".to_string());
    }

    let mut file_path = PathBuf::from(trimmed);
    if file_path.extension().is_none() {
        file_path.set_extension("json");
    }

    let parent = file_path
        .parent()
        .ok_or_else(|| "Draft JSON output path must have a parent folder.".to_string())?;

    let canonical_parent = parent
        .canonicalize()
        .map_err(|error| format!("Unable to access draft JSON output folder: {error}"))?;

    if !canonical_parent.is_dir() {
        return Err("Draft JSON output parent path is not a folder.".to_string());
    }

    let file_name = file_path
        .file_name()
        .ok_or_else(|| "Draft JSON output path must include a file name.".to_string())?;

    Ok(canonical_parent.join(file_name))
}

fn clean_optional(value: Option<&str>) -> Option<String> {
    value.map(str::trim).filter(|value| !value.is_empty()).map(str::to_string)
}

fn split_lines_or_commas(value: Option<&str>) -> Option<Vec<String>> {
    let values = value?
        .split(|character| character == '\n' || character == ',')
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();

    if values.is_empty() {
        None
    } else {
        Some(values)
    }
}

fn default_markdown_file_name(root_path: &Path) -> String {
    let stem = root_path
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.trim().is_empty())
        .unwrap_or("agent-kit");

    format!("{stem}.md")
}

fn default_artifact_stem(root_path: &Path) -> String {
    root_path
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.trim().is_empty())
        .unwrap_or("agent-kit")
        .to_string()
}

fn read_my_kits_library<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<MyKitsLibrary, String> {
    let path = my_kits_library_path(app)?;
    if !path.exists() {
        return Ok(MyKitsLibrary::default());
    }

    let content = fs::read_to_string(&path)
        .map_err(|error| format!("Unable to read My Kits library: {error}"))?;
    serde_json::from_str(&content)
        .map_err(|error| format!("Unable to parse My Kits library: {error}"))
}

fn write_my_kits_library<R: Runtime>(
    app: &tauri::AppHandle<R>,
    library: &MyKitsLibrary,
) -> Result<(), String> {
    let path = my_kits_library_path(app)?;
    let parent = path
        .parent()
        .ok_or_else(|| "Unable to resolve My Kits library folder.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Unable to create My Kits library folder: {error}"))?;
    let content = serde_json::to_string_pretty(library)
        .map_err(|error| format!("Unable to serialize My Kits library: {error}"))?;
    fs::write(path, content).map_err(|error| format!("Unable to save My Kits library: {error}"))
}

fn my_kits_library_path<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|path| path.join("my-kits.json"))
        .map_err(|error| format!("Unable to resolve My Kits library folder: {error}"))
}

fn read_kit_metadata(root_path: &Path) -> Result<KitMetadata, String> {
    let manifest_path = root_path.join("agentkit.yaml");
    if !manifest_path.exists() {
        return Err("agentkit.yaml is required to add a kit to My Kits.".to_string());
    }

    let manifest = fs::read_to_string(&manifest_path)
        .map_err(|error| format!("Unable to read agentkit.yaml: {error}"))?;
    let id = read_manifest_scalar(&manifest, "id")
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| default_artifact_stem(root_path));
    let name = read_manifest_scalar(&manifest, "name")
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| id.clone());
    let version = read_manifest_scalar(&manifest, "version")
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "unknown".to_string());
    let description = read_manifest_scalar(&manifest, "description")
        .filter(|value| !value.trim().is_empty());

    Ok(KitMetadata {
        id,
        name,
        version,
        description,
    })
}

fn metadata_entry_from_path(root_path: &Path, source: KitLibrarySource) -> Result<MyKitEntry, String> {
    let metadata = read_kit_metadata(root_path)?;
    let now = now_timestamp();
    Ok(MyKitEntry {
        id: metadata.id,
        name: metadata.name,
        version: metadata.version,
        description: metadata.description,
        path: root_path.to_string_lossy().into_owned(),
        source: source.as_str().to_string(),
        last_validated_at: None,
        last_validated_profile: None,
        last_validation_valid: None,
        last_used_at: None,
        created_at: now.clone(),
        updated_at: now,
        path_exists: root_path.is_dir(),
    })
}

fn canonicalize_agent_kit_package(package_path: &str) -> Result<PathBuf, String> {
    let trimmed = package_path.trim();
    if trimmed.is_empty() {
        return Err("Select a .agentkit.zip package before importing.".to_string());
    }

    let resolved = Path::new(trimmed)
        .canonicalize()
        .map_err(|error| format!("Unable to access selected package: {error}"))?;

    if !resolved.is_file() {
        return Err("Selected package path is not a file.".to_string());
    }

    let file_name = resolved
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    if !file_name.ends_with(".agentkit.zip") {
        return Err("Selected package must end with .agentkit.zip.".to_string());
    }

    Ok(resolved)
}

fn package_stem(package_path: &Path) -> Result<String, String> {
    let file_name = package_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Package file name is invalid.".to_string())?;
    let stem = file_name
        .strip_suffix(".agentkit.zip")
        .or_else(|| file_name.strip_suffix(".zip"))
        .unwrap_or(file_name);
    Ok(sanitize_folder_name(stem))
}

fn sanitize_folder_name(value: &str) -> String {
    let sanitized = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();

    if sanitized.is_empty() {
        "imported-agent-kit".to_string()
    } else {
        sanitized
    }
}

fn unique_or_forced_extraction_folder(
    destination_root: &Path,
    folder_name: &str,
    force: bool,
) -> Result<PathBuf, String> {
    let base = destination_root.join(folder_name);
    ensure_child_path(destination_root, &base)?;

    if force {
        if base.exists() {
            ensure_child_path(destination_root, &base)?;
            fs::remove_dir_all(&base)
                .map_err(|error| format!("Unable to clean existing import folder: {error}"))?;
        }
        fs::create_dir_all(&base)
            .map_err(|error| format!("Unable to create import folder: {error}"))?;
        return Ok(base);
    }

    if !base.exists() {
        fs::create_dir_all(&base)
            .map_err(|error| format!("Unable to create import folder: {error}"))?;
        return Ok(base);
    }

    let entries = fs::read_dir(&base)
        .map_err(|error| format!("Unable to inspect existing import folder: {error}"))?
        .count();
    if entries == 0 {
        return Ok(base);
    }

    Err(format!(
        "Import folder already exists and is not empty: {}. Enable force overwrite to replace it.",
        base.to_string_lossy()
    ))
}

fn extract_agent_kit_zip(
    package_path: &Path,
    destination_root: &Path,
    extraction_folder: &Path,
) -> Result<Vec<String>, String> {
    ensure_child_path(destination_root, extraction_folder)?;
    let file = File::open(package_path)
        .map_err(|error| format!("Unable to open package file: {error}"))?;
    let mut archive =
        ZipArchive::new(file).map_err(|error| format!("Unable to read zip package: {error}"))?;
    let mut files = Vec::new();
    let strip_root = detect_archive_root_folder(&mut archive)?;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("Unable to read zip entry: {error}"))?;
        let enclosed_name = entry
            .enclosed_name()
            .ok_or_else(|| format!("Unsafe zip path: {}", entry.name()))?
            .to_path_buf();
        let relative_path = strip_archive_root_component(&enclosed_name, strip_root.as_deref());
        if relative_path.as_os_str().is_empty() {
            continue;
        }

        let output_path = extraction_folder.join(&relative_path);
        ensure_child_path(extraction_folder, &output_path)?;

        if entry.is_dir() {
            fs::create_dir_all(&output_path)
                .map_err(|error| format!("Unable to create imported folder: {error}"))?;
            continue;
        }

        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Unable to create imported folder: {error}"))?;
        }

        let mut output_file = File::create(&output_path)
            .map_err(|error| format!("Unable to create imported file: {error}"))?;
        io::copy(&mut entry, &mut output_file)
            .map_err(|error| format!("Unable to extract imported file: {error}"))?;
        files.push(relative_path.to_string_lossy().replace('\\', "/"));
    }

    files.sort();
    Ok(files)
}

fn detect_archive_root_folder(
    archive: &mut ZipArchive<File>,
) -> Result<Option<String>, String> {
    let mut common_root: Option<String> = None;
    let mut has_root_manifest = false;

    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|error| format!("Unable to inspect zip entry: {error}"))?;
        let enclosed_name = entry
            .enclosed_name()
            .ok_or_else(|| format!("Unsafe zip path: {}", entry.name()))?
            .to_path_buf();

        if enclosed_name.as_os_str().is_empty() {
            continue;
        }

        if enclosed_name == Path::new("agentkit.yaml") {
            has_root_manifest = true;
        }

        let mut components = enclosed_name.components();
        let Some(first) = components.next() else {
            continue;
        };
        if components.as_path().as_os_str().is_empty() {
            continue;
        }

        let first_component = first.as_os_str().to_string_lossy().to_string();
        match &common_root {
            Some(existing) if existing != &first_component => return Ok(None),
            Some(_) => {}
            None => common_root = Some(first_component),
        }
    }

    if has_root_manifest {
        Ok(None)
    } else {
        Ok(common_root)
    }
}

fn strip_archive_root_component(relative_path: &Path, root: Option<&str>) -> PathBuf {
    let Some(root) = root else {
        return relative_path.to_path_buf();
    };

    let mut components = relative_path.components();
    let Some(first) = components.next() else {
        return PathBuf::new();
    };

    if first.as_os_str().to_string_lossy() == root {
        components.as_path().to_path_buf()
    } else {
        relative_path.to_path_buf()
    }
}

fn ensure_child_path(root: &Path, child: &Path) -> Result<(), String> {
    let root = root
        .canonicalize()
        .map_err(|error| format!("Unable to resolve destination root: {error}"))?;
    let child_parent = if child.exists() {
        child
            .canonicalize()
            .map_err(|error| format!("Unable to resolve destination path: {error}"))?
    } else {
        child
            .parent()
            .ok_or_else(|| "Destination path must have a parent folder.".to_string())?
            .canonicalize()
            .map_err(|error| format!("Unable to resolve destination parent: {error}"))?
    };

    if !child_parent.starts_with(&root) && child_parent != root {
        return Err("Import destination must stay inside the selected destination folder.".to_string());
    }

    Ok(())
}

fn read_manifest_scalar(manifest: &str, key: &str) -> Option<String> {
    let prefix = format!("{key}:");
    manifest.lines().find_map(|line| {
        if line.starts_with(' ') || !line.trim_start().starts_with(&prefix) {
            return None;
        }

        let value = line.split_once(':')?.1.trim();
        Some(unquote_yaml_scalar(value))
    })
}

fn unquote_yaml_scalar(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.len() >= 2
        && ((trimmed.starts_with('"') && trimmed.ends_with('"'))
            || (trimmed.starts_with('\'') && trimmed.ends_with('\'')))
    {
        trimmed[1..trimmed.len() - 1]
            .replace("\\\"", "\"")
            .replace("\\\\", "\\")
    } else {
        trimmed.to_string()
    }
}

fn paths_equal(left: &str, right: &str) -> bool {
    match (Path::new(left).canonicalize(), Path::new(right).canonicalize()) {
        (Ok(left), Ok(right)) => left == right,
        _ => left.eq_ignore_ascii_case(right),
    }
}

fn now_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            select_agent_kit_folder,
            select_onefile_output_path,
            select_json_file,
            select_json_output_path,
            select_agent_kit_package_file,
            validate_agent_kit,
            create_agent_kit_from_template,
            export_agent_kit_onefile,
            package_agent_kit,
            render_agent_kit_draft,
            render_generated_agent_kit_draft,
            generate_agent_kit_draft_with_openai,
            save_agent_kit_draft_json,
            get_app_settings,
            save_openai_api_key,
            clear_openai_api_key,
            save_default_model,
            run_agent_kit_with_openai,
            open_folder,
            add_kit_to_library,
            list_my_kits,
            remove_kit_from_library,
            refresh_kit_metadata,
            validate_library_kit,
            mark_library_kit_used,
            import_agent_kit_package
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
