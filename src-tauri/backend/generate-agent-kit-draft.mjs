import path from "node:path";
import { pathToFileURL } from "node:url";

const [, , inputJson] = process.argv;
const apiKey = process.env.AGENTKITFORGE_OPENAI_API_KEY;

if (!inputJson) {
  console.error("Draft generation input is required.");
  process.exit(2);
}

if (!apiKey) {
  console.error("OpenAI API key is required.");
  process.exit(2);
}

try {
  const input = JSON.parse(inputJson);
  const core = await loadCore();
  const draftRequest = core.createAgentKitDraftRequest({
    userRequest: input.userRequest,
    targetUsers: input.targetUsers,
    domain: input.domain,
    desiredValidationLevel: input.desiredValidationLevel,
    constraints: input.constraints,
    sourceNotes: input.sourceNotes,
  });
  const model = input.model || "gpt-5-mini";
  const response = await callOpenAI(apiKey, model, draftRequest);
  const rawText = extractResponseText(response);
  const draftJson = parseJsonObject(rawText);
  const parsed = core.agentKitDraftSchema.safeParse(draftJson);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => {
        const issuePath = issue.path.length > 0 ? issue.path.join(".") : "(root)";
        return `${issuePath}: ${issue.message}`;
      })
      .join("\n");
    throw new Error(`Generated draft did not match the AgentKitDraft schema:\n${issues}`);
  }

  const draft = parsed.data;
  process.stdout.write(
    JSON.stringify({
      draftJson: draft,
      draftJsonPretty: `${JSON.stringify(draft, null, 2)}\n`,
      warnings: draftRequest.warnings,
      model,
    }),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function callOpenAI(apiKey, model, draftRequest) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: draftRequest.systemInstructions,
      input: [
        draftRequest.builderInstructions,
        "",
        draftRequest.userPrompt,
        "",
        "Expected JSON schema:",
        JSON.stringify(draftRequest.expectedJsonSchema),
      ].join("\n"),
      text: {
        format: {
          type: "json_schema",
          name: draftRequest.responseFormatName,
          schema: draftRequest.expectedJsonSchema,
          strict: false,
        },
      },
    }),
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(openAIErrorMessage(response.status, body));
  }

  return JSON.parse(body);
}

function extractResponseText(response) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const text = (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" || content.type === "text")
    .map((content) => content.text)
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("OpenAI returned an empty draft response.");
  }

  return text;
}

function parseJsonObject(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      return JSON.parse(match[1]);
    }

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }

    throw new Error("OpenAI returned invalid JSON. Try regenerating the draft.");
  }
}

function openAIErrorMessage(status, body) {
  try {
    const parsed = JSON.parse(body);
    const message = parsed?.error?.message;
    if (message) {
      return `OpenAI request failed (${status}): ${message}`;
    }
  } catch {
    // Fall through to generic message.
  }

  return `OpenAI request failed (${status}).`;
}

async function loadCore() {
  if (process.env.AGENTKITFORGE_CORE_PATH) {
    const entry = path.join(process.env.AGENTKITFORGE_CORE_PATH, "dist", "index.js");
    return import(pathToFileURL(entry).href);
  }

  return import("agentkitforge-core");
}
