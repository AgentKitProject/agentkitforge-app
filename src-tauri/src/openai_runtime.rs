use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunAgentKitInput {
    pub kit_path: String,
    pub user_task: String,
    pub additional_context: Option<String>,
    pub model: Option<String>,
    pub max_output_length: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunAgentKitResult {
    pub response: String,
    pub model: String,
}

#[derive(Debug, Serialize)]
struct ResponsesRequest {
    model: String,
    input: String,
    max_output_tokens: u32,
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
const MAX_CONTEXT_FILE_BYTES: u64 = 256_000;

pub async fn run_agent_kit_with_openai(
    api_key: String,
    input: RunAgentKitInput,
) -> Result<RunAgentKitResult, String> {
    let kit_path = canonicalize_kit_path(&input.kit_path)?;
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

    let context = load_agent_kit_context(&kit_path)?;
    let prompt = compose_prompt(&context, &task, input.additional_context.as_deref());

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/responses")
        .bearer_auth(api_key)
        .json(&ResponsesRequest {
            model: model.clone(),
            input: prompt,
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
    })
}

struct AgentKitContext {
    agentkit: String,
    skills: Vec<ContextFile>,
    policies: Vec<ContextFile>,
    templates: Vec<ContextFile>,
}

struct ContextFile {
    relative_path: String,
    content: String,
}

fn canonicalize_kit_path(kit_path: &str) -> Result<PathBuf, String> {
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

fn load_agent_kit_context(root: &Path) -> Result<AgentKitContext, String> {
    let agentkit_path = root.join("AGENTKIT.md");
    if !agentkit_path.exists() {
        return Err("AGENTKIT.md is required to run an Agent Kit inside Forge.".to_string());
    }

    let agentkit = read_context_file(&agentkit_path)?;
    let skills = find_skill_files(root)?;
    if skills.is_empty() {
        return Err("At least one skills/<skill-id>/SKILL.md file is required.".to_string());
    }

    Ok(AgentKitContext {
        agentkit,
        skills: read_relative_files(root, skills)?,
        policies: read_optional_context_directory(root, "policies")?,
        templates: read_optional_context_directory(root, "templates")?,
    })
}

fn find_skill_files(root: &Path) -> Result<Vec<PathBuf>, String> {
    let skills_root = root.join("skills");
    if !skills_root.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    for entry in fs::read_dir(&skills_root)
        .map_err(|error| format!("Unable to read skills folder: {error}"))?
    {
        let entry = entry.map_err(|error| format!("Unable to read skills folder entry: {error}"))?;
        let skill_file = entry.path().join("SKILL.md");
        if entry.path().is_dir() && skill_file.exists() {
            files.push(skill_file);
        }
    }

    files.sort();
    Ok(files)
}

fn read_optional_context_directory(root: &Path, relative_directory: &str) -> Result<Vec<ContextFile>, String> {
    let directory = root.join(relative_directory);
    if !directory.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    collect_context_files(&directory, &mut files)?;
    files.sort();
    read_relative_files(root, files)
}

fn collect_context_files(directory: &Path, files: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in fs::read_dir(directory)
        .map_err(|error| format!("Unable to read context folder: {error}"))?
    {
        let entry = entry.map_err(|error| format!("Unable to read context folder entry: {error}"))?;
        let path = entry.path();
        if path.is_dir() {
            collect_context_files(&path, files)?;
        } else if is_supported_context_file(&path) {
            files.push(path);
        }
    }

    Ok(())
}

fn read_relative_files(root: &Path, files: Vec<PathBuf>) -> Result<Vec<ContextFile>, String> {
    files
        .into_iter()
        .map(|path| {
            let relative_path = path
                .strip_prefix(root)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");
            let content = read_context_file(&path)?;
            Ok(ContextFile {
                relative_path,
                content,
            })
        })
        .collect()
}

fn read_context_file(path: &Path) -> Result<String, String> {
    let metadata = fs::metadata(path).map_err(|error| format!("Unable to inspect context file: {error}"))?;
    if metadata.len() > MAX_CONTEXT_FILE_BYTES {
        return Err(format!(
            "Context file is too large for v0.1 runtime: {}",
            path.to_string_lossy()
        ));
    }

    fs::read_to_string(path).map_err(|error| {
        format!(
            "Unable to read context file {}: {error}",
            path.to_string_lossy()
        )
    })
}

fn is_supported_context_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "md" | "txt" | "yaml" | "yml" | "json"
            )
        })
        .unwrap_or(false)
}

fn compose_prompt(context: &AgentKitContext, task: &str, additional_context: Option<&str>) -> String {
    let mut prompt = String::new();
    prompt.push_str("You are AgentKitForge running an Agent Kit for a user.\n");
    prompt.push_str("Follow the kit instructions, skill procedures, guardrails, and output expectations. Ask concise clarifying questions if required inputs are missing.\n\n");
    prompt.push_str("## User Task\n\n");
    prompt.push_str(task.trim());
    prompt.push_str("\n\n");

    if let Some(additional_context) = additional_context.map(str::trim).filter(|value| !value.is_empty()) {
        prompt.push_str("## Additional Context\n\n");
        prompt.push_str(additional_context);
        prompt.push_str("\n\n");
    }

    prompt.push_str("## AGENTKIT.md\n\n");
    prompt.push_str(context.agentkit.trim());
    prompt.push_str("\n\n");

    prompt.push_str("## Skills\n\n");
    for skill in &context.skills {
        append_context_file(&mut prompt, skill);
    }

    if !context.policies.is_empty() {
        prompt.push_str("## Policies\n\n");
        for policy in &context.policies {
            append_context_file(&mut prompt, policy);
        }
    }

    if !context.templates.is_empty() {
        prompt.push_str("## Templates\n\n");
        for template in &context.templates {
            append_context_file(&mut prompt, template);
        }
    }

    prompt.push_str("## Response\n\n");
    prompt.push_str("Produce the best answer for the user task using the Agent Kit context above.");
    prompt
}

fn append_context_file(prompt: &mut String, file: &ContextFile) {
    prompt.push_str("### ");
    prompt.push_str(&file.relative_path);
    prompt.push_str("\n\n");
    prompt.push_str(file.content.trim());
    prompt.push_str("\n\n");
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
