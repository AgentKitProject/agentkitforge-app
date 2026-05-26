use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use std::{fs, path::Path, process::Command};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunAgentKitInput {
    pub kit_path: String,
    pub user_task: String,
    pub additional_context: Option<String>,
    pub model: Option<String>,
    pub max_output_length: Option<u32>,
    pub context_mode: Option<AgentKitContextMode>,
    pub target: Option<AgentKitContextTarget>,
    pub include_policies: Option<bool>,
    pub include_templates: Option<bool>,
    pub include_workflows: Option<bool>,
    pub include_references: Option<bool>,
    pub max_skills: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunAgentKitResult {
    pub response: String,
    pub model: String,
    pub kit_name: Option<String>,
    pub context: AgentKitContextDetails,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "kebab-case")]
pub enum AgentKitContextMode {
    All,
    Triggered,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "kebab-case")]
pub enum AgentKitContextTarget {
    Openai,
    Chatgpt,
    Claude,
    Generic,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentKitContextDetails {
    pub included_files: Vec<String>,
    pub included_skills: Vec<String>,
    pub warnings: Vec<String>,
    pub approximate_context_length: usize,
}

#[derive(Debug, Serialize)]
struct ResponsesRequest {
    model: String,
    instructions: String,
    input: String,
    max_output_tokens: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ContextBuilderRequest {
    kit_path: String,
    user_task: String,
    mode: AgentKitContextMode,
    target: AgentKitContextTarget,
    include_policies: bool,
    include_templates: bool,
    include_workflows: bool,
    include_references: bool,
    max_skills: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ContextBuilderResult {
    system_context: String,
    user_context: String,
    included_files: Vec<String>,
    included_skills: Vec<String>,
    warnings: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct ResponsesResponse {
    output: Option<Vec<ResponseOutput>>,
    output_text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ResponseOutput {
    content: Option<Vec<ResponseContent>>,
}

#[derive(Debug, Deserialize)]
struct ResponseContent {
    #[serde(rename = "type")]
    content_type: Option<String>,
    text: Option<String>,
}

const DEFAULT_MODEL: &str = "gpt-5-mini";
const DEFAULT_MAX_OUTPUT_TOKENS: u32 = 1800;
pub async fn run_agent_kit_with_openai(
    api_key: String,
    input: RunAgentKitInput,
    bridge_script: std::path::PathBuf,
    working_directory: std::path::PathBuf,
    node_command: String,
) -> Result<RunAgentKitResult, String> {
    let kit_root = canonicalize_kit_path(&input.kit_path)?;
    let task = required("Task", &input.user_task)?;
    let model = input
        .model
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(DEFAULT_MODEL)
        .to_string();
    let max_output_tokens = input
        .max_output_length
        .unwrap_or(DEFAULT_MAX_OUTPUT_TOKENS)
        .clamp(256, 12000);

    let context = build_context(&input, task, bridge_script, working_directory, node_command).await?;
    let openai_input = compose_openai_input(&context.user_context, input.additional_context.as_deref());
    let approximate_context_length = context.system_context.len() + openai_input.len();

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/responses")
        .bearer_auth(api_key)
        .json(&ResponsesRequest {
            model: model.clone(),
            instructions: context.system_context,
            input: openai_input,
            max_output_tokens,
        })
        .send()
        .await
        .map_err(|error| format!("Unable to reach OpenAI: {error}"))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("Unable to read OpenAI response: {error}"))?;

    if !status.is_success() {
        return Err(openai_error_message(status, &body));
    }

    let parsed: ResponsesResponse =
        serde_json::from_str(&body).map_err(|error| format!("Unable to parse OpenAI response: {error}"))?;
    let response_text = extract_response_text(parsed)?;

    Ok(RunAgentKitResult {
        response: response_text,
        model,
        kit_name: read_kit_name(&kit_root),
        context: AgentKitContextDetails {
            included_files: context.included_files,
            included_skills: context.included_skills,
            warnings: context.warnings,
            approximate_context_length,
        },
    })
}

fn canonicalize_kit_path(kit_path: &str) -> Result<std::path::PathBuf, String> {
    let trimmed = kit_path.trim();
    if trimmed.is_empty() {
        return Err("Select an Agent Kit folder before running inside Forge.".to_string());
    }

    let resolved = Path::new(trimmed)
        .canonicalize()
        .map_err(|error| format!("Unable to access selected kit folder: {error}"))?;

    if !resolved.is_dir() {
        return Err("Selected Agent Kit path is not a folder.".to_string());
    }

    Ok(resolved)
}

fn read_kit_name(root_path: &Path) -> Option<String> {
    let manifest = fs::read_to_string(root_path.join("agentkit.yaml")).ok()?;
    read_manifest_scalar(&manifest, "name")
        .filter(|value| !value.trim().is_empty())
        .or_else(|| read_manifest_scalar(&manifest, "id").filter(|value| !value.trim().is_empty()))
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

async fn build_context(
    input: &RunAgentKitInput,
    task: String,
    bridge_script: std::path::PathBuf,
    working_directory: std::path::PathBuf,
    node_command: String,
) -> Result<ContextBuilderResult, String> {
    let request = ContextBuilderRequest {
        kit_path: input.kit_path.clone(),
        user_task: task,
        mode: input
            .context_mode
            .clone()
            .unwrap_or(AgentKitContextMode::Triggered),
        target: input
            .target
            .clone()
            .unwrap_or(AgentKitContextTarget::Openai),
        include_policies: input.include_policies.unwrap_or(true),
        include_templates: input.include_templates.unwrap_or(true),
        include_workflows: input.include_workflows.unwrap_or(true),
        include_references: input.include_references.unwrap_or(false),
        max_skills: input.max_skills,
    };
    let request_json = serde_json::to_string(&request)
        .map_err(|error| format!("Unable to serialize context request: {error}"))?;
    let output = tauri::async_runtime::spawn_blocking(move || {
        Command::new(node_command)
            .arg(bridge_script)
            .arg(request_json)
            .current_dir(working_directory)
            .output()
    })
    .await
    .map_err(|error| format!("Context builder task failed: {error}"))?
    .map_err(|error| format!("Unable to run Agent Kit Context Builder: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if stderr.is_empty() { stdout } else { stderr };
        return Err(if detail.is_empty() {
            "Agent Kit Context Builder failed without output".to_string()
        } else {
            detail
        });
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Unable to parse Agent Kit context: {error}"))
}

fn compose_openai_input(user_context: &str, additional_context: Option<&str>) -> String {
    let mut input = user_context.trim().to_string();
    if let Some(additional_context) = additional_context.map(str::trim).filter(|value| !value.is_empty()) {
        input.push_str("\n\nAdditional user context:\n");
        input.push_str(additional_context);
    }
    input
}

fn required(label: &str, value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(format!("{label} is required."));
    }

    Ok(trimmed.to_string())
}

fn extract_response_text(response: ResponsesResponse) -> Result<String, String> {
    if let Some(output_text) = response.output_text.map(|text| text.trim().to_string()) {
        if !output_text.is_empty() {
            return Ok(output_text);
        }
    }

    let text = response
        .output
        .unwrap_or_default()
        .into_iter()
        .flat_map(|item| item.content.unwrap_or_default())
        .filter_map(|content| {
            let is_text = content
                .content_type
                .as_deref()
                .is_none_or(|content_type| content_type == "output_text" || content_type == "text");
            if is_text {
                content.text
            } else {
                None
            }
        })
        .collect::<Vec<_>>()
        .join("\n\n")
        .trim()
        .to_string();

    if text.is_empty() {
        Err("OpenAI returned an empty response.".to_string())
    } else {
        Ok(text)
    }
}

fn openai_error_message(status: StatusCode, body: &str) -> String {
    let message = serde_json::from_str::<serde_json::Value>(body)
        .ok()
        .and_then(|value| {
            value
                .get("error")
                .and_then(|error| error.get("message"))
                .and_then(|message| message.as_str())
                .map(str::to_string)
        })
        .filter(|message| !message.trim().is_empty())
        .unwrap_or_else(|| "OpenAI request failed.".to_string());

    format!("OpenAI request failed ({status}): {message}")
}
