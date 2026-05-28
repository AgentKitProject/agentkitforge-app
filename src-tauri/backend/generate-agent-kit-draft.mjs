import path from "node:path";
import { pathToFileURL } from "node:url";

const [, , actionOrInputJson, maybeInputJson] = process.argv;
const providerJson = process.env.AGENTKITFORGE_AI_PROVIDER_CONFIG;
const action = maybeInputJson ? actionOrInputJson : "generate";
const inputJson = maybeInputJson ?? actionOrInputJson;

if (!inputJson) {
  console.error("Draft generation input is required.");
  process.exit(2);
}

if (!providerJson) {
  console.error("AI provider configuration is required.");
  process.exit(2);
}

try {
  const input = JSON.parse(inputJson);
  const provider = JSON.parse(providerJson);
  const core = await loadCore();
  const model = input.model || "gpt-5-mini";

  if (action === "revise") {
    const session = core.validateDraftSession(input.session);
    const currentRevision = core.getCurrentDraftRevision(session);
    const revisionRequest = core.createAgentKitDraftRevisionRequest({
      currentDraft: currentRevision.draft,
      changeRequest: input.changeRequest,
      originalRequest: session.originalRequest,
      desiredValidationLevel: input.desiredValidationLevel,
      constraints: input.constraints,
      sourceNotes: input.sourceNotes,
    });
    const rawText = await callProvider(provider, model, revisionRequest);
    const draftJson = parseJsonObject(rawText);
    const draft = parseAgentKitDraft(core, draftJson);
    const updatedSession = core.addDraftRevision(session, {
      draft,
      changeRequest: input.changeRequest,
      provider: provider.name,
      model,
      warnings: revisionRequest.warnings,
    });
    writeDraftResult({
      draft,
      warnings: revisionRequest.warnings,
      provider,
      model,
      rawResponse: null,
      session: updatedSession,
      currentRevision: core.getCurrentDraftRevision(updatedSession),
    });
    process.exit(0);
  }

  if (action !== "generate") {
    throw new Error(`Unsupported draft action: ${action}`);
  }

  const draftRequest = core.createAgentKitDraftRequest({
    userRequest: input.userRequest,
    targetUsers: input.targetUsers,
    domain: input.domain,
    desiredValidationLevel: input.desiredValidationLevel,
    constraints: input.constraints,
    sourceNotes: input.sourceNotes,
  });
  const rawText = await callProvider(provider, model, draftRequest);
  const draftJson = parseJsonObject(rawText);
  const draft = parseAgentKitDraft(core, draftJson);
  const session = core.createDraftSession({
    originalRequest: input.userRequest,
    initialDraft: draft,
    provider: provider.name,
    model,
    warnings: draftRequest.warnings,
    name: draft.name,
    metadata: {
      domain: input.domain,
      targetUsers: input.targetUsers,
      desiredValidationLevel: input.desiredValidationLevel,
    },
  });
  writeDraftResult({
    draft,
    warnings: draftRequest.warnings,
    provider,
    model,
    rawResponse: null,
    session,
    currentRevision: core.getCurrentDraftRevision(session),
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function parseAgentKitDraft(core, draftJson) {
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

  return parsed.data;
}

function writeDraftResult({ draft, warnings, provider, model, rawResponse, session, currentRevision }) {
  process.stdout.write(
    JSON.stringify({
      draftJson: draft,
      draftJsonPretty: `${JSON.stringify(draft, null, 2)}\n`,
      warnings,
      providerId: provider.id,
      providerName: provider.name,
      model,
      rawResponse,
      session,
      currentRevision,
    }),
  );
}

async function callProvider(provider, model, draftRequest) {
  const instructions = draftRequest.systemInstructions;
  const input = [
    draftRequest.builderInstructions,
    "",
    draftRequest.userPrompt,
    "",
    "Return only valid AgentKitDraft JSON.",
    "Expected JSON schema:",
    JSON.stringify(draftRequest.expectedJsonSchema),
  ].join("\n");

  switch (provider.providerType) {
    case "openai":
      return callOpenAIResponses(provider, model, instructions, input, draftRequest);
    case "anthropic":
      return callAnthropic(provider, model, instructions, input);
    case "gemini":
      return callGemini(provider, model, instructions, input);
    case "ollama":
      return callOllama(provider, model, instructions, input);
    case "openai-compatible":
      return callOpenAICompatible(provider, model, instructions, input);
    default:
      throw new Error(`Unsupported AI provider type: ${provider.providerType}`);
  }
}

async function callOpenAIResponses(provider, model, instructions, input, draftRequest) {
  const apiKey = requiredApiKey(provider);
  const baseUrl = normalizedBaseUrl(provider.baseUrl || "https://api.openai.com/v1");
  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions,
      input,
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
    throw new Error(providerErrorMessage(provider.name, response.status, body));
  }

  return extractOpenAIResponseText(JSON.parse(body), provider.name);
}

async function callOpenAICompatible(provider, model, instructions, input) {
  const baseUrl = normalizedBaseUrl(requiredBaseUrl(provider));
  const headers = { "Content-Type": "application/json" };
  if (provider.apiKey) {
    headers.Authorization = `Bearer ${provider.apiKey}`;
  }
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: input },
      ],
      temperature: 0.2,
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(providerErrorMessage(provider.name, response.status, body));
  }
  const parsed = JSON.parse(body);
  const text = parsed?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(`${provider.name} returned an empty draft response.`);
  return text;
}

async function callAnthropic(provider, model, instructions, input) {
  const apiKey = requiredApiKey(provider);
  const baseUrl = normalizedBaseUrl(provider.baseUrl || "https://api.anthropic.com/v1");
  const response = await fetch(`${baseUrl}/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      system: instructions,
      messages: [{ role: "user", content: input }],
      max_tokens: 4000,
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(providerErrorMessage(provider.name, response.status, body));
  }
  const parsed = JSON.parse(body);
  const text = (parsed.content ?? []).map((item) => item.text).filter(Boolean).join("\n").trim();
  if (!text) throw new Error("Anthropic returned an empty draft response.");
  return text;
}

async function callGemini(provider, model, instructions, input) {
  const apiKey = requiredApiKey(provider);
  const baseUrl = normalizedBaseUrl(provider.baseUrl || "https://generativelanguage.googleapis.com/v1beta");
  const response = await fetch(`${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${instructions}\n\n${input}` }] }],
      generationConfig: { maxOutputTokens: 4000 },
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(providerErrorMessage(provider.name, response.status, body));
  }
  const parsed = JSON.parse(body);
  const text = (parsed.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text)
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!text) throw new Error("Gemini returned an empty draft response.");
  return text;
}

async function callOllama(provider, model, instructions, input) {
  const baseUrl = normalizedBaseUrl(provider.baseUrl || "http://localhost:11434");
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      system: instructions,
      prompt: input,
      stream: false,
      options: { num_predict: 4000 },
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(providerErrorMessage(provider.name, response.status, body));
  }
  const parsed = JSON.parse(body);
  const text = parsed.response?.trim();
  if (!text) throw new Error("Ollama returned an empty draft response.");
  return text;
}

function extractOpenAIResponseText(response, providerName) {
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
    throw new Error(`${providerName} returned an empty draft response.`);
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

    throw new Error("Provider returned non-JSON for draft generation. Try regenerating, use a stricter model, or render a draft JSON manually.");
  }
}

function providerErrorMessage(providerName, status, body) {
  try {
    const parsed = JSON.parse(body);
    const message = parsed?.error?.message || parsed?.error;
    if (message) {
      return `${providerName} request failed (${status}): ${message}`;
    }
  } catch {
    // Fall through to generic message.
  }

  return `${providerName} request failed (${status}).`;
}

function requiredApiKey(provider) {
  if (!provider.apiKey?.trim()) {
    throw new Error(`${provider.name} API key is required.`);
  }
  return provider.apiKey.trim();
}

function requiredBaseUrl(provider) {
  if (!provider.baseUrl?.trim()) {
    throw new Error(`${provider.name} base URL is required.`);
  }
  return provider.baseUrl;
}

function normalizedBaseUrl(value) {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Base URL must start with http:// or https://.");
  }
  return value.replace(/\/+$/, "");
}

async function loadCore() {
  if (process.env.AGENTKITFORGE_CORE_PATH) {
    const entry = path.join(process.env.AGENTKITFORGE_CORE_PATH, "dist", "index.js");
    return import(pathToFileURL(entry).href);
  }

  const siblingEntry = path.resolve(process.cwd(), "..", "agentkitforge-core", "dist", "index.js");
  try {
    return await import(pathToFileURL(siblingEntry).href);
  } catch {
    // Fall back to the installed package.
  }

  return import("agentkitforge-core");
}
