use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    process::Command,
};
use tauri::{Manager, Runtime};

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

fn resolve_validation_bridge<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("backend/validate-agent-kit.mjs");
    if dev_path.exists() {
        return Ok(dev_path);
    }

    app.path()
        .resolve(
            "backend/validate-agent-kit.mjs",
            tauri::path::BaseDirectory::Resource,
        )
        .map_err(|error| format!("Unable to locate validation bridge: {error}"))
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            select_agent_kit_folder,
            validate_agent_kit
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
