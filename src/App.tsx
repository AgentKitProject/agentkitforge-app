import {
  Box,
  CheckCircle2,
  FileArchive,
  FolderOpen,
  Hammer,
  KeyRound,
  PackageOpen,
  PlayCircle,
  Settings,
  Sparkles,
  Wrench,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useMemo, useState } from "react";

type SectionId = "my-kits" | "build" | "use" | "validate" | "settings";
type ValidationProfile = "local-valid" | "publishable" | "trusted" | "verified";
type ValidationIssueSeverity = "error" | "warning";
type AgentKitTemplate = "blank" | "financial-review";

type AppState = {
  currentKitPath: string;
  defaultOutputFolder: string;
  openAiApiKey: string;
  preferredValidationProfile: ValidationProfile;
};

type ValidationIssue = {
  severity: ValidationIssueSeverity;
  code: string;
  message: string;
  path?: string;
};

type ValidationReport = {
  valid: boolean;
  profile: ValidationProfile;
  rootPath: string;
  issues: ValidationIssue[];
};

type CreateAgentKitResult = {
  rootPath: string;
  template: AgentKitTemplate;
  files: string[];
};

type CreateAgentKitInput = {
  outputFolder: string;
  id: string;
  name: string;
  description: string;
  template: AgentKitTemplate;
  force: boolean;
};

type ExportAgentKitResult = {
  filePath: string;
};

type NavItem = {
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
};

const validationProfiles: ValidationProfile[] = ["local-valid", "publishable", "trusted", "verified"];
const agentKitTemplates: AgentKitTemplate[] = ["blank", "financial-review"];
const starterPrompt =
  "Use the attached Agent Kit instructions to help with this task. Follow the kit's skill routing, guardrails, procedures, and output expectations. Ask clarifying questions if required inputs are missing.";

const navItems: NavItem[] = [
  { id: "my-kits", label: "My Kits", icon: PackageOpen },
  { id: "build", label: "Build", icon: Hammer },
  { id: "use", label: "Use", icon: PlayCircle },
  { id: "validate", label: "Validate", icon: CheckCircle2 },
  { id: "settings", label: "Settings", icon: Settings },
];

export function App() {
  const [activeSection, setActiveSection] = useState<SectionId>("my-kits");
  const [appState, setAppState] = useState<AppState>({
    currentKitPath: "",
    defaultOutputFolder: "",
    openAiApiKey: "",
    preferredValidationProfile: "local-valid",
  });

  const activeTitle = useMemo(
    () => navItems.find((item) => item.id === activeSection)?.label ?? "AgentKitForge",
    [activeSection],
  );

  function updateAppState<Key extends keyof AppState>(key: Key, value: AppState[Key]) {
    setAppState((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Wrench size={20} strokeWidth={2.2} />
          </div>
          <div>
            <div className="brand-name">AgentKitForge</div>
            <div className="brand-subtitle">Desktop Forge</div>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`nav-item ${activeSection === item.id ? "active" : ""}`}
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                type="button"
              >
                <Icon size={18} strokeWidth={2.1} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="current-kit-panel">
          <div className="panel-label">Current Kit</div>
          <div className="kit-path">{appState.currentKitPath || "No kit selected"}</div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Agent Kit workspace</p>
            <h1>{activeTitle}</h1>
          </div>
          <div className="current-kit-input">
            <label htmlFor="current-kit-path">Selected kit path</label>
            <input
              id="current-kit-path"
              onChange={(event) => updateAppState("currentKitPath", event.target.value)}
              placeholder="C:\\kits\\customer-support-agent"
              value={appState.currentKitPath}
            />
          </div>
        </header>

        <section className="content">
          {activeSection === "my-kits" && <MyKitsScreen />}
          {activeSection === "build" && (
            <BuildScreen
              onValidateCreatedKit={(rootPath, profile) => {
                updateAppState("currentKitPath", rootPath);
                updateAppState("preferredValidationProfile", profile);
                setActiveSection("validate");
              }}
            />
          )}
          {activeSection === "use" && <UseScreen currentKitPath={appState.currentKitPath} />}
          {activeSection === "validate" && (
            <ValidateScreen
              currentKitPath={appState.currentKitPath}
              profile={appState.preferredValidationProfile}
              onKitPathChange={(value) => updateAppState("currentKitPath", value)}
              onProfileChange={(value) => updateAppState("preferredValidationProfile", value)}
            />
          )}
          {activeSection === "settings" && (
            <SettingsScreen appState={appState} onUpdate={updateAppState} />
          )}
        </section>
      </main>
    </div>
  );
}

function MyKitsScreen() {
  return (
    <div className="empty-state">
      <PackageOpen size={42} strokeWidth={1.8} />
      <h2>No kits added yet</h2>
      <p>
        Recent and pinned Agent Kits will appear here once local kit discovery and import flows are
        connected.
      </p>
      <button className="primary-button" type="button">
        <FolderOpen size={18} />
        Select kit folder
      </button>
    </div>
  );
}

function BuildScreen({
  onValidateCreatedKit,
}: {
  onValidateCreatedKit: (rootPath: string, profile: ValidationProfile) => void;
}) {
  const [form, setForm] = useState<CreateAgentKitInput>({
    outputFolder: "",
    id: "",
    name: "",
    description: "",
    template: "blank",
    force: false,
  });
  const [result, setResult] = useState<CreateAgentKitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CreateAgentKitInput, string>>>(
    {},
  );
  const [isSelecting, setIsSelecting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  function updateForm<Key extends keyof CreateAgentKitInput>(
    key: Key,
    value: CreateAgentKitInput[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setResult(null);
    setError(null);
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function selectOutputFolder() {
    setIsSelecting(true);
    setError(null);

    try {
      const selectedPath = await invoke<string | null>("select_agent_kit_folder");
      if (selectedPath) {
        updateForm("outputFolder", selectedPath);
      }
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    } finally {
      setIsSelecting(false);
    }
  }

  async function createKit() {
    const validationErrors = validateCreateForm(form);
    setFieldErrors(validationErrors);
    setError(null);
    setResult(null);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsCreating(true);

    try {
      const createResult = await invoke<CreateAgentKitResult>("create_agent_kit_from_template", {
        input: form,
      });
      setResult(createResult);
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    } finally {
      setIsCreating(false);
    }
  }

  const validationProfile = defaultValidationProfileForTemplate(result?.template ?? form.template);

  return (
    <div className="build-layout">
      <div className="form-panel">
        <h2>Create from template</h2>

        <label htmlFor="build-output-folder">Target output folder</label>
        <div className="path-picker">
          <input
            id="build-output-folder"
            onChange={(event) => updateForm("outputFolder", event.target.value)}
            placeholder="C:\\kits"
            value={form.outputFolder}
          />
          <button
            className="icon-button"
            disabled={isSelecting || isCreating}
            onClick={selectOutputFolder}
            title="Select output folder"
            type="button"
          >
            <FolderOpen size={18} />
          </button>
        </div>
        <FieldError message={fieldErrors.outputFolder} />

        <label htmlFor="build-kit-id">Kit id</label>
        <input
          id="build-kit-id"
          onChange={(event) => updateForm("id", event.target.value)}
          placeholder="customer-support"
          value={form.id}
        />
        <FieldError message={fieldErrors.id} />

        <label htmlFor="build-kit-name">Kit name</label>
        <input
          id="build-kit-name"
          onChange={(event) => updateForm("name", event.target.value)}
          placeholder="Customer Support"
          value={form.name}
        />
        <FieldError message={fieldErrors.name} />

        <label htmlFor="build-kit-description">Kit description</label>
        <textarea
          id="build-kit-description"
          onChange={(event) => updateForm("description", event.target.value)}
          placeholder="A kit for handling customer support workflows."
          rows={4}
          value={form.description}
        />
        <FieldError message={fieldErrors.description} />

        <label htmlFor="build-template">Template</label>
        <select
          id="build-template"
          onChange={(event) => updateForm("template", event.target.value as AgentKitTemplate)}
          value={form.template}
        >
          {agentKitTemplates.map((template) => (
            <option key={template} value={template}>
              {template}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.template} />

        <label className="checkbox-row" htmlFor="build-force">
          <input
            checked={form.force}
            id="build-force"
            onChange={(event) => updateForm("force", event.target.checked)}
            type="checkbox"
          />
          <span>Force overwrite template files</span>
        </label>

        <button className="primary-button" disabled={isCreating} onClick={createKit} type="button">
          <Box size={18} />
          {isCreating ? "Creating" : "Create"}
        </button>
      </div>

      <div className="build-side">
        <div className="results-panel">
          <div className="panel-label">Create Result</div>
          <CreateAgentKitResults
            error={error}
            isLoading={isCreating}
            onValidateCreatedKit={(rootPath) => onValidateCreatedKit(rootPath, validationProfile)}
            result={result}
            validationProfile={validationProfile}
          />
        </div>

        <div className="screen-grid compact">
          <PlaceholderCard
            description="Generate a draft request and build kit content with an OpenAI-assisted workflow."
            icon={Sparkles}
            title="Build with OpenAI"
          />
          <PlaceholderCard
            description="Render a complete kit folder from draft JSON once core integration is wired."
            icon={FileArchive}
            title="Render from draft JSON"
          />
        </div>
      </div>
    </div>
  );
}

function ValidateScreen({
  currentKitPath,
  profile,
  onKitPathChange,
  onProfileChange,
}: {
  currentKitPath: string;
  profile: ValidationProfile;
  onKitPathChange: (value: string) => void;
  onProfileChange: (value: ValidationProfile) => void;
}) {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function selectFolder() {
    setIsSelecting(true);
    setError(null);

    try {
      const selectedPath = await invoke<string | null>("select_agent_kit_folder");
      if (selectedPath) {
        onKitPathChange(selectedPath);
        setReport(null);
      }
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    } finally {
      setIsSelecting(false);
    }
  }

  async function validateKit() {
    setIsValidating(true);
    setError(null);
    setReport(null);

    try {
      const validationReport = await invoke<ValidationReport>("validate_agent_kit", {
        rootPath: currentKitPath,
        profile,
      });
      setReport(validationReport);
      onKitPathChange(validationReport.rootPath);
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    } finally {
      setIsValidating(false);
    }
  }

  return (
    <div className="form-layout">
      <div className="form-panel">
        <label htmlFor="validate-kit-folder">Select kit folder</label>
        <div className="path-picker">
          <input
            id="validate-kit-folder"
            onChange={(event) => {
              onKitPathChange(event.target.value);
              setReport(null);
            }}
            placeholder="C:\\kits\\agent-kit"
            value={currentKitPath}
          />
          <button
            className="icon-button"
            disabled={isSelecting || isValidating}
            onClick={selectFolder}
            title="Select folder"
            type="button"
          >
            <FolderOpen size={18} />
          </button>
        </div>

        <label htmlFor="validation-profile">Validation profile</label>
        <select
          id="validation-profile"
          disabled={isValidating}
          onChange={(event) => {
            onProfileChange(event.target.value as ValidationProfile);
            setReport(null);
          }}
          value={profile}
        >
          {validationProfiles.map((validationProfile) => (
            <option key={validationProfile} value={validationProfile}>
              {validationProfile}
            </option>
          ))}
        </select>

        <button
          className="primary-button"
          disabled={isValidating || currentKitPath.trim() === ""}
          onClick={validateKit}
          type="button"
        >
          <CheckCircle2 size={18} />
          {isValidating ? "Validating" : "Validate"}
        </button>
      </div>

      <div className="results-panel">
        <div className="panel-label">Results</div>
        <ValidationResults error={error} isLoading={isValidating} report={report} />
      </div>
    </div>
  );
}

function UseScreen({ currentKitPath }: { currentKitPath: string }) {
  const [kitPath, setKitPath] = useState(currentKitPath);
  const [outputPath, setOutputPath] = useState("");
  const [result, setResult] = useState<ExportAgentKitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ kitPath?: string; outputPath?: string }>({});
  const [isSelectingKit, setIsSelectingKit] = useState(false);
  const [isSelectingOutput, setIsSelectingOutput] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  async function selectKitFolder() {
    setIsSelectingKit(true);
    setError(null);

    try {
      const selectedPath = await invoke<string | null>("select_agent_kit_folder");
      if (selectedPath) {
        setKitPath(selectedPath);
        setResult(null);
        setFieldErrors((current) => ({ ...current, kitPath: undefined }));
      }
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    } finally {
      setIsSelectingKit(false);
    }
  }

  async function selectOutputFile() {
    setIsSelectingOutput(true);
    setError(null);

    try {
      const selectedPath = await invoke<string | null>("select_onefile_output_path");
      if (selectedPath) {
        setOutputPath(selectedPath);
        setResult(null);
        setFieldErrors((current) => ({ ...current, outputPath: undefined }));
      }
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    } finally {
      setIsSelectingOutput(false);
    }
  }

  async function selectOutputFolder() {
    setIsSelectingOutput(true);
    setError(null);

    try {
      const selectedPath = await invoke<string | null>("select_agent_kit_folder");
      if (selectedPath) {
        setOutputPath(selectedPath);
        setResult(null);
        setFieldErrors((current) => ({ ...current, outputPath: undefined }));
      }
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    } finally {
      setIsSelectingOutput(false);
    }
  }

  async function exportOneFile() {
    const validationErrors = validateExportForm(kitPath, outputPath);
    setFieldErrors(validationErrors);
    setError(null);
    setResult(null);
    setCopyState("idle");

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsExporting(true);

    try {
      const exportResult = await invoke<ExportAgentKitResult>("export_agent_kit_onefile", {
        input: {
          rootPath: kitPath,
          outputPath,
        },
      });
      setResult(exportResult);
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    } finally {
      setIsExporting(false);
    }
  }

  async function copyStarterPrompt() {
    try {
      await navigator.clipboard.writeText(starterPrompt);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="form-layout">
      <div className="form-panel">
        <label htmlFor="use-kit">Select kit</label>
        <div className="path-picker">
          <input
            id="use-kit"
            onChange={(event) => {
              setKitPath(event.target.value);
              setResult(null);
            }}
            placeholder="Choose an Agent Kit"
            value={kitPath}
          />
          <button
            className="icon-button"
            disabled={isSelectingKit || isExporting}
            onClick={selectKitFolder}
            title="Select kit folder"
            type="button"
          >
            <FolderOpen size={18} />
          </button>
        </div>
        <FieldError message={fieldErrors.kitPath} />

        <label htmlFor="onefile-output">Output file path or folder</label>
        <div className="path-picker double-action">
          <input
            id="onefile-output"
            onChange={(event) => {
              setOutputPath(event.target.value);
              setResult(null);
            }}
            placeholder="C:\\kits\\exports\\agent-kit.md"
            value={outputPath}
          />
          <button
            className="icon-button"
            disabled={isSelectingOutput || isExporting}
            onClick={selectOutputFile}
            title="Select output file"
            type="button"
          >
            <FileArchive size={18} />
          </button>
          <button
            className="icon-button"
            disabled={isSelectingOutput || isExporting}
            onClick={selectOutputFolder}
            title="Select output folder"
            type="button"
          >
            <FolderOpen size={18} />
          </button>
        </div>
        <FieldError message={fieldErrors.outputPath} />

        <button
          className="primary-button"
          disabled={isExporting}
          onClick={exportOneFile}
          type="button"
        >
          <FileArchive size={18} />
          {isExporting ? "Exporting" : "Export one-file Markdown"}
        </button>
      </div>

      <div className="build-side">
        <div className="results-panel">
          <div className="panel-label">Export Result</div>
          <OneFileExportResults
            copyState={copyState}
            error={error}
            isLoading={isExporting}
            onCopyStarterPrompt={copyStarterPrompt}
            result={result}
          />
        </div>

        <div className="screen-grid compact">
          <PlaceholderCard
            description="Open a selected kit in the Forge runtime surface."
            icon={PlayCircle}
            title="Use inside Forge"
          />
          <PlaceholderCard
            description="Prepare install adapters for local coding assistants."
            icon={PackageOpen}
            title="Install adapters"
          />
        </div>
      </div>
    </div>
  );
}

function OneFileExportResults({
  copyState,
  error,
  isLoading,
  onCopyStarterPrompt,
  result,
}: {
  copyState: "idle" | "copied" | "failed";
  error: string | null;
  isLoading: boolean;
  onCopyStarterPrompt: () => void;
  result: ExportAgentKitResult | null;
}) {
  if (isLoading) {
    return <p className="state-copy">Exporting Agent Kit instructions...</p>;
  }

  if (error) {
    return (
      <div className="error-state" role="alert">
        {error}
      </div>
    );
  }

  if (!result) {
    return (
      <p className="state-copy">
        Export a selected kit into one Markdown file for use with ChatGPT, Claude, or another web
        assistant.
      </p>
    );
  }

  return (
    <div className="onefile-result">
      <div className="status-banner valid">
        <strong>Exported</strong>
        <span>Markdown bundle ready</span>
      </div>

      <dl className="report-meta">
        <div>
          <dt>Generated file</dt>
          <dd>{result.filePath}</dd>
        </div>
      </dl>

      <div className="starter-prompt-panel">
        <div className="panel-heading">
          <h3>Starter prompt</h3>
          <button className="secondary-button compact-button" onClick={onCopyStarterPrompt} type="button">
            Copy Starter Prompt
          </button>
        </div>
        <p>{starterPrompt}</p>
        {copyState === "copied" && <div className="copy-state">Copied to clipboard.</div>}
        {copyState === "failed" && (
          <div className="field-error">Clipboard access failed. Select and copy the prompt text.</div>
        )}
      </div>

      <div className="usage-steps">
        <h3>Use with a web assistant</h3>
        <ol>
          <li>Open ChatGPT, Claude, or another AI assistant.</li>
          <li>Upload the generated .md file.</li>
          <li>Upload any task files required by the kit.</li>
          <li>Paste the starter prompt.</li>
          <li>Review the output before relying on it.</li>
        </ol>
      </div>
    </div>
  );
}

function validateExportForm(kitPath: string, outputPath: string) {
  const errors: { kitPath?: string; outputPath?: string } = {};

  if (kitPath.trim() === "") {
    errors.kitPath = "Kit folder is required.";
  }

  if (outputPath.trim() === "") {
    errors.outputPath = "Output file path or output folder is required.";
  }

  return errors;
}
function SettingsScreen({
  appState,
  onUpdate,
}: {
  appState: AppState;
  onUpdate: <Key extends keyof AppState>(key: Key, value: AppState[Key]) => void;
}) {
  return (
    <div className="form-panel settings-panel">
      <label htmlFor="openai-api-key">OpenAI API key</label>
      <div className="input-with-icon">
        <KeyRound size={18} />
        <input
          id="openai-api-key"
          onChange={(event) => onUpdate("openAiApiKey", event.target.value)}
          placeholder="sk-..."
          type="password"
          value={appState.openAiApiKey}
        />
      </div>

      <label htmlFor="default-output-folder">Default output folder</label>
      <input
        id="default-output-folder"
        onChange={(event) => onUpdate("defaultOutputFolder", event.target.value)}
        placeholder="C:\\kits\\output"
        value={appState.defaultOutputFolder}
      />

      <label htmlFor="preferred-validation-profile">Preferred validation profile</label>
      <select
        id="preferred-validation-profile"
        onChange={(event) =>
          onUpdate("preferredValidationProfile", event.target.value as ValidationProfile)
        }
        value={appState.preferredValidationProfile}
      >
        {validationProfiles.map((validationProfile) => (
          <option key={validationProfile} value={validationProfile}>
            {validationProfile}
          </option>
        ))}
      </select>
    </div>
  );
}

function CreateAgentKitResults({
  error,
  isLoading,
  onValidateCreatedKit,
  result,
  validationProfile,
}: {
  error: string | null;
  isLoading: boolean;
  onValidateCreatedKit: (rootPath: string) => void;
  result: CreateAgentKitResult | null;
  validationProfile: ValidationProfile;
}) {
  if (isLoading) {
    return <p className="state-copy">Creating kit from template...</p>;
  }

  if (error) {
    return (
      <div className="error-state" role="alert">
        {error}
      </div>
    );
  }

  if (!result) {
    return <p className="state-copy">Create a kit to see the generated files and root path.</p>;
  }

  return (
    <div className="create-result">
      <div className="status-banner valid">
        <strong>Created</strong>
        <span>{result.files.length} file{result.files.length === 1 ? "" : "s"}</span>
      </div>

      <dl className="report-meta">
        <div>
          <dt>Root path</dt>
          <dd>{result.rootPath}</dd>
        </div>
        <div>
          <dt>Template</dt>
          <dd>{result.template}</dd>
        </div>
        <div>
          <dt>Validation profile</dt>
          <dd>{validationProfile}</dd>
        </div>
      </dl>

      <div className="created-files">
        <h3>Created files</h3>
        <ul>
          {result.files.map((file) => (
            <li key={file}>{file}</li>
          ))}
        </ul>
      </div>

      <button
        className="primary-button"
        onClick={() => onValidateCreatedKit(result.rootPath)}
        type="button"
      >
        <CheckCircle2 size={18} />
        Validate created kit
      </button>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <div className="field-error">{message}</div>;
}

function validateCreateForm(form: CreateAgentKitInput) {
  const errors: Partial<Record<keyof CreateAgentKitInput, string>> = {};

  if (form.outputFolder.trim() === "") {
    errors.outputFolder = "Output folder is required.";
  }

  if (form.id.trim() === "") {
    errors.id = "Kit id is required.";
  } else if (!/^[A-Za-z0-9_-]+$/.test(form.id.trim())) {
    errors.id = "Use letters, numbers, dashes, and underscores only.";
  }

  if (form.name.trim() === "") {
    errors.name = "Kit name is required.";
  }

  if (form.description.trim() === "") {
    errors.description = "Kit description is required.";
  }

  if (!agentKitTemplates.includes(form.template)) {
    errors.template = "Template is required.";
  }

  return errors;
}

function defaultValidationProfileForTemplate(template: AgentKitTemplate): ValidationProfile {
  return template === "financial-review" ? "trusted" : "local-valid";
}

function ValidationResults({
  error,
  isLoading,
  report,
}: {
  error: string | null;
  isLoading: boolean;
  report: ValidationReport | null;
}) {
  if (isLoading) {
    return <p className="state-copy">Running validation with agentkitforge-core...</p>;
  }

  if (error) {
    return (
      <div className="error-state" role="alert">
        {error}
      </div>
    );
  }

  if (!report) {
    return <p className="state-copy">Select a kit folder and run validation to see results.</p>;
  }

  const issuesBySeverity = groupIssuesBySeverity(report.issues);

  return (
    <div className="validation-report">
      <div className={`status-banner ${report.valid ? "valid" : "invalid"}`}>
        <strong>{report.valid ? "Valid" : "Invalid"}</strong>
        <span>{report.issues.length} issue{report.issues.length === 1 ? "" : "s"}</span>
      </div>

      <dl className="report-meta">
        <div>
          <dt>Profile</dt>
          <dd>{report.profile}</dd>
        </div>
        <div>
          <dt>Root path</dt>
          <dd>{report.rootPath}</dd>
        </div>
      </dl>

      {report.issues.length === 0 ? (
        <p className="state-copy">No validation issues found.</p>
      ) : (
        <div className="issue-groups">
          {(["error", "warning"] as ValidationIssueSeverity[]).map((severity) => (
            <IssueGroup issues={issuesBySeverity[severity]} key={severity} severity={severity} />
          ))}
        </div>
      )}
    </div>
  );
}

function IssueGroup({
  issues,
  severity,
}: {
  issues: ValidationIssue[];
  severity: ValidationIssueSeverity;
}) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <section className="issue-group">
      <h3>
        {severity}
        <span>{issues.length}</span>
      </h3>
      <ul>
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${issue.path ?? "root"}-${index}`}>
            <div className="issue-code">{issue.code}</div>
            <p>{issue.message}</p>
            {issue.path && <div className="issue-path">{issue.path}</div>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function groupIssuesBySeverity(issues: ValidationIssue[]) {
  return issues.reduce<Record<ValidationIssueSeverity, ValidationIssue[]>>(
    (grouped, issue) => {
      grouped[issue.severity].push(issue);
      return grouped;
    },
    { error: [], warning: [] },
  );
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "Unexpected validation error.";
}

function PlaceholderCard({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  title: string;
}) {
  return (
    <article className="placeholder-card">
      <div className="card-icon">
        <Icon size={22} strokeWidth={1.9} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <button className="secondary-button" type="button">
        Configure
      </button>
    </article>
  );
}
