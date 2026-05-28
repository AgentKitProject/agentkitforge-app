import {
  Box,
  CheckCircle2,
  FileArchive,
  FolderOutput,
  FolderOpen,
  Hammer,
  Info,
  Plug,
  KeyRound,
  PackageOpen,
  PlayCircle,
  Settings,
  Sparkles,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import {
  aiProviderTypes,
  getDefaultModelForProvider,
  getKnownModelsForProvider,
  getProviderCapabilities,
  isApiKeyRequiredForProvider,
  isBaseUrlRequiredForProvider,
  normalizeBaseUrl,
  providerSupportsStructuredJson,
} from "../../agentkitforge-core/dist/providers/catalog.js";
import type { AiProviderType } from "../../agentkitforge-core/dist/providers/types.js";
import agentKitForgeIcon from "./assets/brand/agentkitforge-icon.svg";

type SectionId = "my-kits" | "build" | "use" | "validate" | "settings";
type ExtendedSectionId = SectionId | "package-export" | "install-targets" | "about";
type ValidationProfile = "local-valid" | "publishable" | "trusted" | "verified";
type ValidationIssueSeverity = "error" | "warning";
type AgentKitTemplate = "blank" | "financial-review";
type ThemeMode = "light" | "dark";
type BuildTabId = "ai" | "guided" | "template" | "draft";

type AiProviderConfig = {
  id: string;
  name: string;
  providerType: AiProviderType;
  baseUrl?: string;
  hasApiKey: boolean;
  defaultModel: string;
  supportsStructuredJson: boolean;
  createdAt: string;
  updatedAt: string;
};

type AiProviderForm = {
  id?: string;
  name: string;
  providerType: AiProviderType;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  supportsStructuredJson: boolean;
};

type AppState = {
  currentKitPath: string;
  currentKitName: string;
  defaultOutputFolder: string;
  openAiApiKey: string;
  preferredValidationProfile: ValidationProfile;
};

type KitMetadata = {
  id: string;
  name: string;
  version: string;
  description?: string;
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

type RenderAgentKitDraftResult = {
  rootPath: string;
  files: string[];
};

type RenderAgentKitDraftInput = {
  draftFilePath: string;
  outputFolder: string;
  force: boolean;
};

type GenerateAgentKitDraftInput = {
  userRequest: string;
  targetUsers: string;
  domain: string;
  desiredValidationLevel: ValidationProfile;
  constraints: string;
  sourceNotes: string;
  providerId: string;
  model: string;
};

type GenerateAgentKitDraftResult = {
  draftJson: unknown;
  draftJsonPretty: string;
  warnings: string[];
  providerId: string;
  providerName: string;
  model: string;
  rawResponse?: string;
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

type PackageAgentKitResult = {
  artifactPath: string;
  artifactType: string;
};

type ArtifactResult = {
  artifactPath: string;
  artifactType: ".agentkit.zip" | ".onefile.md";
};

type KitLibrarySource = "built" | "imported" | "manual" | "unknown";

type MyKitEntry = {
  id: string;
  name: string;
  version: string;
  description?: string;
  path: string;
  source: KitLibrarySource;
  lastValidatedAt?: string;
  lastValidatedProfile?: ValidationProfile;
  lastValidationValid?: boolean;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
  pathExists: boolean;
};

type ImportAgentKitPackageResult = {
  extractedPath: string;
  validationReport: ValidationReport;
  metadata: MyKitEntry;
  files: string[];
};

type CodexExportResult = {
  destinationSkillsDir: string;
  exportedSkillFolders: string[];
  generatedIndexFolder?: string;
  warnings: string[];
};

type ClaudeCodeExportResult = {
  destinationDir: string;
  pluginFolder: string;
  pluginManifestPath: string;
  exportedSkillFolders: string[];
  warnings: string[];
};

type PublicSettings = {
  hasOpenaiApiKey: boolean;
  defaultModel: string;
  aiProviders: AiProviderConfig[];
  defaultAiProviderId?: string;
  defaultOutputFolder: string;
  preferredValidationProfile: ValidationProfile;
  preferredContextMode: AgentKitContextMode;
  theme: ThemeMode;
  includePolicies: boolean;
  includeTemplates: boolean;
  includeWorkflows: boolean;
  includeReferences: boolean;
  settingsPath: string;
};

type RunAgentKitResult = {
  response: string;
  providerId: string;
  providerName: string;
  model: string;
  kitName?: string;
  context: AgentKitContextDetails;
};

type AgentKitStarterHint = {
  sourceFile: string;
  excerpt: string;
};

type AgentKitContextMode = "all" | "triggered";
type AgentKitContextTarget = "openai" | "chatgpt" | "claude" | "generic";

type AgentKitContextDetails = {
  includedFiles: string[];
  includedSkills: string[];
  warnings: string[];
  approximateContextLength: number;
};

type RequiredInputFields = {
  audience: string;
  timeframe: string;
  environment: string;
  fileNotes: string;
  other: string;
};

type GuidedBuilderStep =
  | "basics"
  | "skills"
  | "guardrails"
  | "outputs"
  | "inputs"
  | "examples"
  | "review";

type GuidedSkill = {
  id: string;
  name: string;
  description: string;
  triggers: string;
  useWhen: string;
  doNotUseWhen: string;
  inputs: string;
  procedure: string;
  output: string;
  riskLevel: string;
};

type GuidedGuardrail = {
  id: string;
  text: string;
};

type GuidedRequiredInput = {
  id: string;
  label: string;
  description: string;
  required: boolean;
  inputType: "short-text" | "long-text" | "choice" | "multi-choice" | "date" | "number";
  placeholder: string;
  includeInPrompt: boolean;
  choices: string;
};

type GuidedExample = {
  id: string;
  prompt: string;
  requiredInputExamples: string;
  output: string;
};

type GuidedBuilderState = {
  name: string;
  id: string;
  description: string;
  domain: string;
  targetUsers: string;
  validationLevel: ValidationProfile;
  outputFolder: string;
  skills: GuidedSkill[];
  guardrails: GuidedGuardrail[];
  outputSections: string;
  outputTemplate: string;
  documentLike: boolean;
  downloadFileName: string;
  summaryStyle: string;
  requiredInputs: GuidedRequiredInput[];
  examples: GuidedExample[];
  force: boolean;
};

type NavItem = {
  id: ExtendedSectionId;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
};

const validationProfiles: ValidationProfile[] = ["local-valid", "publishable", "trusted", "verified"];
const contextModes: AgentKitContextMode[] = ["all", "triggered"];
const contextTargets: AgentKitContextTarget[] = ["openai", "chatgpt", "claude", "generic"];
const agentKitTemplates: AgentKitTemplate[] = ["blank", "financial-review"];
const buildTabs: { id: BuildTabId; label: string }[] = [
  { id: "ai", label: "Build with AI" },
  { id: "guided", label: "Guided Builder" },
  { id: "template", label: "From Template" },
  { id: "draft", label: "From Draft JSON" },
];
const guidedSteps: { id: GuidedBuilderStep; label: string }[] = [
  { id: "basics", label: "Basics" },
  { id: "skills", label: "Skills" },
  { id: "guardrails", label: "Guardrails" },
  { id: "outputs", label: "Outputs/Templates" },
  { id: "inputs", label: "Required Inputs" },
  { id: "examples", label: "Examples" },
  { id: "review", label: "Review & Create" },
];
const knownDomains = [
  "Finance / Accounting",
  "Legal",
  "Healthcare / Medical",
  "DevOps / SRE",
  "Cloud / Infrastructure",
  "Security",
  "Software Engineering",
  "Data / Analytics",
  "Sales / Marketing",
  "Customer Support",
  "Research",
  "Education",
  "Operations",
  "General Business",
  "Personal Productivity",
  "Real Estate",
  "HR / Recruiting",
  "Procurement",
  "Compliance",
  "Product Management",
  "Project Management",
  "Writing / Editing",
  "Design / Creative",
  "Other / Custom",
];
const starterPrompt =
  "Use the attached Agent Kit instructions to help with this task. Follow the kit's skill routing, guardrails, procedures, and output expectations. Ask clarifying questions if required inputs are missing.";
const defaultRuntimeModel = getDefaultModelForProvider("openai") ?? "gpt-5.4-mini";
const appVersion = "0.1.0";

const navItems: NavItem[] = [
  { id: "my-kits", label: "My Kits", icon: PackageOpen },
  { id: "build", label: "Build", icon: Hammer },
  { id: "use", label: "Use", icon: PlayCircle },
  { id: "validate", label: "Validate", icon: CheckCircle2 },
  { id: "package-export" as ExtendedSectionId, label: "Package / Export", icon: FolderOutput },
  { id: "install-targets", label: "Install Targets", icon: Plug },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "about", label: "About", icon: Info },
];

export function App() {
  const [activeSection, setActiveSection] = useState<ExtendedSectionId>("my-kits");
  const [settings, setSettings] = useState<PublicSettings>({
    hasOpenaiApiKey: false,
    defaultModel: defaultRuntimeModel,
    aiProviders: [],
    defaultAiProviderId: undefined,
    defaultOutputFolder: "",
    preferredValidationProfile: "local-valid",
    preferredContextMode: "triggered",
    theme: "light",
    includePolicies: true,
    includeTemplates: true,
    includeWorkflows: true,
    includeReferences: false,
    settingsPath: "",
  });
  const [appState, setAppState] = useState<AppState>({
    currentKitPath: "",
    currentKitName: "",
    defaultOutputFolder: "",
    openAiApiKey: "",
    preferredValidationProfile: "local-valid",
  });

  const activeTitle = useMemo(
    () => navItems.find((item) => item.id === activeSection)?.label ?? "AgentKitForge",
    [activeSection],
  );

  useEffect(() => {
    invoke<PublicSettings>("get_app_settings")
      .then((loadedSettings) => {
        setSettings(loadedSettings);
        updateAppState("defaultOutputFolder", loadedSettings.defaultOutputFolder);
        updateAppState("preferredValidationProfile", loadedSettings.preferredValidationProfile);
      })
      .catch(() => {
        setSettings({
          hasOpenaiApiKey: false,
          defaultModel: defaultRuntimeModel,
          aiProviders: [],
          defaultAiProviderId: undefined,
          defaultOutputFolder: "",
          preferredValidationProfile: "local-valid",
          preferredContextMode: "triggered",
          theme: "light",
          includePolicies: true,
          includeTemplates: true,
          includeWorkflows: true,
          includeReferences: false,
          settingsPath: "",
        });
      });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme || "light";
  }, [settings.theme]);

  useEffect(() => {
    const trimmedPath = appState.currentKitPath.trim();
    if (!trimmedPath) {
      updateAppState("currentKitName", "");
      return;
    }

    let isCurrent = true;
    invoke<KitMetadata>("get_agent_kit_metadata", { rootPath: trimmedPath })
      .then((metadata) => {
        if (isCurrent) {
          updateAppState("currentKitName", metadata.name || metadata.id || "Selected kit");
        }
      })
      .catch(() => {
        if (isCurrent) {
          updateAppState("currentKitName", "Selected kit");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [appState.currentKitPath]);

  function updateAppState<Key extends keyof AppState>(key: Key, value: AppState[Key]) {
    setAppState((current) => ({ ...current, [key]: value }));
  }

  async function addKitToLibrary(path: string, source: KitLibrarySource) {
    try {
      await invoke<MyKitEntry>("add_kit_to_library", { input: { path, source } });
    } catch {
      // Library add failures should not block create/render/package flows.
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img alt="" className="brand-icon" src={agentKitForgeIcon} />
          <div>
            <div className="brand-name">
              AgentKit<span>Forge</span>
            </div>
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
          <div className="kit-path">{appState.currentKitName || "No kit selected"}</div>
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
          {activeSection === "my-kits" && (
            <MyKitsScreen
              onCurrentKitPathChange={(path) => updateAppState("currentKitPath", path)}
              onPackageKit={(path) => {
                updateAppState("currentKitPath", path);
                setActiveSection("package-export");
              }}
              onUseKit={(path) => {
                updateAppState("currentKitPath", path);
                invoke("mark_library_kit_used", { path }).catch(() => undefined);
                setActiveSection("use");
              }}
              onValidateKit={(path) => {
                updateAppState("currentKitPath", path);
                setActiveSection("validate");
              }}
            />
          )}
          {activeSection === "build" && (
            <BuildScreen
              onKitReady={(rootPath) => {
                updateAppState("currentKitPath", rootPath);
                addKitToLibrary(rootPath, "built");
              }}
              onPackageKit={(rootPath) => {
                updateAppState("currentKitPath", rootPath);
                setActiveSection("package-export");
              }}
              onUseKit={(rootPath) => {
                updateAppState("currentKitPath", rootPath);
                setActiveSection("use");
              }}
              settings={settings}
              onValidateCreatedKit={(rootPath, profile) => {
                updateAppState("currentKitPath", rootPath);
                updateAppState("preferredValidationProfile", profile);
                setActiveSection("validate");
              }}
            />
          )}
          {activeSection === "use" && (
            <UseScreen
              currentKitPath={appState.currentKitPath}
              onKitPathChange={(value) => updateAppState("currentKitPath", value)}
              settings={settings}
            />
          )}
          {activeSection === "validate" && (
            <ValidateScreen
              currentKitPath={appState.currentKitPath}
              profile={appState.preferredValidationProfile}
              onKitPathChange={(value) => updateAppState("currentKitPath", value)}
              onProfileChange={(value) => updateAppState("preferredValidationProfile", value)}
            />
          )}
          {activeSection === "package-export" && (
            <PackageExportScreen
              currentKitPath={appState.currentKitPath}
              onKitPathChange={(value) => updateAppState("currentKitPath", value)}
              onKitPackaged={(path) => addKitToLibrary(path, "manual")}
              settings={settings}
            />
          )}
          {activeSection === "install-targets" && (
            <InstallTargetsScreen
              currentKitPath={appState.currentKitPath}
              onKitPathChange={(value) => updateAppState("currentKitPath", value)}
            />
          )}
          {activeSection === "settings" && (
            <SettingsScreen
              appState={appState}
              onSettingsChange={setSettings}
              onUpdate={updateAppState}
              settings={settings}
            />
          )}
          {activeSection === "about" && <AboutScreen settings={settings} />}
        </section>
      </main>
    </div>
  );
}

function MyKitsScreen({
  onCurrentKitPathChange,
  onPackageKit,
  onUseKit,
  onValidateKit,
}: {
  onCurrentKitPathChange: (path: string) => void;
  onPackageKit: (path: string) => void;
  onUseKit: (path: string) => void;
  onValidateKit: (path: string) => void;
}) {
  const [kits, setKits] = useState<MyKitEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importForm, setImportForm] = useState({
    packagePath: "",
    destinationRootFolder: "",
    force: false,
    validationProfile: "local-valid" as ValidationProfile,
  });
  const [importResult, setImportResult] = useState<ImportAgentKitPackageResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isSelectingPackage, setIsSelectingPackage] = useState(false);
  const [isSelectingDestination, setIsSelectingDestination] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    loadKits();
  }, []);

  async function loadKits() {
    setIsLoading(true);
    setError(null);

    try {
      setKits(await invoke<MyKitEntry[]>("list_my_kits"));
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    } finally {
      setIsLoading(false);
    }
  }

  async function addExistingKit() {
    setIsAdding(true);
    setError(null);

    try {
      const selectedPath = await invoke<string | null>("select_agent_kit_folder");
      if (selectedPath) {
        await invoke<MyKitEntry>("add_kit_to_library", {
          input: { path: selectedPath, source: "manual" },
        });
        onCurrentKitPathChange(selectedPath);
        await loadKits();
      }
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    } finally {
      setIsAdding(false);
    }
  }

  function updateImportForm<Key extends keyof typeof importForm>(
    key: Key,
    value: (typeof importForm)[Key],
  ) {
    setImportForm((current) => ({ ...current, [key]: value }));
    setImportResult(null);
    setImportError(null);
  }

  async function selectPackageFile() {
    setIsSelectingPackage(true);
    setImportError(null);

    try {
      const selectedPath = await invoke<string | null>("select_agent_kit_package_file");
      if (selectedPath) {
        updateImportForm("packagePath", selectedPath);
      }
    } catch (caughtError) {
      setImportError(errorToMessage(caughtError));
    } finally {
      setIsSelectingPackage(false);
    }
  }

  async function selectDestinationFolder() {
    setIsSelectingDestination(true);
    setImportError(null);

    try {
      const selectedPath = await invoke<string | null>("select_agent_kit_folder");
      if (selectedPath) {
        updateImportForm("destinationRootFolder", selectedPath);
      }
    } catch (caughtError) {
      setImportError(errorToMessage(caughtError));
    } finally {
      setIsSelectingDestination(false);
    }
  }

  async function importPackage() {
    setIsImporting(true);
    setImportError(null);
    setImportResult(null);

    try {
      if (importForm.packagePath.trim() === "") {
        throw new Error("Package file is required.");
      }
      if (importForm.destinationRootFolder.trim() === "") {
        throw new Error("Destination folder is required.");
      }

      const result = await invoke<ImportAgentKitPackageResult>("import_agent_kit_package", {
        input: importForm,
      });
      setImportResult(result);
      onCurrentKitPathChange(result.extractedPath);

      if (result.validationReport.valid) {
        await invoke<MyKitEntry>("add_kit_to_library", {
          input: { path: result.extractedPath, source: "imported" },
        });
        await loadKits();
      }
    } catch (caughtError) {
      setImportError(errorToMessage(caughtError));
    } finally {
      setIsImporting(false);
    }
  }

  async function addInvalidImportAnyway() {
    if (!importResult) {
      return;
    }

    try {
      await invoke<MyKitEntry>("add_kit_to_library", {
        input: { path: importResult.extractedPath, source: "imported" },
      });
      onCurrentKitPathChange(importResult.extractedPath);
      await loadKits();
    } catch (caughtError) {
      setImportError(errorToMessage(caughtError));
    }
  }

  async function removeKit(path: string) {
    setError(null);
    try {
      await invoke("remove_kit_from_library", { path });
      await loadKits();
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    }
  }

  async function refreshKit(path: string) {
    setError(null);
    try {
      await invoke<MyKitEntry>("refresh_kit_metadata", { path });
      await loadKits();
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    }
  }

  async function validateKit(path: string) {
    setError(null);
    try {
      await invoke<ValidationReport>("validate_library_kit", { path, profile: "local-valid" });
      await loadKits();
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    }
  }

  async function openKitFolder(path: string) {
    setError(null);
    try {
      await invoke("open_folder", { path });
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    }
  }

  if (isLoading) {
    return (
      <div className="empty-state">
        <PackageOpen size={42} strokeWidth={1.8} />
        <h2>Loading kits</h2>
      </div>
    );
  }

  if (kits.length === 0) {
    return (
      <div className="my-kits-screen">
        <ImportPackagePanel
          form={importForm}
          importError={importError}
          importResult={importResult}
          isImporting={isImporting}
          isSelectingDestination={isSelectingDestination}
          isSelectingPackage={isSelectingPackage}
          onAddInvalidImportAnyway={addInvalidImportAnyway}
          onImportPackage={importPackage}
          onSelectDestinationFolder={selectDestinationFolder}
          onSelectPackageFile={selectPackageFile}
          onUpdateForm={updateImportForm}
        />
        <div className="empty-state">
          <PackageOpen size={42} strokeWidth={1.8} />
          <h2>No kits added yet</h2>
          <p>Add existing Agent Kit folders or build a new kit. Local library entries do not move or copy files.</p>
          {error && (
            <div className="error-state" role="alert">
              {error}
            </div>
          )}
          <button className="primary-button" disabled={isAdding} onClick={addExistingKit} type="button">
            <FolderOpen size={18} />
            {isAdding ? "Adding" : "Add existing kit folder"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-kits-screen">
      <ImportPackagePanel
        form={importForm}
        importError={importError}
        importResult={importResult}
        isImporting={isImporting}
        isSelectingDestination={isSelectingDestination}
        isSelectingPackage={isSelectingPackage}
        onAddInvalidImportAnyway={addInvalidImportAnyway}
        onImportPackage={importPackage}
        onSelectDestinationFolder={selectDestinationFolder}
        onSelectPackageFile={selectPackageFile}
        onUpdateForm={updateImportForm}
      />
      <div className="screen-toolbar">
        <button className="primary-button" disabled={isAdding} onClick={addExistingKit} type="button">
          <FolderOpen size={18} />
          {isAdding ? "Adding" : "Add existing kit folder"}
        </button>
      </div>

      {error && (
        <div className="error-state" role="alert">
          {error}
        </div>
      )}

      <div className="kit-list">
        {kits.map((kit) => (
          <article className={`kit-library-card ${kit.pathExists ? "" : "missing"}`} key={kit.path}>
            <div className="kit-library-main">
              <div>
                <h2>{kit.name}</h2>
                <p>{kit.description || "No description available."}</p>
              </div>
              <span className="source-badge">{kit.source}</span>
            </div>

            {!kit.pathExists && (
              <div className="inline-warning">This folder no longer exists on disk.</div>
            )}

            <dl className="kit-meta-grid">
              <div>
                <dt>Version</dt>
                <dd>{kit.version}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{friendlyLocation(kit.path)}</dd>
              </div>
              <div>
                <dt>Validation</dt>
                <dd>{formatValidationState(kit)}</dd>
              </div>
              <div>
                <dt>Last used</dt>
                <dd>{formatTimestamp(kit.lastUsedAt)}</dd>
              </div>
            </dl>
            <details className="advanced-details">
              <summary>Advanced details</summary>
              <dl className="report-meta">
                <div>
                  <dt>Full folder path</dt>
                  <dd>{kit.path}</dd>
                </div>
              </dl>
            </details>

            <div className="button-row">
              <button className="secondary-button compact-button" disabled={!kit.pathExists} onClick={() => onUseKit(kit.path)} type="button">
                Use kit
              </button>
              <button className="secondary-button compact-button" disabled={!kit.pathExists} onClick={() => onValidateKit(kit.path)} type="button">
                Validate
              </button>
              <button className="secondary-button compact-button" disabled={!kit.pathExists} onClick={() => onPackageKit(kit.path)} type="button">
                Package/export
              </button>
              <button className="secondary-button compact-button" disabled={!kit.pathExists} onClick={() => openKitFolder(kit.path)} type="button">
                Open folder
              </button>
              <button className="secondary-button compact-button" disabled={!kit.pathExists} onClick={() => refreshKit(kit.path)} type="button">
                Refresh
              </button>
              <button className="secondary-button compact-button" onClick={() => removeKit(kit.path)} type="button">
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ImportPackagePanel({
  form,
  importError,
  importResult,
  isImporting,
  isSelectingDestination,
  isSelectingPackage,
  onAddInvalidImportAnyway,
  onImportPackage,
  onSelectDestinationFolder,
  onSelectPackageFile,
  onUpdateForm,
}: {
  form: {
    packagePath: string;
    destinationRootFolder: string;
    force: boolean;
    validationProfile: ValidationProfile;
  };
  importError: string | null;
  importResult: ImportAgentKitPackageResult | null;
  isImporting: boolean;
  isSelectingDestination: boolean;
  isSelectingPackage: boolean;
  onAddInvalidImportAnyway: () => void;
  onImportPackage: () => void;
  onSelectDestinationFolder: () => void;
  onSelectPackageFile: () => void;
  onUpdateForm: <Key extends keyof ImportPackagePanelProps["form"]>(
    key: Key,
    value: ImportPackagePanelProps["form"][Key],
  ) => void;
}) {
  return (
    <div className="form-panel import-panel">
      <h2>Import .agentkit.zip</h2>

      <label htmlFor="import-package-file">Package file</label>
      <div className="path-picker">
        <input
          id="import-package-file"
          onChange={(event) => onUpdateForm("packagePath", event.target.value)}
          placeholder="C:\\kits\\downloads\\example.agentkit.zip"
          value={form.packagePath}
        />
        <button
          className="icon-button"
          disabled={isSelectingPackage || isImporting}
          onClick={onSelectPackageFile}
          title="Select package"
          type="button"
        >
          <FileArchive size={18} />
        </button>
      </div>

      <label htmlFor="import-destination-folder">Destination root folder</label>
      <div className="path-picker">
        <input
          id="import-destination-folder"
          onChange={(event) => onUpdateForm("destinationRootFolder", event.target.value)}
          placeholder="C:\\kits\\imported"
          value={form.destinationRootFolder}
        />
        <button
          className="icon-button"
          disabled={isSelectingDestination || isImporting}
          onClick={onSelectDestinationFolder}
          title="Select destination folder"
          type="button"
        >
          <FolderOpen size={18} />
        </button>
      </div>

      <label htmlFor="import-validation-profile">Validation profile</label>
      <select
        id="import-validation-profile"
        onChange={(event) => onUpdateForm("validationProfile", event.target.value as ValidationProfile)}
        value={form.validationProfile}
      >
        {validationProfiles.map((profile) => (
          <option key={profile} value={profile}>
            {profile}
          </option>
        ))}
      </select>

      <label className="checkbox-row" htmlFor="import-force">
        <input
          checked={form.force}
          id="import-force"
          onChange={(event) => onUpdateForm("force", event.target.checked)}
          type="checkbox"
        />
        <span>Force overwrite existing import folder</span>
      </label>

      <button className="primary-button" disabled={isImporting} onClick={onImportPackage} type="button">
        <PackageOpen size={18} />
        {isImporting ? "Importing" : "Import package"}
      </button>

      {importError && (
        <div className="error-state" role="alert">
          {importError}
        </div>
      )}

      {importResult && (
        <div className="import-result">
          <div className={`status-banner ${importResult.validationReport.valid ? "valid" : "invalid"}`}>
            <strong>{importResult.validationReport.valid ? "Imported and valid" : "Imported with issues"}</strong>
            <span>{importResult.validationReport.profile}</span>
          </div>
          <dl className="report-meta">
            <div>
              <dt>Imported location</dt>
              <dd>{friendlyLocation(importResult.extractedPath)}</dd>
            </div>
            <div>
              <dt>Kit</dt>
              <dd>{importResult.metadata.name} {importResult.metadata.version}</dd>
            </div>
          </dl>
          <details className="advanced-details">
            <summary>Advanced details</summary>
            <dl className="report-meta">
              <div>
                <dt>Full folder path</dt>
                <dd>{importResult.extractedPath}</dd>
              </div>
            </dl>
          </details>
          {!importResult.validationReport.valid && (
            <>
              <IssueGroup issues={importResult.validationReport.issues.filter((issue) => issue.severity === "error")} severity="error" />
              <button className="secondary-button compact-button" onClick={onAddInvalidImportAnyway} type="button">
                Add to My Kits anyway
              </button>
            </>
          )}
          <div className="created-files">
            <h3>Extracted files</h3>
            <ul>
              {importResult.files.map((file) => (
                <li key={file}>{file}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

type ImportPackagePanelProps = {
  form: {
    packagePath: string;
    destinationRootFolder: string;
    force: boolean;
    validationProfile: ValidationProfile;
  };
};

function BuildScreen({
  onKitReady,
  onPackageKit,
  onUseKit,
  onValidateCreatedKit,
  settings,
}: {
  onKitReady: (rootPath: string) => void;
  onPackageKit: (rootPath: string) => void;
  onUseKit: (rootPath: string) => void;
  onValidateCreatedKit: (rootPath: string, profile: ValidationProfile) => void;
  settings: PublicSettings;
}) {
  const [form, setForm] = useState<CreateAgentKitInput>({
    outputFolder: settings.defaultOutputFolder,
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
  const [draftForm, setDraftForm] = useState<RenderAgentKitDraftInput>({
    draftFilePath: "",
    outputFolder: settings.defaultOutputFolder,
    force: false,
  });
  const [draftResult, setDraftResult] = useState<RenderAgentKitDraftResult | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftFieldErrors, setDraftFieldErrors] = useState<
    Partial<Record<keyof RenderAgentKitDraftInput, string>>
  >({});
  const [isSelectingDraftFile, setIsSelectingDraftFile] = useState(false);
  const [isSelectingDraftOutput, setIsSelectingDraftOutput] = useState(false);
  const [isRenderingDraft, setIsRenderingDraft] = useState(false);
  const [aiForm, setAiForm] = useState<GenerateAgentKitDraftInput>({
    userRequest: "",
    targetUsers: "",
    domain: "",
    desiredValidationLevel: "local-valid",
    constraints: "",
    sourceNotes: "",
    providerId: settings.defaultAiProviderId || "",
    model: settings.defaultModel || defaultRuntimeModel,
  });
  const [aiResult, setAiResult] = useState<GenerateAgentKitDraftResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiFieldErrors, setAiFieldErrors] = useState<
    Partial<Record<keyof GenerateAgentKitDraftInput | "apiKey", string>>
  >({});
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [draftCopyState, setDraftCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [draftSavePath, setDraftSavePath] = useState<string | null>(null);
  const [generatedRenderOutputFolder, setGeneratedRenderOutputFolder] = useState(
    settings.defaultOutputFolder,
  );
  const [generatedRenderForce, setGeneratedRenderForce] = useState(false);
  const [generatedRenderResult, setGeneratedRenderResult] =
    useState<RenderAgentKitDraftResult | null>(null);
  const [generatedRenderError, setGeneratedRenderError] = useState<string | null>(null);
  const [isSelectingGeneratedRenderOutput, setIsSelectingGeneratedRenderOutput] = useState(false);
  const [isRenderingGeneratedDraft, setIsRenderingGeneratedDraft] = useState(false);
  const [activeBuildTab, setActiveBuildTab] = useState<BuildTabId>(() => {
    const saved = window.localStorage.getItem("agentkitforge.lastBuildTab") as BuildTabId | null;
    return saved && buildTabs.some((tab) => tab.id === saved) ? saved : "ai";
  });
  const [guidedStep, setGuidedStep] = useState<GuidedBuilderStep>("basics");
  const [guidedForm, setGuidedForm] = useState<GuidedBuilderState>(() =>
    createDefaultGuidedBuilderState(settings.defaultOutputFolder),
  );
  const [guidedError, setGuidedError] = useState<string | null>(null);
  const [guidedResult, setGuidedResult] = useState<RenderAgentKitDraftResult | null>(null);
  const [guidedValidationReport, setGuidedValidationReport] = useState<ValidationReport | null>(null);
  const [isCreatingGuidedKit, setIsCreatingGuidedKit] = useState(false);
  const [isSelectingGuidedOutput, setIsSelectingGuidedOutput] = useState(false);

  function selectBuildTab(tabId: BuildTabId) {
    setActiveBuildTab(tabId);
    window.localStorage.setItem("agentkitforge.lastBuildTab", tabId);
  }

  function updateGuidedForm<Key extends keyof GuidedBuilderState>(
    key: Key,
    value: GuidedBuilderState[Key],
  ) {
    setGuidedForm((current) => ({ ...current, [key]: value }));
    setGuidedError(null);
    setGuidedResult(null);
    setGuidedValidationReport(null);
  }

  function updateGuidedName(name: string) {
    setGuidedForm((current) => ({
      ...current,
      name,
      id: current.id.trim() === "" || current.id === slugify(current.name) ? slugify(name) : current.id,
      downloadFileName:
        current.downloadFileName.trim() === "" || current.downloadFileName === `${slugify(current.name)}-output`
          ? `${slugify(name)}-output`
          : current.downloadFileName,
    }));
  }

  function updateGuidedSkill(index: number, patch: Partial<GuidedSkill>) {
    setGuidedForm((current) => ({
      ...current,
      skills: current.skills.map((skill, skillIndex) => {
        if (skillIndex !== index) {
          return skill;
        }
        const next = { ...skill, ...patch };
        if (patch.name && (skill.id.trim() === "" || skill.id === slugify(skill.name))) {
          next.id = slugify(patch.name);
        }
        return next;
      }),
    }));
  }

  function addGuidedSkill() {
    setGuidedForm((current) => ({
      ...current,
      skills: [...current.skills, createDefaultGuidedSkill(current.skills.length + 1)],
    }));
  }

  function removeGuidedSkill(index: number) {
    setGuidedForm((current) => ({
      ...current,
      skills:
        current.skills.length > 1
          ? current.skills.filter((_, skillIndex) => skillIndex !== index)
          : current.skills,
    }));
  }

  function updateGuidedGuardrail(index: number, text: string) {
    setGuidedForm((current) => ({
      ...current,
      guardrails: current.guardrails.map((guardrail, guardrailIndex) =>
        guardrailIndex === index ? { ...guardrail, text } : guardrail,
      ),
    }));
  }

  function addGuidedGuardrail(text = "") {
    setGuidedForm((current) => ({
      ...current,
      guardrails: [
        ...current.guardrails,
        { id: `guardrail-${current.guardrails.length + 1}`, text },
      ],
    }));
  }

  function removeGuidedGuardrail(index: number) {
    setGuidedForm((current) => ({
      ...current,
      guardrails: current.guardrails.filter((_, guardrailIndex) => guardrailIndex !== index),
    }));
  }

  function addDomainGuardrailPreset() {
    const preset = guardrailPresetForDomain(guidedForm.domain);
    if (preset) {
      addGuidedGuardrail(preset);
    }
  }

  function updateGuidedRequiredInput(index: number, patch: Partial<GuidedRequiredInput>) {
    setGuidedForm((current) => ({
      ...current,
      requiredInputs: current.requiredInputs.map((input, inputIndex) => {
        if (inputIndex !== index) {
          return input;
        }
        const next = { ...input, ...patch };
        if (patch.label && (input.id.trim() === "" || input.id === slugify(input.label))) {
          next.id = slugify(patch.label);
        }
        return next;
      }),
    }));
  }

  function addGuidedRequiredInput() {
    setGuidedForm((current) => ({
      ...current,
      requiredInputs: [...current.requiredInputs, createDefaultRequiredInput(current.requiredInputs.length + 1)],
    }));
  }

  function removeGuidedRequiredInput(index: number) {
    setGuidedForm((current) => ({
      ...current,
      requiredInputs: current.requiredInputs.filter((_, inputIndex) => inputIndex !== index),
    }));
  }

  function updateGuidedExample(index: number, patch: Partial<GuidedExample>) {
    setGuidedForm((current) => ({
      ...current,
      examples: current.examples.map((example, exampleIndex) => {
        if (exampleIndex !== index) {
          return example;
        }
        const next = { ...example, ...patch };
        if (patch.prompt && (example.id.trim() === "" || example.id.startsWith("example-"))) {
          next.id = slugify(patch.prompt).slice(0, 40) || `example-${index + 1}`;
        }
        return next;
      }),
    }));
  }

  function addGuidedExample() {
    setGuidedForm((current) => ({
      ...current,
      examples: [...current.examples, createDefaultExample(current.examples.length + 1)],
    }));
  }

  function removeGuidedExample(index: number) {
    setGuidedForm((current) => ({
      ...current,
      examples: current.examples.filter((_, exampleIndex) => exampleIndex !== index),
    }));
  }

  async function selectGuidedOutputFolder() {
    setIsSelectingGuidedOutput(true);
    setGuidedError(null);

    try {
      const selectedPath = await invoke<string | null>("select_agent_kit_folder");
      if (selectedPath) {
        updateGuidedForm("outputFolder", selectedPath);
      }
    } catch (caughtError) {
      setGuidedError(errorToMessage(caughtError));
    } finally {
      setIsSelectingGuidedOutput(false);
    }
  }

  async function createGuidedKit(mode: "create" | "validate" | "validate-add") {
    const validationError = validateGuidedBuilder(guidedForm);
    setGuidedError(validationError);
    setGuidedResult(null);
    setGuidedValidationReport(null);

    if (validationError) {
      return;
    }

    setIsCreatingGuidedKit(true);

    try {
      const draft = buildGuidedAgentKitDraft(guidedForm);
      const result = await invoke<RenderAgentKitDraftResult>("render_generated_agent_kit_draft", {
        input: {
          draftJson: draft,
          outputFolder: guidedTargetOutputFolder(guidedForm),
          force: guidedForm.force,
        },
      });
      setGuidedResult(result);
      onKitReady(result.rootPath);

      if (mode === "validate" || mode === "validate-add") {
        const report = await invoke<ValidationReport>("validate_agent_kit", {
          rootPath: result.rootPath,
          profile: guidedDefaultValidationProfile(guidedForm),
        });
        setGuidedValidationReport(report);
      }
    } catch (caughtError) {
      setGuidedError(errorToMessage(caughtError));
    } finally {
      setIsCreatingGuidedKit(false);
    }
  }

  async function openGuidedFolder() {
    if (!guidedResult) {
      return;
    }
    try {
      await invoke("open_folder", { path: guidedResult.rootPath });
    } catch (caughtError) {
      setGuidedError(errorToMessage(caughtError));
    }
  }

  useEffect(() => {
    const provider = getSelectedProvider(settings, aiForm.providerId);
    setAiForm((current) => ({
      ...current,
      providerId: current.providerId || settings.defaultAiProviderId || "",
      model: current.model || provider?.defaultModel || settings.defaultModel || defaultRuntimeModel,
    }));
  }, [settings]);

  useEffect(() => {
    setForm((current) => ({ ...current, outputFolder: current.outputFolder || settings.defaultOutputFolder }));
    setDraftForm((current) => ({ ...current, outputFolder: current.outputFolder || settings.defaultOutputFolder }));
    setGeneratedRenderOutputFolder((current) => current || settings.defaultOutputFolder);
    setGuidedForm((current) => ({ ...current, outputFolder: current.outputFolder || settings.defaultOutputFolder }));
  }, [settings.defaultOutputFolder]);

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

  function updateDraftForm<Key extends keyof RenderAgentKitDraftInput>(
    key: Key,
    value: RenderAgentKitDraftInput[Key],
  ) {
    setDraftForm((current) => ({ ...current, [key]: value }));
    setDraftResult(null);
    setDraftError(null);
    setDraftFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  function updateAiForm<Key extends keyof GenerateAgentKitDraftInput>(
    key: Key,
    value: GenerateAgentKitDraftInput[Key],
  ) {
    setAiForm((current) => ({ ...current, [key]: value }));
    setAiResult(null);
    setAiError(null);
    setDraftCopyState("idle");
    setDraftSavePath(null);
    setGeneratedRenderResult(null);
    setGeneratedRenderError(null);
    setAiFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function selectDraftFile() {
    setIsSelectingDraftFile(true);
    setDraftError(null);

    try {
      const selectedPath = await invoke<string | null>("select_json_file");
      if (selectedPath) {
        updateDraftForm("draftFilePath", selectedPath);
      }
    } catch (caughtError) {
      setDraftError(errorToMessage(caughtError));
    } finally {
      setIsSelectingDraftFile(false);
    }
  }

  async function selectDraftOutputFolder() {
    setIsSelectingDraftOutput(true);
    setDraftError(null);

    try {
      const selectedPath = await invoke<string | null>("select_agent_kit_folder");
      if (selectedPath) {
        updateDraftForm("outputFolder", selectedPath);
      }
    } catch (caughtError) {
      setDraftError(errorToMessage(caughtError));
    } finally {
      setIsSelectingDraftOutput(false);
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
      onKitReady(createResult.rootPath);
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    } finally {
      setIsCreating(false);
    }
  }

  async function renderDraft() {
    const validationErrors = validateDraftRenderForm(draftForm);
    setDraftFieldErrors(validationErrors);
    setDraftError(null);
    setDraftResult(null);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsRenderingDraft(true);

    try {
      const renderResult = await invoke<RenderAgentKitDraftResult>("render_agent_kit_draft", {
        input: draftForm,
      });
      setDraftResult(renderResult);
      onKitReady(renderResult.rootPath);
    } catch (caughtError) {
      setDraftError(errorToMessage(caughtError));
    } finally {
      setIsRenderingDraft(false);
    }
  }

  async function generateDraftWithOpenAI() {
    const validationErrors = validateGenerateDraftForm(settings, aiForm);
    setAiFieldErrors(validationErrors);
    setAiError(null);
    setAiResult(null);
    setDraftSavePath(null);
    setDraftCopyState("idle");
    setGeneratedRenderResult(null);
    setGeneratedRenderError(null);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsGeneratingDraft(true);

    try {
      const result = await invoke<GenerateAgentKitDraftResult>(
        "generate_agent_kit_draft_with_ai",
        { input: aiForm },
      );
      setAiResult(result);
    } catch (caughtError) {
      setAiError(errorToMessage(caughtError));
    } finally {
      setIsGeneratingDraft(false);
    }
  }

  async function copyGeneratedDraftJson() {
    if (!aiResult) {
      return;
    }

    try {
      await navigator.clipboard.writeText(aiResult.draftJsonPretty);
      setDraftCopyState("copied");
    } catch {
      setDraftCopyState("failed");
    }
  }

  async function saveGeneratedDraftJson() {
    if (!aiResult) {
      return;
    }

    setAiError(null);

    try {
      const outputPath = await invoke<string | null>("select_json_output_path");
      if (!outputPath) {
        return;
      }

      const saveResult = await invoke<{ filePath: string }>("save_agent_kit_draft_json", {
        input: { draftJson: aiResult.draftJson },
        outputPath,
      });
      setDraftSavePath(saveResult.filePath);
    } catch (caughtError) {
      setAiError(errorToMessage(caughtError));
    }
  }

  async function selectGeneratedRenderOutputFolder() {
    setIsSelectingGeneratedRenderOutput(true);
    setGeneratedRenderError(null);

    try {
      const selectedPath = await invoke<string | null>("select_agent_kit_folder");
      if (selectedPath) {
        setGeneratedRenderOutputFolder(selectedPath);
        setGeneratedRenderResult(null);
      }
    } catch (caughtError) {
      setGeneratedRenderError(errorToMessage(caughtError));
    } finally {
      setIsSelectingGeneratedRenderOutput(false);
    }
  }

  async function renderGeneratedDraft() {
    if (!aiResult) {
      return;
    }

    if (generatedRenderOutputFolder.trim() === "") {
      setGeneratedRenderError("Output folder is required to render this draft.");
      return;
    }

    setIsRenderingGeneratedDraft(true);
    setGeneratedRenderError(null);
    setGeneratedRenderResult(null);

    try {
      const result = await invoke<RenderAgentKitDraftResult>("render_generated_agent_kit_draft", {
        input: {
          draftJson: aiResult.draftJson,
          outputFolder: generatedRenderOutputFolder,
          force: generatedRenderForce,
        },
      });
      setGeneratedRenderResult(result);
      onKitReady(result.rootPath);
    } catch (caughtError) {
      setGeneratedRenderError(errorToMessage(caughtError));
    } finally {
      setIsRenderingGeneratedDraft(false);
    }
  }

  const validationProfile = defaultValidationProfileForTemplate(result?.template ?? form.template);

  return (
    <div className="build-screen">
      <div className="tab-list" role="tablist" aria-label="Builder modes">
        {buildTabs.map((tab) => (
          <button
            aria-selected={activeBuildTab === tab.id}
            className={`tab-button ${activeBuildTab === tab.id ? "active" : ""}`}
            key={tab.id}
            onClick={() => selectBuildTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeBuildTab === "ai" && (
      <div className="build-layout">
        <div className="form-panel">
          <h2>Build with AI</h2>

          {settings.aiProviders.length === 0 && (
            <div className="inline-warning">Add an AI provider in Settings before generating drafts.</div>
          )}
          {selectedProviderSupportsStructuredJson(getSelectedProvider(settings, aiForm.providerId), aiForm.model) === false && (
            <div className="inline-warning">
              This provider may not reliably return valid AgentKitDraft JSON. AgentKitForge will
              validate the draft before rendering it.
            </div>
          )}

          <LabelWithHelp
            htmlFor="ai-user-request"
            label="Describe the Agent Kit you want"
            help="Tell AgentKitForge what this kit should help someone do. Plain language is best."
          />
          <textarea
            id="ai-user-request"
            onChange={(event) => updateAiForm("userRequest", event.target.value)}
            placeholder="Describe the Agent Kit's purpose, skills, workflows, and expected outputs."
            rows={5}
            value={aiForm.userRequest}
          />
          <FieldError message={aiFieldErrors.userRequest} />
          <FieldError message={aiFieldErrors.apiKey} />

          <LabelWithHelp
            htmlFor="ai-provider"
            label="AI provider"
            help="Choose the AI service or local model that will draft the kit."
          />
          <select
            id="ai-provider"
            onChange={(event) => {
              const provider = settings.aiProviders.find((item) => item.id === event.target.value);
              setAiForm((current) => ({
                ...current,
                providerId: event.target.value,
                model: provider?.defaultModel || current.model,
              }));
              setAiResult(null);
              setAiError(null);
            }}
            value={aiForm.providerId}
          >
            <option value="">Select provider</option>
            {settings.aiProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name} ({provider.providerType})
              </option>
            ))}
          </select>
          <FieldError message={aiFieldErrors.providerId} />

          <LabelWithHelp
            htmlFor="ai-domain"
            label="Domain"
            help="Pick the work area this kit belongs to. You can type your own if it is not listed."
          />
          <DomainSelector
            id="ai-domain"
            onChange={(value) => updateAiForm("domain", value)}
            value={aiForm.domain}
          />

          <LabelWithHelp
            htmlFor="ai-target-users"
            label="Target users"
            help="Who will use this kit, such as analysts, support agents, managers, or engineers."
          />
          <input
            id="ai-target-users"
            onChange={(event) => updateAiForm("targetUsers", event.target.value)}
            placeholder="Analysts, managers, operators"
            value={aiForm.targetUsers}
          />

          <LabelWithHelp
            htmlFor="ai-validation-level"
            label="Desired validation level"
            help="Higher levels ask for more complete kit materials. Start with local-valid while experimenting."
          />
          <select
            id="ai-validation-level"
            onChange={(event) =>
              updateAiForm("desiredValidationLevel", event.target.value as ValidationProfile)
            }
            value={aiForm.desiredValidationLevel}
          >
            {validationProfiles.map((profile) => (
              <option key={profile} value={profile}>
                {profile}
              </option>
            ))}
          </select>
          <FieldError message={aiFieldErrors.desiredValidationLevel} />

          <label htmlFor="ai-constraints">Constraints</label>
          <textarea
            id="ai-constraints"
            onChange={(event) => updateAiForm("constraints", event.target.value)}
            placeholder="Optional constraints, one per line or comma-separated."
            rows={3}
            value={aiForm.constraints}
          />

          <label htmlFor="ai-source-notes">Source notes</label>
          <textarea
            id="ai-source-notes"
            onChange={(event) => updateAiForm("sourceNotes", event.target.value)}
            placeholder="Optional notes to ground the generated draft."
            rows={3}
            value={aiForm.sourceNotes}
          />

          <LabelWithHelp
            htmlFor="ai-model"
            label="Model"
            help="Use a suggested model or type a custom model ID from your provider."
          />
          <ModelInput
            id="ai-model"
            model={aiForm.model}
            onModelChange={(value) => updateAiForm("model", value)}
            providerType={getSelectedProvider(settings, aiForm.providerId)?.providerType}
          />

          <button
            className="primary-button"
            disabled={isGeneratingDraft}
            onClick={generateDraftWithOpenAI}
            type="button"
          >
            <Sparkles size={18} />
            {isGeneratingDraft ? "Generating" : "Generate Draft"}
          </button>
        </div>

        <div className="results-panel">
          <div className="panel-label">Generated Draft</div>
          <GeneratedDraftResults
            copyState={draftCopyState}
            error={aiError}
            isLoading={isGeneratingDraft}
            onCopyJson={copyGeneratedDraftJson}
            onRenderDraft={renderGeneratedDraft}
            onSaveJson={saveGeneratedDraftJson}
            result={aiResult}
            savePath={draftSavePath}
            renderOutputFolder={generatedRenderOutputFolder}
            onRenderOutputFolderChange={(value) => {
              setGeneratedRenderOutputFolder(value);
              setGeneratedRenderError(null);
              setGeneratedRenderResult(null);
            }}
            onSelectRenderOutputFolder={selectGeneratedRenderOutputFolder}
            renderForce={generatedRenderForce}
            onRenderForceChange={setGeneratedRenderForce}
            renderError={generatedRenderError}
            renderResult={generatedRenderResult}
            isSelectingRenderOutput={isSelectingGeneratedRenderOutput}
            isRenderingDraft={isRenderingGeneratedDraft}
            onValidateRenderedKit={(rootPath) => onValidateCreatedKit(rootPath, "local-valid")}
          />
        </div>
      </div>
      )}

      {activeBuildTab === "guided" && (
        <GuidedBuilder
          error={guidedError}
          form={guidedForm}
          isCreating={isCreatingGuidedKit}
          isSelectingOutput={isSelectingGuidedOutput}
          onAddExample={addGuidedExample}
          onAddGuardrail={() => addGuidedGuardrail()}
          onAddInput={addGuidedRequiredInput}
          onAddSkill={addGuidedSkill}
          onApplyPreset={addDomainGuardrailPreset}
          onCreate={createGuidedKit}
          onOpenFolder={openGuidedFolder}
          onPackageKit={onPackageKit}
          onRemoveExample={removeGuidedExample}
          onRemoveGuardrail={removeGuidedGuardrail}
          onRemoveInput={removeGuidedRequiredInput}
          onRemoveSkill={removeGuidedSkill}
          onSelectOutput={selectGuidedOutputFolder}
          onStepChange={setGuidedStep}
          onUpdate={updateGuidedForm}
          onUpdateExample={updateGuidedExample}
          onUpdateGuardrail={updateGuidedGuardrail}
          onUpdateInput={updateGuidedRequiredInput}
          onUpdateName={updateGuidedName}
          onUpdateSkill={updateGuidedSkill}
          onUseKit={onUseKit}
          onValidateKit={(rootPath) => onValidateCreatedKit(rootPath, guidedDefaultValidationProfile(guidedForm))}
          result={guidedResult}
          step={guidedStep}
          validationReport={guidedValidationReport}
        />
      )}

      {activeBuildTab === "template" && (
      <div className="build-layout">
        <div className="form-panel">
          <h2>Create from template</h2>

        <LabelWithHelp
          htmlFor="build-output-folder"
          label="Save location"
          help="New kits are saved in your AgentKitForge Kits folder by default. You can choose a different folder."
        />
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
          <HelpTip text="Use this only when you intentionally want generated files to replace files in the same kit folder." />
        </label>

        <button className="primary-button" disabled={isCreating} onClick={createKit} type="button">
          <Box size={18} />
          {isCreating ? "Creating" : "Create"}
        </button>
        </div>

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
      </div>
      )}

      {activeBuildTab === "draft" && (
      <div className="build-layout">
        <div className="form-panel">
          <h2>Render from Draft JSON</h2>

          <label htmlFor="draft-json-file">Draft JSON file</label>
          <div className="path-picker">
            <input
              id="draft-json-file"
              onChange={(event) => updateDraftForm("draftFilePath", event.target.value)}
              placeholder="C:\\kits\\drafts\\agent-kit-draft.json"
              value={draftForm.draftFilePath}
            />
            <button
              className="icon-button"
              disabled={isSelectingDraftFile || isRenderingDraft}
              onClick={selectDraftFile}
              title="Select draft JSON"
              type="button"
            >
              <FileArchive size={18} />
            </button>
          </div>
          <FieldError message={draftFieldErrors.draftFilePath} />

          <LabelWithHelp
            htmlFor="draft-output-folder"
            label="Save location"
            help="The rendered kit will be written to this folder and can be added to My Kits."
          />
          <div className="path-picker">
            <input
              id="draft-output-folder"
              onChange={(event) => updateDraftForm("outputFolder", event.target.value)}
              placeholder="C:\\kits\\rendered-agent-kit"
              value={draftForm.outputFolder}
            />
            <button
              className="icon-button"
              disabled={isSelectingDraftOutput || isRenderingDraft}
              onClick={selectDraftOutputFolder}
              title="Select output folder"
              type="button"
            >
              <FolderOpen size={18} />
            </button>
          </div>
          <FieldError message={draftFieldErrors.outputFolder} />

          <label className="checkbox-row" htmlFor="draft-force">
            <input
              checked={draftForm.force}
              id="draft-force"
              onChange={(event) => updateDraftForm("force", event.target.checked)}
              type="checkbox"
            />
            <span>Force overwrite generated files</span>
            <HelpTip text="Use this only when you intentionally want generated files to replace existing files." />
          </label>

          <button
            className="primary-button"
            disabled={isRenderingDraft}
            onClick={renderDraft}
            type="button"
          >
            <FileArchive size={18} />
            {isRenderingDraft ? "Rendering" : "Render"}
          </button>
        </div>

        <div className="results-panel">
          <div className="panel-label">Render Result</div>
          <RenderAgentKitDraftResults
            error={draftError}
            isLoading={isRenderingDraft}
            onValidateRenderedKit={(rootPath) => onValidateCreatedKit(rootPath, "local-valid")}
            result={draftResult}
          />
        </div>
      </div>
      )}

    </div>
  );
}

function GuidedBuilder({
  error,
  form,
  isCreating,
  isSelectingOutput,
  onAddExample,
  onAddGuardrail,
  onAddInput,
  onAddSkill,
  onApplyPreset,
  onCreate,
  onOpenFolder,
  onPackageKit,
  onRemoveExample,
  onRemoveGuardrail,
  onRemoveInput,
  onRemoveSkill,
  onSelectOutput,
  onStepChange,
  onUpdate,
  onUpdateExample,
  onUpdateGuardrail,
  onUpdateInput,
  onUpdateName,
  onUpdateSkill,
  onUseKit,
  onValidateKit,
  result,
  step,
  validationReport,
}: {
  error: string | null;
  form: GuidedBuilderState;
  isCreating: boolean;
  isSelectingOutput: boolean;
  onAddExample: () => void;
  onAddGuardrail: () => void;
  onAddInput: () => void;
  onAddSkill: () => void;
  onApplyPreset: () => void;
  onCreate: (mode: "create" | "validate" | "validate-add") => void;
  onOpenFolder: () => void;
  onPackageKit: (rootPath: string) => void;
  onRemoveExample: (index: number) => void;
  onRemoveGuardrail: (index: number) => void;
  onRemoveInput: (index: number) => void;
  onRemoveSkill: (index: number) => void;
  onSelectOutput: () => void;
  onStepChange: (step: GuidedBuilderStep) => void;
  onUpdate: <Key extends keyof GuidedBuilderState>(key: Key, value: GuidedBuilderState[Key]) => void;
  onUpdateExample: (index: number, patch: Partial<GuidedExample>) => void;
  onUpdateGuardrail: (index: number, text: string) => void;
  onUpdateInput: (index: number, patch: Partial<GuidedRequiredInput>) => void;
  onUpdateName: (name: string) => void;
  onUpdateSkill: (index: number, patch: Partial<GuidedSkill>) => void;
  onUseKit: (rootPath: string) => void;
  onValidateKit: (rootPath: string) => void;
  result: RenderAgentKitDraftResult | null;
  step: GuidedBuilderStep;
  validationReport: ValidationReport | null;
}) {
  const stepIndex = guidedSteps.findIndex((item) => item.id === step);
  const canGoBack = stepIndex > 0;
  const canGoForward = stepIndex < guidedSteps.length - 1;

  return (
    <div className="guided-builder">
      <div className="guided-stepper" aria-label="Guided Builder steps">
        {guidedSteps.map((item, index) => (
          <button
            className={`step-button ${item.id === step ? "active" : ""}`}
            key={item.id}
            onClick={() => onStepChange(item.id)}
            type="button"
          >
            <span>{index + 1}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div className="build-layout">
        <div className="form-panel guided-builder-panel">
          {step === "basics" && (
            <>
              <h2>Basics</h2>
              <LabelWithHelp htmlFor="guided-name" label="Kit name" help="Use a friendly name people will recognize." />
              <input id="guided-name" onChange={(event) => onUpdateName(event.target.value)} placeholder="Quarterly Board Reporting Assistant" value={form.name} />

              <details className="advanced-details">
                <summary>Advanced: Kit ID</summary>
                <LabelWithHelp htmlFor="guided-id" label="Kit ID" help="This becomes the folder-friendly kit identifier. Lowercase letters, numbers, and hyphens work best." />
                <input id="guided-id" onChange={(event) => onUpdate("id", slugify(event.target.value))} value={form.id} />
              </details>

              <LabelWithHelp htmlFor="guided-description" label="Description" help="A short explanation of what this kit helps users do." />
              <textarea id="guided-description" onChange={(event) => onUpdate("description", event.target.value)} rows={4} value={form.description} />

              <LabelWithHelp htmlFor="guided-domain" label="Domain" help="Pick the closest work area, or type a custom domain." />
              <DomainSelector id="guided-domain" onChange={(value) => onUpdate("domain", value)} value={form.domain} />

              <LabelWithHelp htmlFor="guided-target-users" label="Target users" help="Who will use the kit?" />
              <input id="guided-target-users" onChange={(event) => onUpdate("targetUsers", event.target.value)} placeholder="Analysts, operators, managers..." value={form.targetUsers} />

              <LabelWithHelp htmlFor="guided-validation" label="Desired validation level" help="Trusted is best when you include guardrails and examples." />
              <select id="guided-validation" onChange={(event) => onUpdate("validationLevel", event.target.value as ValidationProfile)} value={form.validationLevel}>
                {validationProfiles.map((profile) => <option key={profile} value={profile}>{profile}</option>)}
              </select>

              <LabelWithHelp htmlFor="guided-output-folder" label="Save location" help="Defaults to your AgentKitForge Kits folder. You can choose another folder." />
              <div className="path-picker">
                <input id="guided-output-folder" onChange={(event) => onUpdate("outputFolder", event.target.value)} value={form.outputFolder} />
                <button className="icon-button" disabled={isSelectingOutput || isCreating} onClick={onSelectOutput} title="Select save location" type="button">
                  <FolderOpen size={18} />
                </button>
              </div>
            </>
          )}

          {step === "skills" && (
            <>
              <div className="panel-heading">
                <h2>Skills</h2>
                <button className="secondary-button compact-button" onClick={onAddSkill} type="button">Add skill</button>
              </div>
              {form.skills.map((skill, index) => (
                <article className="guided-card" key={`${skill.id}-${index}`}>
                  <div className="panel-heading">
                    <h3>Skill {index + 1}</h3>
                    <button className="secondary-button compact-button" disabled={form.skills.length === 1} onClick={() => onRemoveSkill(index)} type="button">Remove</button>
                  </div>
                  <LabelWithHelp htmlFor={`skill-name-${index}`} label="Skill name" help="Name one repeatable thing the kit can do." />
                  <input id={`skill-name-${index}`} onChange={(event) => onUpdateSkill(index, { name: event.target.value })} value={skill.name} />
                  <details className="advanced-details">
                    <summary>Advanced: Skill ID</summary>
                    <input onChange={(event) => onUpdateSkill(index, { id: slugify(event.target.value) })} value={skill.id} />
                  </details>
                  <label>Description</label>
                  <input onChange={(event) => onUpdateSkill(index, { description: event.target.value })} value={skill.description} />
                  <label>Trigger phrases</label>
                  <textarea onChange={(event) => onUpdateSkill(index, { triggers: event.target.value })} placeholder="One per line, such as review workbook or summarize risks" rows={3} value={skill.triggers} />
                  <label>Use when</label>
                  <textarea onChange={(event) => onUpdateSkill(index, { useWhen: event.target.value })} rows={3} value={skill.useWhen} />
                  <label>Do not use when</label>
                  <textarea onChange={(event) => onUpdateSkill(index, { doNotUseWhen: event.target.value })} rows={2} value={skill.doNotUseWhen} />
                  <label>Inputs</label>
                  <textarea onChange={(event) => onUpdateSkill(index, { inputs: event.target.value })} rows={2} value={skill.inputs} />
                  <label>Procedure steps</label>
                  <textarea onChange={(event) => onUpdateSkill(index, { procedure: event.target.value })} rows={5} value={skill.procedure} />
                  <label>Output expectations</label>
                  <textarea onChange={(event) => onUpdateSkill(index, { output: event.target.value })} rows={3} value={skill.output} />
                  <label>Risk level</label>
                  <select onChange={(event) => onUpdateSkill(index, { riskLevel: event.target.value })} value={skill.riskLevel}>
                    {["low", "medium", "high"].map((risk) => <option key={risk} value={risk}>{risk}</option>)}
                  </select>
                </article>
              ))}
            </>
          )}

          {step === "guardrails" && (
            <>
              <div className="panel-heading">
                <h2>Guardrails</h2>
                <div className="button-row">
                  <button className="secondary-button compact-button" onClick={onApplyPreset} type="button">Add domain preset</button>
                  <button className="secondary-button compact-button" onClick={onAddGuardrail} type="button">Add custom</button>
                </div>
              </div>
              {form.guardrails.length === 0 && <p className="state-copy">Add guardrails to help users understand boundaries and review expectations.</p>}
              {form.guardrails.map((guardrail, index) => (
                <div className="guided-list-row" key={`${guardrail.id}-${index}`}>
                  <textarea onChange={(event) => onUpdateGuardrail(index, event.target.value)} rows={2} value={guardrail.text} />
                  <button className="secondary-button compact-button" onClick={() => onRemoveGuardrail(index)} type="button">Remove</button>
                </div>
              ))}
            </>
          )}

          {step === "outputs" && (
            <>
              <h2>Outputs/Templates</h2>
              <LabelWithHelp htmlFor="guided-output-sections" label="Expected output sections" help="List the sections users should usually receive." />
              <textarea id="guided-output-sections" onChange={(event) => onUpdate("outputSections", event.target.value)} rows={4} value={form.outputSections} />
              <label>Optional output template</label>
              <textarea onChange={(event) => onUpdate("outputTemplate", event.target.value)} rows={6} value={form.outputTemplate} />
              <label className="checkbox-row">
                <input checked={form.documentLike} onChange={(event) => onUpdate("documentLike", event.target.checked)} type="checkbox" />
                <span>Result is document-like</span>
              </label>
              <label>Suggested downloadable output name</label>
              <input onChange={(event) => onUpdate("downloadFileName", event.target.value)} value={form.downloadFileName} />
              <label>Client/user-facing summary style</label>
              <input onChange={(event) => onUpdate("summaryStyle", event.target.value)} placeholder="Concise executive summary, detailed checklist..." value={form.summaryStyle} />
            </>
          )}

          {step === "inputs" && (
            <>
              <div className="panel-heading">
                <h2>Required Inputs</h2>
                <button className="secondary-button compact-button" onClick={onAddInput} type="button">Add input</button>
              </div>
              <p className="form-copy">These fields tell AgentKitForge what users should provide before running the kit.</p>
              {form.requiredInputs.map((input, index) => (
                <article className="guided-card" key={`${input.id}-${index}`}>
                  <div className="panel-heading">
                    <h3>Input {index + 1}</h3>
                    <button className="secondary-button compact-button" onClick={() => onRemoveInput(index)} type="button">Remove</button>
                  </div>
                  <label>Label</label>
                  <input onChange={(event) => onUpdateInput(index, { label: event.target.value })} value={input.label} />
                  <label>Description/help text</label>
                  <input onChange={(event) => onUpdateInput(index, { description: event.target.value })} value={input.description} />
                  <div className="settings-grid two-column">
                    <label className="checkbox-row">
                      <input checked={input.required} onChange={(event) => onUpdateInput(index, { required: event.target.checked })} type="checkbox" />
                      <span>Required</span>
                    </label>
                    <label className="checkbox-row">
                      <input checked={input.includeInPrompt} onChange={(event) => onUpdateInput(index, { includeInPrompt: event.target.checked })} type="checkbox" />
                      <span>Include in prompt</span>
                    </label>
                  </div>
                  <label>Input type</label>
                  <select onChange={(event) => onUpdateInput(index, { inputType: event.target.value as GuidedRequiredInput["inputType"] })} value={input.inputType}>
                    <option value="short-text">short text</option>
                    <option value="long-text">long text</option>
                    <option value="choice">choice</option>
                    <option value="multi-choice">multi-choice</option>
                    <option value="date">date</option>
                    <option value="number">number</option>
                  </select>
                  <label>Placeholder/example</label>
                  <input onChange={(event) => onUpdateInput(index, { placeholder: event.target.value })} value={input.placeholder} />
                  {(input.inputType === "choice" || input.inputType === "multi-choice") && (
                    <>
                      <label>Choices</label>
                      <textarea onChange={(event) => onUpdateInput(index, { choices: event.target.value })} placeholder="One option per line" rows={3} value={input.choices} />
                    </>
                  )}
                </article>
              ))}
            </>
          )}

          {step === "examples" && (
            <>
              <div className="panel-heading">
                <h2>Examples</h2>
                <button className="secondary-button compact-button" onClick={onAddExample} type="button">Add example</button>
              </div>
              {form.examples.map((example, index) => (
                <article className="guided-card" key={`${example.id}-${index}`}>
                  <div className="panel-heading">
                    <h3>Example {index + 1}</h3>
                    <button className="secondary-button compact-button" onClick={() => onRemoveExample(index)} type="button">Remove</button>
                  </div>
                  <label>Example prompt</label>
                  <textarea onChange={(event) => onUpdateExample(index, { prompt: event.target.value })} rows={4} value={example.prompt} />
                  <label>Required input examples</label>
                  <textarea onChange={(event) => onUpdateExample(index, { requiredInputExamples: event.target.value })} rows={3} value={example.requiredInputExamples} />
                  <label>Expected output example</label>
                  <textarea onChange={(event) => onUpdateExample(index, { output: event.target.value })} rows={5} value={example.output} />
                </article>
              ))}
            </>
          )}

          {step === "review" && (
            <>
              <h2>Review & Create</h2>
              <GuidedReviewSummary form={form} />
              <label className="checkbox-row">
                <input checked={form.force} onChange={(event) => onUpdate("force", event.target.checked)} type="checkbox" />
                <span>Force overwrite generated files</span>
                <HelpTip text="Use only when intentionally replacing generated files in the destination." />
              </label>
              <div className="button-row">
                <button className="primary-button" disabled={isCreating} onClick={() => onCreate("create")} type="button">
                  {isCreating ? "Creating" : "Create Agent Kit"}
                </button>
                <button className="secondary-button" disabled={isCreating} onClick={() => onCreate("validate")} type="button">
                  Create and Validate
                </button>
                <button className="secondary-button" disabled={isCreating} onClick={() => onCreate("validate-add")} type="button">
                  Create, Validate, and Add to My Kits
                </button>
              </div>
            </>
          )}

          {error && <div className="error-state" role="alert">{error}</div>}

          <div className="wizard-nav">
            <button className="secondary-button" disabled={!canGoBack} onClick={() => onStepChange(guidedSteps[stepIndex - 1].id)} type="button">Back</button>
            <button className="primary-button" disabled={!canGoForward} onClick={() => onStepChange(guidedSteps[stepIndex + 1].id)} type="button">Next</button>
          </div>
        </div>

        <div className="results-panel">
          <div className="panel-label">Guided Builder Result</div>
          {!result && !validationReport && <p className="state-copy">Complete the steps, then create the kit from Review & Create.</p>}
          {validationReport && <ValidationResults error={null} isLoading={false} report={validationReport} />}
          {result && (
            <div className="create-result">
              <div className="status-banner valid">
                <strong>{form.name || "Agent Kit"} created</strong>
                <span>{result.files.length} generated files</span>
              </div>
              <dl className="report-meta">
                <div><dt>Kit</dt><dd>{form.name}</dd></div>
                <div><dt>Location</dt><dd>{friendlyLocation(result.rootPath)}</dd></div>
                <div><dt>Validation target</dt><dd>{guidedDefaultValidationProfile(form)}</dd></div>
              </dl>
              <div className="button-row">
                <button className="primary-button compact-button" onClick={() => onUseKit(result.rootPath)} type="button">Use Kit</button>
                <button className="secondary-button compact-button" onClick={() => onPackageKit(result.rootPath)} type="button">Package/Export</button>
                <button className="secondary-button compact-button" onClick={() => onValidateKit(result.rootPath)} type="button">Validate</button>
                <button className="secondary-button compact-button" onClick={onOpenFolder} type="button">Open Folder</button>
              </div>
              <details className="advanced-details">
                <summary>Advanced: draft JSON and full path</summary>
                <dl className="report-meta">
                  <div><dt>Full folder path</dt><dd>{result.rootPath}</dd></div>
                </dl>
                <pre className="json-panel">{JSON.stringify(buildGuidedAgentKitDraft(form), null, 2)}</pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GuidedReviewSummary({ form }: { form: GuidedBuilderState }) {
  return (
    <dl className="report-meta run-meta">
      <div><dt>Kit name</dt><dd>{form.name || "Untitled kit"}</dd></div>
      <div><dt>Domain</dt><dd>{form.domain || "Not selected"}</dd></div>
      <div><dt>Target users</dt><dd>{form.targetUsers || "Not specified"}</dd></div>
      <div><dt>Skills</dt><dd>{form.skills.length}</dd></div>
      <div><dt>Guardrails</dt><dd>{form.guardrails.filter((item) => item.text.trim()).length}</dd></div>
      <div><dt>Required inputs</dt><dd>{form.requiredInputs.length}</dd></div>
      <div><dt>Examples</dt><dd>{form.examples.filter((example) => example.prompt.trim()).length}</dd></div>
      <div><dt>Validation target</dt><dd>{guidedDefaultValidationProfile(form)}</dd></div>
      <div><dt>Save location</dt><dd>{friendlyLocation(guidedTargetOutputFolder(form))}</dd></div>
      <div><dt>Download behavior</dt><dd>{form.documentLike ? `Document-like output, suggested name ${form.downloadFileName || "kit-output"}` : "Standard response output"}</dd></div>
    </dl>
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

function UseScreen({
  currentKitPath,
  onKitPathChange,
  settings,
}: {
  currentKitPath: string;
  onKitPathChange: (path: string) => void;
  settings: PublicSettings;
}) {
  const [kitPath, setKitPath] = useState(currentKitPath);
  const [userTask, setUserTask] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [requiredInputs, setRequiredInputs] = useState<RequiredInputFields>({
    audience: "",
    timeframe: "",
    environment: "",
    fileNotes: "",
    other: "",
  });
  const [providerId, setProviderId] = useState(settings.defaultAiProviderId || "");
  const [model, setModel] = useState(settings.defaultModel || defaultRuntimeModel);
  const [maxOutputLength, setMaxOutputLength] = useState("1800");
  const [contextMode, setContextMode] = useState<AgentKitContextMode>(settings.preferredContextMode);
  const [contextTarget, setContextTarget] = useState<AgentKitContextTarget>("openai");
  const [validationProfile, setValidationProfile] = useState<ValidationProfile>(settings.preferredValidationProfile);
  const [validateBeforeRun, setValidateBeforeRun] = useState(true);
  const [includePolicies, setIncludePolicies] = useState(settings.includePolicies);
  const [includeTemplates, setIncludeTemplates] = useState(settings.includeTemplates);
  const [includeWorkflows, setIncludeWorkflows] = useState(settings.includeWorkflows);
  const [includeReferences, setIncludeReferences] = useState(settings.includeReferences);
  const [maxSkills, setMaxSkills] = useState("");
  const [runResult, setRunResult] = useState<RunAgentKitResult | null>(null);
  const [runCompletedAt, setRunCompletedAt] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [preRunValidationReport, setPreRunValidationReport] = useState<ValidationReport | null>(null);
  const [starterHint, setStarterHint] = useState<AgentKitStarterHint | null>(null);
  const [starterHintError, setStarterHintError] = useState<string | null>(null);
  const [savedResponsePath, setSavedResponsePath] = useState<string | null>(null);
  const [runFieldErrors, setRunFieldErrors] = useState<{
    apiKey?: string;
    providerId?: string;
    kitPath?: string;
    userTask?: string;
  }>({});
  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingStarterHint, setIsLoadingStarterHint] = useState(false);
  const [isSavingResponse, setIsSavingResponse] = useState(false);
  const [outputPath, setOutputPath] = useState(settings.defaultOutputFolder);
  const [result, setResult] = useState<ExportAgentKitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ kitPath?: string; outputPath?: string }>({});
  const [isSelectingKit, setIsSelectingKit] = useState(false);
  const [isSelectingOutput, setIsSelectingOutput] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [resultCopyState, setResultCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    setKitPath(currentKitPath);
  }, [currentKitPath]);

  useEffect(() => {
    const provider = getSelectedProvider(settings, providerId);
    setProviderId((current) => current || settings.defaultAiProviderId || "");
    setModel((current) => current || provider?.defaultModel || settings.defaultModel || defaultRuntimeModel);
    setContextMode(settings.preferredContextMode);
    setValidationProfile(settings.preferredValidationProfile);
    setIncludePolicies(settings.includePolicies);
    setIncludeTemplates(settings.includeTemplates);
    setIncludeWorkflows(settings.includeWorkflows);
    setIncludeReferences(settings.includeReferences);
    setOutputPath((current) => current || settings.defaultOutputFolder);
  }, [settings]);

  useEffect(() => {
    const trimmedPath = kitPath.trim();
    setStarterHint(null);
    setStarterHintError(null);

    if (!trimmedPath) {
      return;
    }

    let isCurrent = true;
    setIsLoadingStarterHint(true);

    invoke<AgentKitStarterHint | null>("get_agent_kit_starter_hint", { rootPath: trimmedPath })
      .then((hint) => {
        if (isCurrent) {
          setStarterHint(hint);
        }
      })
      .catch((caughtError) => {
        if (isCurrent) {
          setStarterHintError(errorToMessage(caughtError));
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoadingStarterHint(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [kitPath]);

  async function selectKitFolder() {
    setIsSelectingKit(true);
    setError(null);
    setRunError(null);

    try {
      const selectedPath = await invoke<string | null>("select_agent_kit_folder");
      if (selectedPath) {
        setKitPath(selectedPath);
        onKitPathChange(selectedPath);
        setResult(null);
        setRunResult(null);
        setFieldErrors((current) => ({ ...current, kitPath: undefined }));
        setRunFieldErrors((current) => ({ ...current, kitPath: undefined }));
      }
    } catch (caughtError) {
      const message = errorToMessage(caughtError);
      setError(message);
      setRunError(message);
    } finally {
      setIsSelectingKit(false);
    }
  }

  async function runInsideForge() {
    const validationErrors = validateRunForm(settings, providerId, kitPath, userTask);
    setRunFieldErrors(validationErrors);
    setRunError(null);
    setRunResult(null);
    setRunCompletedAt(null);
    setPreRunValidationReport(null);
    setSavedResponsePath(null);
    setResultCopyState("idle");

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsRunning(true);

    try {
      if (validateBeforeRun) {
        const validationReport = await invoke<ValidationReport>("validate_agent_kit", {
          rootPath: kitPath,
          profile: validationProfile,
        });
        setPreRunValidationReport(validationReport);

        if (!validationReport.valid) {
          setRunError(
            "Validation failed. Fix the issues below, or turn off Validate before running if you intentionally want to continue.",
          );
          return;
        }
      }

      const runtimeResult = await invoke<RunAgentKitResult>("run_agent_kit_with_ai", {
        input: {
          kitPath,
          userTask,
          additionalContext: combineAdditionalContext(requiredInputs, additionalContext),
          providerId,
          model,
          maxOutputLength: Number.parseInt(maxOutputLength, 10) || undefined,
          contextMode,
          target: contextTarget,
          includePolicies,
          includeTemplates,
          includeWorkflows,
          includeReferences,
          maxSkills: contextMode === "triggered" ? Number.parseInt(maxSkills, 10) || undefined : undefined,
        },
      });
      setRunResult(runtimeResult);
      setRunCompletedAt(new Date().toISOString());
    } catch (caughtError) {
      setRunError(errorToMessage(caughtError));
    } finally {
      setIsRunning(false);
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

  async function copyRunResult() {
    if (!runResult?.response) {
      return;
    }

    try {
      await navigator.clipboard.writeText(runResult.response);
      setResultCopyState("copied");
    } catch {
      setResultCopyState("failed");
    }
  }

  async function saveRunResult() {
    if (!runResult?.response) {
      return;
    }

    setIsSavingResponse(true);
    setRunError(null);

    try {
      const selectedPath = await invoke<string | null>("select_forge_response_output_path");
      if (!selectedPath) {
        return;
      }

      const saveResult = await invoke<{ filePath: string }>("save_markdown_file", {
        input: {
          content: formatRunResultMarkdown(
            runResult,
            runCompletedAt,
            kitPath,
            contextMode,
            validationProfile,
            validateBeforeRun,
          ),
        },
        outputPath: selectedPath,
      });
      setSavedResponsePath(saveResult.filePath);
    } catch (caughtError) {
      setRunError(errorToMessage(caughtError));
    } finally {
      setIsSavingResponse(false);
    }
  }

  async function saveRunResultText() {
    if (!runResult?.response) {
      return;
    }

    setIsSavingResponse(true);
    setRunError(null);

    try {
      const selectedPath = await invoke<string | null>("select_forge_response_text_output_path");
      if (!selectedPath) {
        return;
      }

      const saveResult = await invoke<{ filePath: string }>("save_markdown_file", {
        input: {
          content: runResult.response,
        },
        outputPath: selectedPath,
      });
      setSavedResponsePath(saveResult.filePath);
    } catch (caughtError) {
      setRunError(errorToMessage(caughtError));
    } finally {
      setIsSavingResponse(false);
    }
  }

  function clearRunResult() {
    setRunResult(null);
    setRunCompletedAt(null);
    setPreRunValidationReport(null);
    setRunError(null);
    setSavedResponsePath(null);
    setResultCopyState("idle");
  }

  return (
    <div className="use-screen">
      <div className="build-layout">
        <div className="form-panel">
          <h2>Use inside Forge</h2>

          {settings.aiProviders.length === 0 && (
            <div className="inline-warning">Add an AI provider in Settings before running.</div>
          )}

          <label htmlFor="runtime-kit">Select kit folder</label>
          <div className="path-picker">
            <input
              id="runtime-kit"
              onChange={(event) => {
                const nextPath = event.target.value;
                setKitPath(nextPath);
                onKitPathChange(nextPath);
                setRunResult(null);
                setResult(null);
              }}
              placeholder="Choose an Agent Kit"
              value={kitPath}
            />
            <button
              className="icon-button"
              disabled={isSelectingKit || isRunning || isExporting}
              onClick={selectKitFolder}
              title="Select kit folder"
              type="button"
            >
              <FolderOpen size={18} />
            </button>
          </div>
          <FieldError message={runFieldErrors.kitPath} />
          <FieldError message={runFieldErrors.apiKey} />

          <LabelWithHelp
            htmlFor="runtime-provider"
            label="AI provider"
            help="Choose the saved AI provider that will answer using this kit."
          />
          <select
            id="runtime-provider"
            onChange={(event) => {
              const provider = settings.aiProviders.find((item) => item.id === event.target.value);
              setProviderId(event.target.value);
              setModel(provider?.defaultModel || model);
              setRunResult(null);
              setRunError(null);
            }}
            value={providerId}
          >
            <option value="">Select provider</option>
            {settings.aiProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name} ({provider.providerType})
              </option>
            ))}
          </select>
          <FieldError message={runFieldErrors.providerId} />

          <LabelWithHelp
            htmlFor="runtime-task"
            label="Task"
            help="Describe what you need. The kit instructions and the details below will be included before sending."
          />
          <textarea
            id="runtime-task"
            onChange={(event) => {
              setUserTask(event.target.value);
              setRunResult(null);
            }}
            placeholder="Describe the specific work you want this kit to perform. Include the desired output, audience, and any constraints."
            rows={6}
            value={userTask}
          />
          <FieldError message={runFieldErrors.userTask} />

          <StarterHintPanel
            error={starterHintError}
            hint={starterHint}
            isLoading={isLoadingStarterHint}
          />

          <div className="required-inputs-panel">
            <div className="panel-heading">
              <h3>Additional required inputs</h3>
              <HelpTip text="Some kits need details such as audience, time period, project, or source-file notes. Add those here before running." />
            </div>
            <div className="settings-grid two-column">
              <div>
                <label htmlFor="required-audience">Audience</label>
                <input
                  id="required-audience"
                  onChange={(event) => setRequiredInputs((current) => ({ ...current, audience: event.target.value }))}
                  placeholder="Who is this for?"
                  value={requiredInputs.audience}
                />
              </div>
              <div>
                <label htmlFor="required-timeframe">Reporting period or timeframe</label>
                <input
                  id="required-timeframe"
                  onChange={(event) => setRequiredInputs((current) => ({ ...current, timeframe: event.target.value }))}
                  placeholder="Q2, this month, launch week..."
                  value={requiredInputs.timeframe}
                />
              </div>
              <div>
                <label htmlFor="required-environment">Project, environment, or account</label>
                <input
                  id="required-environment"
                  onChange={(event) => setRequiredInputs((current) => ({ ...current, environment: event.target.value }))}
                  placeholder="Project name, namespace, account type..."
                  value={requiredInputs.environment}
                />
              </div>
              <div>
                <label htmlFor="required-file-notes">Files or source material</label>
                <input
                  id="required-file-notes"
                  onChange={(event) => setRequiredInputs((current) => ({ ...current, fileNotes: event.target.value }))}
                  placeholder="Describe files for now; upload support comes later."
                  value={requiredInputs.fileNotes}
                />
              </div>
            </div>
            <label htmlFor="required-other">Other inputs</label>
            <textarea
              id="required-other"
              onChange={(event) => setRequiredInputs((current) => ({ ...current, other: event.target.value }))}
              placeholder="Any other required facts, assumptions, or constraints."
              rows={3}
              value={requiredInputs.other}
            />
          </div>

          <label htmlFor="runtime-context">Additional context</label>
          <textarea
            id="runtime-context"
            onChange={(event) => {
              setAdditionalContext(event.target.value);
              setRunResult(null);
            }}
            placeholder="Optional details such as source notes, assumptions, examples, or review criteria."
            rows={4}
            value={additionalContext}
          />

          <LabelWithHelp
            htmlFor="runtime-model"
            label="Model"
            help="Use the provider default, choose a suggestion, or enter a custom model ID."
          />
          <ModelInput
            id="runtime-model"
            model={model}
            onModelChange={setModel}
            providerType={getSelectedProvider(settings, providerId)?.providerType}
          />

          <details className="advanced-details">
            <summary>Advanced Settings</summary>
          <div className="settings-grid two-column">
            <div>
              <label htmlFor="runtime-context-mode">Context mode</label>
              <select
                id="runtime-context-mode"
                onChange={(event) => setContextMode(event.target.value as AgentKitContextMode)}
                value={contextMode}
              >
                {contextModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="runtime-target">Target</label>
              <select
                id="runtime-target"
                onChange={(event) => setContextTarget(event.target.value as AgentKitContextTarget)}
                value={contextTarget}
              >
                {contextTargets.map((target) => (
                  <option key={target} value={target}>
                    {target}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="settings-grid two-column">
            <div>
              <label htmlFor="runtime-validation-profile">Validation profile</label>
              <select
                id="runtime-validation-profile"
                onChange={(event) => setValidationProfile(event.target.value as ValidationProfile)}
                value={validationProfile}
              >
                {validationProfiles.map((profile) => (
                  <option key={profile} value={profile}>
                    {profile}
                  </option>
                ))}
              </select>
            </div>
            <label className="checkbox-row aligned-checkbox" htmlFor="runtime-validate-before-run">
              <input
                checked={validateBeforeRun}
                id="runtime-validate-before-run"
                onChange={(event) => setValidateBeforeRun(event.target.checked)}
                type="checkbox"
              />
              <span>Validate before running</span>
            </label>
          </div>

          <label htmlFor="runtime-max-skills">Max skills</label>
          <input
            disabled={contextMode !== "triggered"}
            id="runtime-max-skills"
            min="1"
            onChange={(event) => setMaxSkills(event.target.value)}
            placeholder="Optional for triggered mode"
            type="number"
            value={maxSkills}
          />

          <div className="checkbox-grid">
            <label className="checkbox-row" htmlFor="include-policies">
              <input
                checked={includePolicies}
                id="include-policies"
                onChange={(event) => setIncludePolicies(event.target.checked)}
                type="checkbox"
              />
              <span>Include policies</span>
            </label>
            <label className="checkbox-row" htmlFor="include-templates">
              <input
                checked={includeTemplates}
                id="include-templates"
                onChange={(event) => setIncludeTemplates(event.target.checked)}
                type="checkbox"
              />
              <span>Include templates</span>
            </label>
            <label className="checkbox-row" htmlFor="include-workflows">
              <input
                checked={includeWorkflows}
                id="include-workflows"
                onChange={(event) => setIncludeWorkflows(event.target.checked)}
                type="checkbox"
              />
              <span>Include workflows</span>
            </label>
            <label className="checkbox-row" htmlFor="include-references">
              <input
                checked={includeReferences}
                id="include-references"
                onChange={(event) => setIncludeReferences(event.target.checked)}
                type="checkbox"
              />
              <span>Include references</span>
            </label>
          </div>

          <label htmlFor="runtime-max-output">Max output tokens</label>
          <input
            id="runtime-max-output"
            min="256"
            onChange={(event) => setMaxOutputLength(event.target.value)}
            type="number"
            value={maxOutputLength}
          />
          </details>

          <PromptPreview
            additionalContext={additionalContext}
            requiredInputs={requiredInputs}
            userTask={userTask}
          />

          <button
            className="primary-button"
            disabled={isRunning}
            onClick={runInsideForge}
            type="button"
          >
            <PlayCircle size={18} />
            {isRunning ? "Running" : "Run with AI"}
          </button>
        </div>

        <div className="results-panel runtime-results-panel">
          <div className="panel-label">Forge Result</div>
          <ForgeRunResults
            copyState={resultCopyState}
            error={runError}
            isLoading={isRunning}
            isSavingResponse={isSavingResponse}
            onCopyResult={copyRunResult}
            onClearResult={clearRunResult}
            onSaveResult={saveRunResult}
            onSaveResultText={saveRunResultText}
            preRunValidationReport={preRunValidationReport}
            result={runResult}
            runCompletedAt={runCompletedAt}
            savedResponsePath={savedResponsePath}
            selectedContextMode={contextMode}
            selectedKitPath={kitPath}
            validationProfile={validationProfile}
          />
        </div>
      </div>

      <div className="build-layout">
        <div className="form-panel">
          <h2>Prepare for ChatGPT or Claude</h2>

          <label htmlFor="use-kit">Select kit folder</label>
          <div className="path-picker">
            <input
              id="use-kit"
              onChange={(event) => {
                const nextPath = event.target.value;
                setKitPath(nextPath);
                onKitPathChange(nextPath);
                setResult(null);
              }}
              placeholder="Choose an Agent Kit"
              value={kitPath}
            />
            <button
              className="icon-button"
              disabled={isSelectingKit || isExporting || isRunning}
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
      </div>
    </div>
  );
}

function PackageExportScreen({
  currentKitPath,
  onKitPathChange,
  onKitPackaged,
  settings,
}: {
  currentKitPath: string;
  onKitPathChange: (path: string) => void;
  onKitPackaged: (path: string) => void;
  settings: PublicSettings;
}) {
  const [kitPath, setKitPath] = useState(currentKitPath);
  const [outputFolder, setOutputFolder] = useState(settings.defaultOutputFolder);
  const [validationProfile, setValidationProfile] = useState<ValidationProfile>(
    settings.preferredValidationProfile,
  );
  const [validateBeforePackaging, setValidateBeforePackaging] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<{ kitPath?: string; outputFolder?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactResult[]>([]);
  const [isSelectingKit, setIsSelectingKit] = useState(false);
  const [isSelectingOutput, setIsSelectingOutput] = useState(false);
  const [isPackaging, setIsPackaging] = useState(false);
  const [isExportingOneFile, setIsExportingOneFile] = useState(false);
  const [copyState, setCopyState] = useState<string | null>(null);

  useEffect(() => {
    setKitPath(currentKitPath);
  }, [currentKitPath]);

  useEffect(() => {
    setOutputFolder((current) => current || settings.defaultOutputFolder);
    setValidationProfile(settings.preferredValidationProfile);
  }, [settings.defaultOutputFolder, settings.preferredValidationProfile]);

  async function selectKitFolder() {
    setIsSelectingKit(true);
    setError(null);

    try {
      const selectedPath = await invoke<string | null>("select_agent_kit_folder");
      if (selectedPath) {
        setKitPath(selectedPath);
        onKitPathChange(selectedPath);
        setValidationReport(null);
        setFieldErrors((current) => ({ ...current, kitPath: undefined }));
      }
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    } finally {
      setIsSelectingKit(false);
    }
  }

  async function selectOutputFolder() {
    setIsSelectingOutput(true);
    setError(null);

    try {
      const selectedPath = await invoke<string | null>("select_agent_kit_folder");
      if (selectedPath) {
        setOutputFolder(selectedPath);
        setFieldErrors((current) => ({ ...current, outputFolder: undefined }));
      }
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    } finally {
      setIsSelectingOutput(false);
    }
  }

  async function validateForPackaging() {
    const validationReport = await invoke<ValidationReport>("validate_agent_kit", {
      rootPath: kitPath,
      profile: validationProfile,
    });
    setValidationReport(validationReport);

    if (!validationReport.valid) {
      throw new Error(
        "Validation failed. Fix the reported issues or disable validation before packaging.",
      );
    }
  }

  async function packageZip() {
    const validationErrors = validatePackageExportForm(kitPath, outputFolder);
    setFieldErrors(validationErrors);
    setError(null);
    setCopyState(null);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsPackaging(true);

    try {
      if (validateBeforePackaging) {
        await validateForPackaging();
      } else {
        setValidationReport(null);
      }

      const result = await invoke<PackageAgentKitResult>("package_agent_kit", {
        input: { rootPath: kitPath, outputFolder },
      });
      onKitPackaged(kitPath);
      setArtifacts((current) => [
        { artifactPath: result.artifactPath, artifactType: ".agentkit.zip" },
        ...current,
      ]);
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    } finally {
      setIsPackaging(false);
    }
  }

  async function exportOneFile() {
    const validationErrors = validatePackageExportForm(kitPath, outputFolder);
    setFieldErrors(validationErrors);
    setError(null);
    setCopyState(null);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsExportingOneFile(true);

    try {
      const result = await invoke<ExportAgentKitResult>("export_agent_kit_onefile", {
        input: { rootPath: kitPath, outputPath: outputFolder },
      });
      setArtifacts((current) => [
        { artifactPath: result.filePath, artifactType: ".onefile.md" },
        ...current,
      ]);
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    } finally {
      setIsExportingOneFile(false);
    }
  }

  async function openOutputFolder() {
    if (outputFolder.trim() === "") {
      setError("Output folder is required.");
      return;
    }

    try {
      await invoke("open_folder", { path: outputFolder });
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    }
  }

  async function copyArtifactPath(artifactPath: string) {
    try {
      await navigator.clipboard.writeText(artifactPath);
      setCopyState(artifactPath);
    } catch {
      setError("Clipboard access failed. Select and copy the artifact path.");
    }
  }

  return (
    <div className="build-layout">
      <div className="form-panel">
        <h2>Package / Export</h2>

        <label htmlFor="package-kit-folder">Agent Kit folder</label>
        <div className="path-picker">
          <input
            id="package-kit-folder"
            onChange={(event) => {
              const nextPath = event.target.value;
              setKitPath(nextPath);
              onKitPathChange(nextPath);
              setValidationReport(null);
            }}
            placeholder="Choose an Agent Kit"
            value={kitPath}
          />
          <button
            className="icon-button"
            disabled={isSelectingKit || isPackaging || isExportingOneFile}
            onClick={selectKitFolder}
            title="Select kit folder"
            type="button"
          >
            <FolderOpen size={18} />
          </button>
        </div>
        <FieldError message={fieldErrors.kitPath} />

        <label htmlFor="package-output-folder">Output folder</label>
        <div className="path-picker">
          <input
            id="package-output-folder"
            onChange={(event) => setOutputFolder(event.target.value)}
            placeholder="C:\\kits\\exports"
            value={outputFolder}
          />
          <button
            className="icon-button"
            disabled={isSelectingOutput || isPackaging || isExportingOneFile}
            onClick={selectOutputFolder}
            title="Select output folder"
            type="button"
          >
            <FolderOpen size={18} />
          </button>
        </div>
        <FieldError message={fieldErrors.outputFolder} />

        <label className="checkbox-row" htmlFor="validate-before-package">
          <input
            checked={validateBeforePackaging}
            id="validate-before-package"
            onChange={(event) => setValidateBeforePackaging(event.target.checked)}
            type="checkbox"
          />
          <span>Run validation before packaging</span>
        </label>

        <label htmlFor="package-validation-profile">Validation profile</label>
        <select
          disabled={!validateBeforePackaging}
          id="package-validation-profile"
          onChange={(event) => setValidationProfile(event.target.value as ValidationProfile)}
          value={validationProfile}
        >
          {validationProfiles.map((profile) => (
            <option key={profile} value={profile}>
              {profile}
            </option>
          ))}
        </select>

        <div className="button-row">
          <button
            className="primary-button"
            disabled={isPackaging}
            onClick={packageZip}
            type="button"
          >
            <PackageOpen size={18} />
            {isPackaging ? "Packaging" : "Package .agentkit.zip"}
          </button>
          <button
            className="secondary-button"
            disabled={isExportingOneFile}
            onClick={exportOneFile}
            type="button"
          >
            <FileArchive size={18} />
            {isExportingOneFile ? "Exporting" : "Export .onefile.md"}
          </button>
        </div>
      </div>

      <div className="results-panel">
        <div className="panel-label">Artifacts</div>
        <PackageExportResults
          artifacts={artifacts}
          copyState={copyState}
          error={error}
          isLoading={isPackaging || isExportingOneFile}
          onCopyArtifactPath={copyArtifactPath}
          onOpenOutputFolder={openOutputFolder}
          validationReport={validationReport}
        />
      </div>
    </div>
  );
}

function InstallTargetsScreen({
  currentKitPath,
  onKitPathChange,
}: {
  currentKitPath: string;
  onKitPathChange: (path: string) => void;
}) {
  const [kitPath, setKitPath] = useState(currentKitPath);
  const [destinationSkillsDir, setDestinationSkillsDir] = useState("");
  const [force, setForce] = useState(false);
  const [claudeDestinationDir, setClaudeDestinationDir] = useState("");
  const [claudeForce, setClaudeForce] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ kitPath?: string; destinationSkillsDir?: string }>({});
  const [claudeFieldErrors, setClaudeFieldErrors] = useState<{ kitPath?: string; destinationDir?: string }>({});
  const [result, setResult] = useState<CodexExportResult | null>(null);
  const [claudeResult, setClaudeResult] = useState<ClaudeCodeExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claudeError, setClaudeError] = useState<string | null>(null);
  const [isSelectingKit, setIsSelectingKit] = useState(false);
  const [isSelectingDestination, setIsSelectingDestination] = useState(false);
  const [isSelectingClaudeDestination, setIsSelectingClaudeDestination] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingClaude, setIsExportingClaude] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [claudeCopyState, setClaudeCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    setKitPath(currentKitPath);
  }, [currentKitPath]);

  async function selectKitFolder() {
    setIsSelectingKit(true);
    setError(null);

    try {
      const selectedPath = await invoke<string | null>("select_agent_kit_folder");
      if (selectedPath) {
        setKitPath(selectedPath);
        onKitPathChange(selectedPath);
        setResult(null);
        setClaudeResult(null);
      }
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    } finally {
      setIsSelectingKit(false);
    }
  }

  async function selectDestinationFolder() {
    setIsSelectingDestination(true);
    setError(null);

    try {
      const selectedPath = await invoke<string | null>("select_agent_kit_folder");
      if (selectedPath) {
        setDestinationSkillsDir(selectedPath);
        setResult(null);
      }
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    } finally {
      setIsSelectingDestination(false);
    }
  }

  async function selectClaudeDestinationFolder() {
    setIsSelectingClaudeDestination(true);
    setClaudeError(null);

    try {
      const selectedPath = await invoke<string | null>("select_agent_kit_folder");
      if (selectedPath) {
        setClaudeDestinationDir(selectedPath);
        setClaudeResult(null);
      }
    } catch (caughtError) {
      setClaudeError(errorToMessage(caughtError));
    } finally {
      setIsSelectingClaudeDestination(false);
    }
  }

  async function exportToCodex() {
    const validationErrors = validateCodexExportForm(kitPath, destinationSkillsDir);
    setFieldErrors(validationErrors);
    setError(null);
    setResult(null);
    setCopyState("idle");

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsExporting(true);

    try {
      const exportResult = await invoke<CodexExportResult>("export_agent_kit_to_codex", {
        input: { kitPath, destinationSkillsDir, force },
      });
      setResult(exportResult);
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    } finally {
      setIsExporting(false);
    }
  }

  async function exportToClaudeCode() {
    const validationErrors = validateClaudeCodeExportForm(kitPath, claudeDestinationDir);
    setClaudeFieldErrors(validationErrors);
    setClaudeError(null);
    setClaudeResult(null);
    setClaudeCopyState("idle");

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsExportingClaude(true);

    try {
      const exportResult = await invoke<ClaudeCodeExportResult>("export_agent_kit_to_claude_code", {
        input: { kitPath, destinationDir: claudeDestinationDir, force: claudeForce },
      });
      setClaudeResult(exportResult);
    } catch (caughtError) {
      setClaudeError(errorToMessage(caughtError));
    } finally {
      setIsExportingClaude(false);
    }
  }

  async function openDestinationFolder() {
    try {
      await invoke("open_folder", { path: result?.destinationSkillsDir ?? destinationSkillsDir });
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
    }
  }

  async function openClaudeDestinationFolder() {
    try {
      await invoke("open_folder", { path: claudeResult?.destinationDir ?? claudeDestinationDir });
    } catch (caughtError) {
      setClaudeError(errorToMessage(caughtError));
    }
  }

  async function copyDestinationPath() {
    const path = result?.destinationSkillsDir ?? destinationSkillsDir;
    try {
      await navigator.clipboard.writeText(path);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  async function copyClaudeDestinationPath() {
    const path = claudeResult?.destinationDir ?? claudeDestinationDir;
    try {
      await navigator.clipboard.writeText(path);
      setClaudeCopyState("copied");
    } catch {
      setClaudeCopyState("failed");
    }
  }

  return (
    <div className="install-targets-screen">
      <div className="build-layout">
        <div className="form-panel">
          <h2>Export to Codex</h2>
          <p className="form-copy">
            This exports the Agent Kit's skills into a Codex-compatible skills directory so Codex can
            discover them in future sessions.
          </p>
          <p className="form-copy">
            AgentKitForge does not launch Codex or verify Codex loaded the skills.
          </p>

          <label htmlFor="codex-kit-folder">Agent Kit folder</label>
          <div className="path-picker">
            <input
              id="codex-kit-folder"
              onChange={(event) => {
                const nextPath = event.target.value;
                setKitPath(nextPath);
                onKitPathChange(nextPath);
                setResult(null);
                setClaudeResult(null);
              }}
              placeholder="Choose an Agent Kit"
              value={kitPath}
            />
            <button className="icon-button" disabled={isSelectingKit || isExporting || isExportingClaude} onClick={selectKitFolder} title="Select kit folder" type="button">
              <FolderOpen size={18} />
            </button>
          </div>
          <FieldError message={fieldErrors.kitPath} />

          <label htmlFor="codex-destination">Codex skills destination folder</label>
          <div className="path-picker">
            <input
              id="codex-destination"
              onChange={(event) => {
                setDestinationSkillsDir(event.target.value);
                setResult(null);
              }}
              placeholder="C:\\Users\\you\\.codex\\skills"
              value={destinationSkillsDir}
            />
            <button className="icon-button" disabled={isSelectingDestination || isExporting} onClick={selectDestinationFolder} title="Select Codex skills folder" type="button">
              <FolderOpen size={18} />
            </button>
          </div>
          <FieldError message={fieldErrors.destinationSkillsDir} />

          <label className="checkbox-row" htmlFor="codex-force">
            <input
              checked={force}
              id="codex-force"
              onChange={(event) => setForce(event.target.checked)}
              type="checkbox"
            />
            <span>Force overwrite AgentKitForge-generated folders</span>
          </label>

          <button className="primary-button" disabled={isExporting} onClick={exportToCodex} type="button">
            <Plug size={18} />
            {isExporting ? "Exporting" : "Export/Install to Codex"}
          </button>
        </div>

        <div className="results-panel">
          <div className="panel-label">Codex Export Result</div>
          <CodexExportResults
            copyState={copyState}
            error={error}
            isLoading={isExporting}
            onCopyDestinationPath={copyDestinationPath}
            onOpenDestinationFolder={openDestinationFolder}
            result={result}
          />
        </div>
      </div>

      <div className="build-layout">
        <div className="form-panel">
          <h2>Export to Claude Code</h2>
          <p className="form-copy">
            This exports the Agent Kit into a Claude Code plugin-style folder.
          </p>
          <p className="form-copy">
            AgentKitForge does not launch Claude Code or verify Claude Code loaded the plugin.
            This is an initial adapter; verify plugin loading behavior in Claude Code.
          </p>

          <label htmlFor="claude-kit-folder">Agent Kit folder</label>
          <div className="path-picker">
            <input
              id="claude-kit-folder"
              onChange={(event) => {
                const nextPath = event.target.value;
                setKitPath(nextPath);
                onKitPathChange(nextPath);
                setResult(null);
                setClaudeResult(null);
              }}
              placeholder="Choose an Agent Kit"
              value={kitPath}
            />
            <button className="icon-button" disabled={isSelectingKit || isExporting || isExportingClaude} onClick={selectKitFolder} title="Select kit folder" type="button">
              <FolderOpen size={18} />
            </button>
          </div>
          <FieldError message={claudeFieldErrors.kitPath} />

          <label htmlFor="claude-destination">Claude Code plugins destination folder</label>
          <div className="path-picker">
            <input
              id="claude-destination"
              onChange={(event) => {
                setClaudeDestinationDir(event.target.value);
                setClaudeResult(null);
              }}
              placeholder="C:\\Users\\you\\.claude\\plugins"
              value={claudeDestinationDir}
            />
            <button className="icon-button" disabled={isSelectingClaudeDestination || isExportingClaude} onClick={selectClaudeDestinationFolder} title="Select Claude Code plugins folder" type="button">
              <FolderOpen size={18} />
            </button>
          </div>
          <FieldError message={claudeFieldErrors.destinationDir} />

          <label className="checkbox-row" htmlFor="claude-force">
            <input
              checked={claudeForce}
              id="claude-force"
              onChange={(event) => setClaudeForce(event.target.checked)}
              type="checkbox"
            />
            <span>Force overwrite AgentKitForge-generated plugin folder</span>
          </label>

          <button className="primary-button" disabled={isExportingClaude} onClick={exportToClaudeCode} type="button">
            <Plug size={18} />
            {isExportingClaude ? "Exporting" : "Export/Install to Claude Code"}
          </button>
        </div>

        <div className="results-panel">
          <div className="panel-label">Claude Code Export Result</div>
          <ClaudeCodeExportResults
            copyState={claudeCopyState}
            error={claudeError}
            isLoading={isExportingClaude}
            onCopyDestinationPath={copyClaudeDestinationPath}
            onOpenDestinationFolder={openClaudeDestinationFolder}
            result={claudeResult}
          />
        </div>
      </div>
    </div>
  );
}

function CodexExportResults({
  copyState,
  error,
  isLoading,
  onCopyDestinationPath,
  onOpenDestinationFolder,
  result,
}: {
  copyState: "idle" | "copied" | "failed";
  error: string | null;
  isLoading: boolean;
  onCopyDestinationPath: () => void;
  onOpenDestinationFolder: () => void;
  result: CodexExportResult | null;
}) {
  if (isLoading) {
    return <p className="state-copy">Exporting Codex skills...</p>;
  }

  if (error) {
    return (
      <div className="error-state" role="alert">
        {error}
      </div>
    );
  }

  if (!result) {
    return <p className="state-copy">Export a kit to see Codex skill folders here.</p>;
  }

  return (
    <div className="artifact-results">
      <div className="status-banner valid">
        <strong>Exported</strong>
        <span>{result.exportedSkillFolders.length} skill folder{result.exportedSkillFolders.length === 1 ? "" : "s"}</span>
      </div>

      <dl className="report-meta">
        <div>
          <dt>Destination skills directory</dt>
          <dd>{result.destinationSkillsDir}</dd>
        </div>
        <div>
          <dt>Generated index folder</dt>
          <dd>{result.generatedIndexFolder || "None"}</dd>
        </div>
      </dl>

      {result.warnings.length > 0 && (
        <div className="inline-warning">
          {result.warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      )}

      <div className="button-row">
        <button className="secondary-button compact-button" onClick={onOpenDestinationFolder} type="button">
          Open destination folder
        </button>
        <button className="secondary-button compact-button" onClick={onCopyDestinationPath} type="button">
          Copy destination path
        </button>
      </div>
      {copyState === "copied" && <div className="copy-state">Destination path copied.</div>}
      {copyState === "failed" && <div className="field-error">Clipboard access failed.</div>}

      <div className="created-files">
        <h3>Exported skill folders</h3>
        <ul>
          {result.exportedSkillFolders.map((folder) => (
            <li key={folder}>{folder}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ClaudeCodeExportResults({
  copyState,
  error,
  isLoading,
  onCopyDestinationPath,
  onOpenDestinationFolder,
  result,
}: {
  copyState: "idle" | "copied" | "failed";
  error: string | null;
  isLoading: boolean;
  onCopyDestinationPath: () => void;
  onOpenDestinationFolder: () => void;
  result: ClaudeCodeExportResult | null;
}) {
  if (isLoading) {
    return <p className="state-copy">Exporting Claude Code plugin...</p>;
  }

  if (error) {
    return (
      <div className="error-state" role="alert">
        {error}
      </div>
    );
  }

  if (!result) {
    return <p className="state-copy">Export a kit to see Claude Code plugin files here.</p>;
  }

  return (
    <div className="artifact-results">
      <div className="status-banner valid">
        <strong>Exported</strong>
        <span>{result.exportedSkillFolders.length} skill folder{result.exportedSkillFolders.length === 1 ? "" : "s"}</span>
      </div>

      <dl className="report-meta">
        <div>
          <dt>Destination directory</dt>
          <dd>{result.destinationDir}</dd>
        </div>
        <div>
          <dt>Generated plugin folder</dt>
          <dd>{result.pluginFolder}</dd>
        </div>
        <div>
          <dt>Plugin manifest path</dt>
          <dd>{result.pluginManifestPath}</dd>
        </div>
      </dl>

      {result.warnings.length > 0 && (
        <div className="inline-warning">
          {result.warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      )}

      <div className="button-row">
        <button className="secondary-button compact-button" onClick={onOpenDestinationFolder} type="button">
          Open destination folder
        </button>
        <button className="secondary-button compact-button" onClick={onCopyDestinationPath} type="button">
          Copy destination path
        </button>
      </div>
      {copyState === "copied" && <div className="copy-state">Destination path copied.</div>}
      {copyState === "failed" && <div className="field-error">Clipboard access failed.</div>}

      <div className="created-files">
        <h3>Exported skill folders</h3>
        <ul>
          {result.exportedSkillFolders.map((folder) => (
            <li key={folder}>{folder}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PackageExportResults({
  artifacts,
  copyState,
  error,
  isLoading,
  onCopyArtifactPath,
  onOpenOutputFolder,
  validationReport,
}: {
  artifacts: ArtifactResult[];
  copyState: string | null;
  error: string | null;
  isLoading: boolean;
  onCopyArtifactPath: (artifactPath: string) => void;
  onOpenOutputFolder: () => void;
  validationReport: ValidationReport | null;
}) {
  if (isLoading && artifacts.length === 0 && !error) {
    return <p className="state-copy">Creating artifact...</p>;
  }

  return (
    <div className="artifact-results">
      {error && (
        <div className="error-state" role="alert">
          {error}
        </div>
      )}

      {validationReport && (
        <div className={`status-banner ${validationReport.valid ? "valid" : "invalid"}`}>
          <strong>{validationReport.valid ? "Validation passed" : "Validation failed"}</strong>
          <span>{validationReport.profile}</span>
        </div>
      )}

      {artifacts.length === 0 ? (
        <p className="state-copy">
          Package an Agent Kit as a distributable zip or export a one-file Markdown bundle.
        </p>
      ) : (
        <>
          <button className="secondary-button compact-button" onClick={onOpenOutputFolder} type="button">
            Open output folder
          </button>
          <div className="artifact-list">
            {artifacts.map((artifact) => (
              <article className="artifact-item" key={`${artifact.artifactType}-${artifact.artifactPath}`}>
                <div>
                  <div className="issue-code">{artifact.artifactType}</div>
                  <p>{artifact.artifactPath}</p>
                  {copyState === artifact.artifactPath && (
                    <div className="copy-state">Artifact path copied.</div>
                  )}
                </div>
                <button
                  className="secondary-button compact-button"
                  onClick={() => onCopyArtifactPath(artifact.artifactPath)}
                  type="button"
                >
                  Copy path
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ForgeRunResults({
  copyState,
  error,
  isLoading,
  isSavingResponse,
  onCopyResult,
  onClearResult,
  onSaveResult,
  onSaveResultText,
  preRunValidationReport,
  result,
  runCompletedAt,
  savedResponsePath,
  selectedContextMode,
  selectedKitPath,
  validationProfile,
}: {
  copyState: "idle" | "copied" | "failed";
  error: string | null;
  isLoading: boolean;
  isSavingResponse: boolean;
  onCopyResult: () => void;
  onClearResult: () => void;
  onSaveResult: () => void;
  onSaveResultText: () => void;
  preRunValidationReport: ValidationReport | null;
  result: RunAgentKitResult | null;
  runCompletedAt: string | null;
  savedResponsePath: string | null;
  selectedContextMode: AgentKitContextMode;
  selectedKitPath: string;
  validationProfile: ValidationProfile;
}) {
  if (isLoading) {
    return <p className="state-copy">Validating the kit and running it with OpenAI...</p>;
  }

  if (error && !result) {
    return (
      <div className="forge-result">
        <div className="error-state" role="alert">
          {error}
        </div>
        {preRunValidationReport && (
          <ValidationResults error={null} isLoading={false} report={preRunValidationReport} />
        )}
      </div>
    );
  }

  if (!result) {
    return (
      <p className="state-copy">
        Select a kit, describe the task, and run it inside Forge. Triggered context uses matching
        skills first and shows a warning if it falls back.
      </p>
    );
  }

  return (
    <div className="forge-result">
      <div className="status-banner valid">
        <strong>Complete</strong>
        <span>{result.providerName} · {result.model}</span>
      </div>

      <div className="panel-heading">
        <h3>Response</h3>
        <div className="button-row">
          <button className="secondary-button compact-button" onClick={onCopyResult} type="button">
            Copy response
          </button>
          <button
            className="secondary-button compact-button"
            disabled={isSavingResponse}
            onClick={onSaveResult}
            type="button"
          >
            {isSavingResponse ? "Saving" : "Download as Markdown"}
          </button>
          <button
            className="secondary-button compact-button"
            disabled={isSavingResponse}
            onClick={onSaveResultText}
            type="button"
          >
            Download as Text
          </button>
          <button className="secondary-button compact-button" onClick={onClearResult} type="button">
            Clear
          </button>
        </div>
      </div>

      <div className="assistant-response">{result.response}</div>
      {copyState === "copied" && <div className="copy-state">Copied to clipboard.</div>}
      {copyState === "failed" && (
        <div className="field-error">Clipboard access failed. Select and copy the result text.</div>
      )}
      {savedResponsePath && <div className="copy-state">Saved to {savedResponsePath}</div>}
      {error && (
        <div className="error-state" role="alert">
          {error}
        </div>
      )}

      <RunMetadata
        result={result}
        runCompletedAt={runCompletedAt}
        selectedContextMode={selectedContextMode}
        selectedKitPath={selectedKitPath}
        validationProfile={validationProfile}
      />

      <details className="context-details">
        <summary>Context details</summary>
        <dl className="report-meta">
          <div>
            <dt>Approx. context length</dt>
            <dd>{result.context.approximateContextLength.toLocaleString()} characters</dd>
          </div>
          <div>
            <dt>Included skills</dt>
            <dd>{result.context.includedSkills.length > 0 ? result.context.includedSkills.join(", ") : "None"}</dd>
          </div>
        </dl>

        {result.context.warnings.length > 0 && (
          <div className="inline-warning">
            {result.context.warnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        )}

        <div className="created-files">
          <h3>Included files</h3>
          <ul>
            {result.context.includedFiles.map((file) => (
              <li key={file}>{file}</li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}

function StarterHintPanel({
  error,
  hint,
  isLoading,
}: {
  error: string | null;
  hint: AgentKitStarterHint | null;
  isLoading: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  if (isLoading) {
    return <p className="state-copy compact-state">Checking for starter guidance...</p>;
  }

  if (error) {
    return null;
  }

  if (!hint) {
    return null;
  }

  async function copyHint() {
    if (!hint) {
      return;
    }
    try {
      await navigator.clipboard.writeText(hint.excerpt);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="starter-hint-panel">
      <div className="panel-heading">
        <strong>Starter hint from {hint.sourceFile}</strong>
        <div className="button-row">
          <button className="secondary-button compact-button" onClick={copyHint} type="button">
            Copy
          </button>
          <button className="secondary-button compact-button" onClick={() => setIsExpanded((current) => !current)} type="button">
            {isExpanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>
      <div className={`starter-hint-copy ${isExpanded ? "expanded" : ""}`}>{hint.excerpt}</div>
      {copyState === "copied" && <div className="copy-state">Starter hint copied.</div>}
      {copyState === "failed" && <div className="field-error">Clipboard access failed.</div>}
    </div>
  );
}

function RunMetadata({
  result,
  runCompletedAt,
  selectedContextMode,
  selectedKitPath,
  validationProfile,
}: {
  result: RunAgentKitResult;
  runCompletedAt: string | null;
  selectedContextMode: AgentKitContextMode;
  selectedKitPath: string;
  validationProfile: ValidationProfile;
}) {
  return (
    <dl className="report-meta run-meta">
      <div>
        <dt>Kit</dt>
        <dd>{result.kitName || selectedKitPath || "Selected kit"}</dd>
      </div>
      <div>
        <dt>Provider</dt>
        <dd>{result.providerName}</dd>
      </div>
      <div>
        <dt>Model</dt>
        <dd>{result.model}</dd>
      </div>
      <div>
        <dt>Context mode</dt>
        <dd>{selectedContextMode}</dd>
      </div>
      <div>
        <dt>Validation profile</dt>
        <dd>{validationProfile}</dd>
      </div>
      <div>
        <dt>Included skills</dt>
        <dd>{result.context.includedSkills.length > 0 ? result.context.includedSkills.join(", ") : "None"}</dd>
      </div>
      <div>
        <dt>Included files</dt>
        <dd>{result.context.includedFiles.length}</dd>
      </div>
      <div>
        <dt>Warnings</dt>
        <dd>{result.context.warnings.length}</dd>
      </div>
      <div>
        <dt>Timestamp</dt>
        <dd>{runCompletedAt ? new Date(runCompletedAt).toLocaleString() : "Just now"}</dd>
      </div>
    </dl>
  );
}

function PromptPreview({
  additionalContext,
  requiredInputs,
  userTask,
}: {
  additionalContext: string;
  requiredInputs: RequiredInputFields;
  userTask: string;
}) {
  const preview = buildPlannedPrompt(userTask, requiredInputs, additionalContext);
  return (
    <details className="context-details prompt-preview">
      <summary>Prompt preview</summary>
      <p className="form-copy">
        This is the user-facing request AgentKitForge will combine with the selected kit context.
      </p>
      <pre className="json-panel">{preview || "Add a task to preview the planned prompt."}</pre>
    </details>
  );
}

function combineAdditionalContext(requiredInputs: RequiredInputFields, additionalContext: string) {
  return [formatRequiredInputs(requiredInputs), additionalContext.trim()]
    .filter(Boolean)
    .join("\n\n");
}

function buildPlannedPrompt(
  userTask: string,
  requiredInputs: RequiredInputFields,
  additionalContext: string,
) {
  return [
    userTask.trim() ? `Main task:\n${userTask.trim()}` : "",
    formatRequiredInputs(requiredInputs),
    additionalContext.trim() ? `Additional context:\n${additionalContext.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatRequiredInputs(requiredInputs: RequiredInputFields) {
  const rows = [
    ["Audience", requiredInputs.audience],
    ["Reporting period or timeframe", requiredInputs.timeframe],
    ["Project, environment, or account", requiredInputs.environment],
    ["Files or source material", requiredInputs.fileNotes],
    ["Other inputs", requiredInputs.other],
  ].filter(([, value]) => value.trim() !== "");

  if (rows.length === 0) {
    return "";
  }

  return `Additional required inputs:\n${rows
    .map(([label, value]) => `- ${label}: ${value.trim()}`)
    .join("\n")}`;
}

function friendlyFileName(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

function friendlyLocation(path: string) {
  const parts = path.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 1) {
    return path;
  }
  return `${parts[parts.length - 2]} / ${parts[parts.length - 1]}`;
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
        assistant. If you choose a folder, AgentKitForge uses the default name
        <span className="inline-code"> &lt;kit-id&gt;-&lt;version&gt;.onefile.md</span>.
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
          <dd>{friendlyFileName(result.filePath)}</dd>
        </div>
      </dl>
      <details className="advanced-details">
        <summary>Advanced details</summary>
        <dl className="report-meta">
          <div>
            <dt>Full path</dt>
            <dd>{result.filePath}</dd>
          </div>
        </dl>
      </details>

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

function validatePackageExportForm(kitPath: string, outputFolder: string) {
  const errors: { kitPath?: string; outputFolder?: string } = {};

  if (kitPath.trim() === "") {
    errors.kitPath = "Kit folder is required.";
  }

  if (outputFolder.trim() === "") {
    errors.outputFolder = "Output folder is required.";
  }

  return errors;
}

function validateCodexExportForm(kitPath: string, destinationSkillsDir: string) {
  const errors: { kitPath?: string; destinationSkillsDir?: string } = {};

  if (kitPath.trim() === "") {
    errors.kitPath = "Kit folder is required.";
  }

  if (destinationSkillsDir.trim() === "") {
    errors.destinationSkillsDir = "Codex skills destination folder is required.";
  }

  return errors;
}

function validateClaudeCodeExportForm(kitPath: string, destinationDir: string) {
  const errors: { kitPath?: string; destinationDir?: string } = {};

  if (kitPath.trim() === "") {
    errors.kitPath = "Kit folder is required.";
  }

  if (destinationDir.trim() === "") {
    errors.destinationDir = "Claude Code plugins destination folder is required.";
  }

  return errors;
}

function formatValidationState(kit: MyKitEntry) {
  if (kit.lastValidationValid === undefined || kit.lastValidationValid === null) {
    return "Not validated";
  }

  return `${kit.lastValidationValid ? "Valid" : "Invalid"} (${kit.lastValidatedProfile ?? "unknown"})`;
}

function formatTimestamp(value?: string) {
  if (!value) {
    return "Never";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return value;
  }

  return new Date(numeric * 1000).toLocaleString();
}

function validateRunForm(settings: PublicSettings, providerId: string, kitPath: string, userTask: string) {
  const errors: { apiKey?: string; providerId?: string; kitPath?: string; userTask?: string } = {};

  if (settings.aiProviders.length === 0) {
    errors.apiKey = "AI provider is required. Add one in Settings first.";
  }

  if (providerId.trim() === "") {
    errors.providerId = "AI provider is required.";
  }

  if (kitPath.trim() === "") {
    errors.kitPath = "Kit folder is required.";
  }

  if (userTask.trim() === "") {
    errors.userTask = "Task is required.";
  }

  return errors;
}

function createDefaultGuidedBuilderState(outputFolder: string): GuidedBuilderState {
  return {
    name: "",
    id: "",
    description: "",
    domain: "",
    targetUsers: "",
    validationLevel: "local-valid",
    outputFolder,
    skills: [createDefaultGuidedSkill(1)],
    guardrails: [],
    outputSections: "Summary\nKey findings\nRecommended next steps",
    outputTemplate: "",
    documentLike: true,
    downloadFileName: "agent-kit-output",
    summaryStyle: "Clear, practical, and user-facing",
    requiredInputs: [createDefaultRequiredInput(1)],
    examples: [createDefaultExample(1)],
    force: false,
  };
}

function createDefaultGuidedSkill(index: number): GuidedSkill {
  return {
    id: `skill-${index}`,
    name: "",
    description: "",
    triggers: "",
    useWhen: "",
    doNotUseWhen: "",
    inputs: "",
    procedure: "",
    output: "",
    riskLevel: "low",
  };
}

function createDefaultRequiredInput(index: number): GuidedRequiredInput {
  return {
    id: `input-${index}`,
    label: "",
    description: "",
    required: true,
    inputType: "short-text",
    placeholder: "",
    includeInPrompt: true,
    choices: "",
  };
}

function createDefaultExample(index: number): GuidedExample {
  return {
    id: `example-${index}`,
    prompt: "",
    requiredInputExamples: "",
    output: "",
  };
}

function validateGuidedBuilder(form: GuidedBuilderState) {
  if (!form.name.trim()) {
    return "Kit name is required.";
  }
  if (!form.id.trim()) {
    return "Kit ID is required.";
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(form.id.trim())) {
    return "Kit ID must use lowercase letters, numbers, and hyphens.";
  }
  if (!form.description.trim()) {
    return "Description is required.";
  }
  if (!form.outputFolder.trim()) {
    return "Save location is required.";
  }
  const validSkills = form.skills.filter((skill) => skill.name.trim() && skill.description.trim());
  if (validSkills.length === 0) {
    return "Add at least one skill with a name and description.";
  }
  for (const skill of validSkills) {
    if (!skill.triggers.trim() || !skill.useWhen.trim() || !skill.procedure.trim() || !skill.output.trim()) {
      return `Complete triggers, use when, procedure, and output expectations for ${skill.name}.`;
    }
  }
  return null;
}

function buildGuidedAgentKitDraft(form: GuidedBuilderState) {
  const requiredInputs = form.requiredInputs
    .filter((input) => input.label.trim())
    .map((input) => ({
      id: input.id || slugify(input.label),
      label: input.label,
      description: input.description,
      required: input.required,
      inputType: input.inputType,
      placeholder: input.placeholder,
      includeInPrompt: input.includeInPrompt,
      choices: splitLines(input.choices),
    }));
  const outputConfig = {
    documentLike: form.documentLike,
    suggestedDownloadName: form.downloadFileName,
    summaryStyle: form.summaryStyle,
    outputSections: splitLines(form.outputSections),
  };
  const guardrails = form.guardrails.map((item) => item.text.trim()).filter(Boolean);
  const skills = form.skills
    .filter((skill) => skill.name.trim() && skill.description.trim())
    .map((skill, index) => ({
      id: skill.id || slugify(skill.name) || `skill-${index + 1}`,
      name: skill.name.trim(),
      description: skill.description.trim(),
      triggers: splitLines(skill.triggers).length > 0 ? splitLines(skill.triggers) : [skill.name.trim()],
      riskLevel: skill.riskLevel || "low",
      useWhen: withOptionalSections(skill.useWhen, [
        ["Do not use when", skill.doNotUseWhen],
        ["Inputs", skill.inputs],
      ]),
      procedure: skill.procedure.trim(),
      output: withOptionalSections(skill.output, [
        ["Expected output sections", form.outputSections],
        ["Output template", form.outputTemplate],
      ]),
    }));
  const examples = form.examples
    .filter((example) => example.prompt.trim())
    .map((example, index) => ({
      id: example.id || `example-${index + 1}`,
      prompt: withOptionalSections(example.prompt, [["Required input examples", example.requiredInputExamples]]),
      output: example.output.trim() || undefined,
    }));
  const policies = guardrails.length > 0 ? [{ id: "guardrails", description: "Guided Builder guardrails", rules: guardrails }] : [];
  const templates = [
    {
      id: "agentkitforge-required-inputs",
      path: "agentkitforge/required-inputs.json",
      content: JSON.stringify({ requiredInputs, outputConfig }, null, 2),
    },
  ];

  if (form.outputTemplate.trim()) {
    templates.push({
      id: "output-template",
      path: "output-template.md",
      content: form.outputTemplate,
    });
  }

  return {
    schemaVersion: "0.1",
    id: form.id,
    name: form.name,
    version: "0.1.0",
    description: form.description,
    author: { name: "AgentKitForge Guided Builder" },
    license: "MIT",
    setupLevel: "low",
    compatibilityTargets: ["codex", "chatgpt", "claude"],
    riskLevel: highestRiskLevel(skills.map((skill) => skill.riskLevel)),
    agentInstructions: renderGuidedAgentInstructions(form, guardrails, requiredInputs),
    startHere: renderGuidedStartHere(form, requiredInputs),
    readme: renderGuidedReadme(form, requiredInputs),
    changelog: "# Changelog\n\n## 0.1.0\n\nInitial Guided Builder kit.\n",
    skills,
    policies,
    examples,
    templates,
  };
}

function renderGuidedAgentInstructions(
  form: GuidedBuilderState,
  guardrails: string[],
  requiredInputs: Array<{ label: string; description: string; required: boolean; includeInPrompt: boolean }>,
) {
  return `# ${form.name}

${form.description}

## Domain

${form.domain || "General"}

## Target users

${form.targetUsers || "General users"}

## Required inputs

${requiredInputs.length > 0 ? requiredInputs.map((input) => `- ${input.label}${input.required ? " (required)" : " (optional)"}: ${input.description || "User-provided context."}`).join("\n") : "- Ask clarifying questions if important details are missing."}

## Guardrails

${guardrails.length > 0 ? guardrails.map((guardrail) => `- ${guardrail}`).join("\n") : "- Flag uncertainty and avoid unsupported claims."}

## Output behavior

- Summary style: ${form.summaryStyle || "Clear and practical"}.
- Document-like output: ${form.documentLike ? "yes" : "no"}.
- Suggested downloadable output name: ${form.downloadFileName || `${form.id}-output`}.
`;
}

function renderGuidedStartHere(form: GuidedBuilderState, requiredInputs: Array<{ label: string; required: boolean }>) {
  return `# ${form.name}

${form.description}

Use this kit for ${form.domain || "general business"} work with ${form.targetUsers || "the intended users"}.

Before running, collect:

${requiredInputs.length > 0 ? requiredInputs.map((input) => `- ${input.label}${input.required ? " (required)" : " (optional)"}`).join("\n") : "- The user's task and any relevant context."}
`;
}

function renderGuidedReadme(form: GuidedBuilderState, requiredInputs: Array<{ label: string; description: string; required: boolean }>) {
  return `# ${form.name}

${form.description}

## Domain

${form.domain || "General"}

## Target users

${form.targetUsers || "General users"}

## Required inputs

${requiredInputs.length > 0 ? requiredInputs.map((input) => `- **${input.label}**${input.required ? " (required)" : " (optional)"}: ${input.description || "User-provided context."}`).join("\n") : "No additional required inputs were defined."}

## Output style

${form.summaryStyle || "Clear and practical"}
`;
}

function guidedDefaultValidationProfile(form: GuidedBuilderState): ValidationProfile {
  if (form.guardrails.some((guardrail) => guardrail.text.trim()) && form.examples.some((example) => example.prompt.trim())) {
    return "trusted";
  }
  return form.validationLevel === "verified" ? "trusted" : form.validationLevel;
}

function guidedTargetOutputFolder(form: GuidedBuilderState) {
  const root = form.outputFolder.trim();
  const folderName = form.id.trim() || slugify(form.name) || "agent-kit";
  if (!root) {
    return folderName;
  }
  if (root.endsWith("\\") || root.endsWith("/")) {
    return `${root}${folderName}`;
  }
  return `${root}${root.includes("\\") ? "\\" : "/"}${folderName}`;
}

function guardrailPresetForDomain(domain: string) {
  const normalized = domain.toLowerCase();
  if (normalized.includes("finance") || normalized.includes("accounting")) {
    return "Do not provide tax, legal, audit, or assurance guarantees. Require qualified human review before decisions are made.";
  }
  if (normalized.includes("legal")) {
    return "Do not provide legal advice. Require attorney review before relying on legal conclusions.";
  }
  if (normalized.includes("health") || normalized.includes("medical")) {
    return "Do not provide medical advice. Require clinician review before relying on medical or patient-facing conclusions.";
  }
  if (normalized.includes("devops") || normalized.includes("sre")) {
    return "Operate read-only by default. Require explicit approval before destructive, production, or irreversible actions.";
  }
  if (normalized.includes("security")) {
    return "Only assist authorized work. Do not execute or facilitate exploit activity without clear permission and scope.";
  }
  if (normalized.includes("compliance")) {
    return "Require human review and do not claim certification, compliance status, or audit readiness without evidence.";
  }
  if (normalized.includes("hr") || normalized.includes("recruiting")) {
    return "Avoid discriminatory screening or protected-class inferences. Require human review for employment decisions.";
  }
  return "Flag uncertainty, cite assumptions, and avoid unsupported claims.";
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function splitLines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function withOptionalSections(base: string, sections: Array<[string, string]>) {
  const content = [base.trim()];
  for (const [title, value] of sections) {
    if (value.trim()) {
      content.push(`## ${title}\n\n${value.trim()}`);
    }
  }
  return content.filter(Boolean).join("\n\n");
}

function highestRiskLevel(values: string[]) {
  if (values.includes("high")) {
    return "high";
  }
  if (values.includes("medium")) {
    return "medium";
  }
  return "low";
}

function formatRunResultMarkdown(
  result: RunAgentKitResult,
  runCompletedAt: string | null,
  kitPath: string,
  contextMode: AgentKitContextMode,
  validationProfile: ValidationProfile,
  validateBeforeRun: boolean,
) {
  const timestamp = runCompletedAt ?? new Date().toISOString();
  const warnings =
    result.context.warnings.length > 0
      ? result.context.warnings.map((warning) => `- ${warning}`).join("\n")
      : "- None";
  const skills =
    result.context.includedSkills.length > 0
      ? result.context.includedSkills.map((skill) => `- ${skill}`).join("\n")
      : "- None";
  const files =
    result.context.includedFiles.length > 0
      ? result.context.includedFiles.map((file) => `- ${file}`).join("\n")
      : "- None";

  return `# AgentKitForge Response

## Metadata

- Kit: ${result.kitName || kitPath || "Selected kit"}
- Kit path: ${kitPath || "Unknown"}
- Model: ${result.model}
- Provider: ${result.providerName}
- Context mode: ${contextMode}
- Validation: ${validateBeforeRun ? validationProfile : "Skipped"}
- Timestamp: ${timestamp}
- Approximate context length: ${result.context.approximateContextLength} characters

## Response

${result.response.trim()}

## Included Skills

${skills}

## Included Files

${files}

## Warnings

${warnings}
`;
}

function ModelInput({
  id,
  model,
  onModelChange,
  providerType,
}: {
  id: string;
  model: string;
  onModelChange: (value: string) => void;
  providerType?: AiProviderType;
}) {
  const models = providerType ? getKnownModelsForProvider(providerType) : [];
  return (
    <div className="model-input">
      {models.length > 0 && (
        <select
          aria-label="Known model suggestions"
          onChange={(event) => {
            if (event.target.value) {
              onModelChange(event.target.value);
            }
          }}
          value={models.some((knownModel) => knownModel.id === model) ? model : ""}
        >
          <option value="">Custom model ID</option>
          {models.map((knownModel) => (
            <option key={knownModel.id} value={knownModel.id}>
              {knownModel.label}
            </option>
          ))}
        </select>
      )}
      <input
        id={id}
        onChange={(event) => onModelChange(event.target.value)}
        placeholder={providerType === "openai-compatible" ? "Enter model ID" : "Model ID"}
        value={model}
      />
    </div>
  );
}

function LabelWithHelp({
  help,
  htmlFor,
  label,
}: {
  help: string;
  htmlFor: string;
  label: string;
}) {
  return (
    <label className="label-with-help" htmlFor={htmlFor}>
      <span>{label}</span>
      <HelpTip text={help} />
    </label>
  );
}

function HelpTip({ text }: { text: string }) {
  return (
    <span className="help-tip" tabIndex={0}>
      ?
      <span className="help-tip-content">{text}</span>
    </span>
  );
}

function DomainSelector({
  id,
  onChange,
  value,
}: {
  id: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const matches = knownDomains
    .filter((domain) => domain.toLowerCase().includes(value.trim().toLowerCase()))
    .slice(0, 8);
  const suggestions = value.trim() === "" ? knownDomains.slice(0, 8) : matches;

  return (
    <div className="domain-selector">
      <input
        id={id}
        list={`${id}-suggestions`}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Start typing, for example Finance or Customer Support"
        value={value}
      />
      <datalist id={`${id}-suggestions`}>
        {[...suggestions, "Other / Custom"].map((domain) => (
          <option key={domain} value={domain} />
        ))}
      </datalist>
    </div>
  );
}

function getSelectedProvider(settings: PublicSettings, providerId?: string) {
  return (
    settings.aiProviders.find((provider) => provider.id === providerId) ??
    settings.aiProviders.find((provider) => provider.id === settings.defaultAiProviderId) ??
    settings.aiProviders[0]
  );
}

function selectedProviderSupportsStructuredJson(provider: AiProviderConfig | undefined, modelId?: string) {
  if (!provider) {
    return false;
  }

  return providerSupportsStructuredJson(
    provider.providerType,
    modelId || provider.defaultModel,
    provider.supportsStructuredJson,
  );
}

function defaultProviderForm(settings: PublicSettings): AiProviderForm {
  return {
    name: "OpenAI",
    providerType: "openai",
    baseUrl: defaultBaseUrl("openai"),
    apiKey: "",
    defaultModel: settings.defaultModel || defaultRuntimeModel,
    supportsStructuredJson: providerSupportsStructuredJson("openai", settings.defaultModel || defaultRuntimeModel),
  };
}

function defaultProviderName(providerType: AiProviderType) {
  switch (providerType) {
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Anthropic";
    case "gemini":
      return "Google Gemini";
    case "ollama":
      return "Ollama";
    case "openai-compatible":
      return "Custom OpenAI-compatible";
  }
}

function defaultBaseUrl(providerType: AiProviderType) {
  return normalizeBaseUrl(providerType) ?? "";
}

function defaultModelForProvider(providerType: AiProviderType) {
  return getDefaultModelForProvider(providerType) ?? "";
}

function SettingsScreen({
  appState,
  onSettingsChange,
  onUpdate,
  settings,
}: {
  appState: AppState;
  onSettingsChange: (settings: PublicSettings) => void;
  onUpdate: <Key extends keyof AppState>(key: Key, value: AppState[Key]) => void;
  settings: PublicSettings;
}) {
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isClearingKey, setIsClearingKey] = useState(false);
  const [defaultModel, setDefaultModel] = useState(settings.defaultModel);
  const [defaultOutputFolder, setDefaultOutputFolder] = useState(settings.defaultOutputFolder);
  const [preferredValidationProfile, setPreferredValidationProfile] = useState<ValidationProfile>(
    settings.preferredValidationProfile,
  );
  const [preferredContextMode, setPreferredContextMode] = useState<AgentKitContextMode>(
    settings.preferredContextMode,
  );
  const [theme, setTheme] = useState<ThemeMode>(settings.theme);
  const [includePolicies, setIncludePolicies] = useState(settings.includePolicies);
  const [includeTemplates, setIncludeTemplates] = useState(settings.includeTemplates);
  const [includeWorkflows, setIncludeWorkflows] = useState(settings.includeWorkflows);
  const [includeReferences, setIncludeReferences] = useState(settings.includeReferences);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [isSelectingOutputFolder, setIsSelectingOutputFolder] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [providerForm, setProviderForm] = useState<AiProviderForm>(() => defaultProviderForm(settings));

  useEffect(() => {
    setDefaultModel(settings.defaultModel);
    setDefaultOutputFolder(settings.defaultOutputFolder);
    setPreferredValidationProfile(settings.preferredValidationProfile);
    setPreferredContextMode(settings.preferredContextMode);
    setTheme(settings.theme);
    setIncludePolicies(settings.includePolicies);
    setIncludeTemplates(settings.includeTemplates);
    setIncludeWorkflows(settings.includeWorkflows);
    setIncludeReferences(settings.includeReferences);
  }, [settings]);

  function editProvider(provider: AiProviderConfig) {
    setProviderForm({
      id: provider.id,
      name: provider.name,
      providerType: provider.providerType,
      baseUrl: provider.baseUrl || defaultBaseUrl(provider.providerType),
      apiKey: "",
      defaultModel: provider.defaultModel,
      supportsStructuredJson: provider.supportsStructuredJson,
    });
    setSettingsError(null);
    setSettingsMessage(null);
  }

  function updateProviderType(providerType: AiProviderType) {
    const nextModel = defaultModelForProvider(providerType);
    setProviderForm((current) => ({
      ...current,
      providerType,
      name: current.id ? current.name : defaultProviderName(providerType),
      baseUrl: current.id ? current.baseUrl : defaultBaseUrl(providerType),
      defaultModel: current.id ? current.defaultModel : nextModel,
      supportsStructuredJson: providerSupportsStructuredJson(
        providerType,
        current.id ? current.defaultModel : nextModel,
      ),
    }));
  }

  async function saveProvider() {
    setSettingsError(null);
    setSettingsMessage(null);
    setIsSavingKey(true);
    try {
      const normalizedProviderForm = {
        ...providerForm,
        baseUrl: normalizeBaseUrl(providerForm.providerType, providerForm.baseUrl) ?? "",
      };
      const updatedSettings = await invoke<PublicSettings>("save_ai_provider", {
        input: normalizedProviderForm,
      });
      onSettingsChange(updatedSettings);
      setProviderForm(defaultProviderForm(updatedSettings));
      setSettingsMessage("AI provider saved locally.");
    } catch (caughtError) {
      setSettingsError(errorToMessage(caughtError));
    } finally {
      setIsSavingKey(false);
    }
  }

  async function removeProvider(providerId: string) {
    setSettingsError(null);
    setSettingsMessage(null);
    try {
      const updatedSettings = await invoke<PublicSettings>("remove_ai_provider", { providerId });
      onSettingsChange(updatedSettings);
      setSettingsMessage("AI provider removed.");
    } catch (caughtError) {
      setSettingsError(errorToMessage(caughtError));
    }
  }

  async function setDefaultProvider(providerId: string) {
    setSettingsError(null);
    setSettingsMessage(null);
    try {
      const updatedSettings = await invoke<PublicSettings>("set_default_ai_provider", { providerId });
      onSettingsChange(updatedSettings);
      setSettingsMessage("Default AI provider updated.");
    } catch (caughtError) {
      setSettingsError(errorToMessage(caughtError));
    }
  }

  async function saveApiKey() {
    setIsSavingKey(true);
    setSettingsError(null);
    setSettingsMessage(null);

    try {
      const updatedSettings = await invoke<PublicSettings>("save_openai_api_key", {
        apiKey: appState.openAiApiKey,
      });
      onSettingsChange(updatedSettings);
      onUpdate("openAiApiKey", "");
      setSettingsMessage("OpenAI API key saved locally.");
    } catch (caughtError) {
      setSettingsError(errorToMessage(caughtError));
    } finally {
      setIsSavingKey(false);
    }
  }

  async function clearApiKey() {
    setIsClearingKey(true);
    setSettingsError(null);
    setSettingsMessage(null);

    try {
      const updatedSettings = await invoke<PublicSettings>("clear_openai_api_key");
      onSettingsChange(updatedSettings);
      onUpdate("openAiApiKey", "");
      setSettingsMessage("OpenAI API key cleared.");
    } catch (caughtError) {
      setSettingsError(errorToMessage(caughtError));
    } finally {
      setIsClearingKey(false);
    }
  }

  async function savePreferences() {
    setIsSavingPreferences(true);
    setSettingsError(null);
    setSettingsMessage(null);

    try {
      const updatedSettings = await invoke<PublicSettings>("save_app_preferences", {
        input: {
          defaultModel,
          defaultOutputFolder,
          preferredValidationProfile,
          preferredContextMode,
          theme,
          includePolicies,
          includeTemplates,
          includeWorkflows,
          includeReferences,
        },
      });
      onSettingsChange(updatedSettings);
      onUpdate("defaultOutputFolder", updatedSettings.defaultOutputFolder);
      onUpdate("preferredValidationProfile", updatedSettings.preferredValidationProfile);
      setSettingsMessage("Preferences saved.");
    } catch (caughtError) {
      setSettingsError(errorToMessage(caughtError));
    } finally {
      setIsSavingPreferences(false);
    }
  }

  async function selectDefaultOutputFolder() {
    setIsSelectingOutputFolder(true);
    setSettingsError(null);

    try {
      const selectedPath = await invoke<string | null>("select_agent_kit_folder");
      if (selectedPath) {
        setDefaultOutputFolder(selectedPath);
      }
    } catch (caughtError) {
      setSettingsError(errorToMessage(caughtError));
    } finally {
      setIsSelectingOutputFolder(false);
    }
  }

  async function testOpenAIConnection() {
    setIsTestingConnection(true);
    setSettingsError(null);
    setSettingsMessage(null);

    try {
      const result = await invoke<{ ok: boolean; model: string; message: string }>(
        "test_ai_provider_connection",
        { input: { providerId: providerForm.id || settings.defaultAiProviderId, model: providerForm.defaultModel || defaultModel } },
      );
      setSettingsMessage(`${result.message} Model: ${result.model}.`);
    } catch (caughtError) {
      setSettingsError(errorToMessage(caughtError));
    } finally {
      setIsTestingConnection(false);
    }
  }

  return (
    <div className="form-panel settings-panel">
      <h2>AI Providers</h2>
      {settings.aiProviders.length === 0 && (
        <div className="inline-warning">
          Add OpenAI, Anthropic, Gemini, Ollama, or a custom OpenAI-compatible provider.
        </div>
      )}

      <div className="provider-list">
        {settings.aiProviders.map((provider) => (
          <article className="provider-card" key={provider.id}>
            <div>
              <strong>{provider.name}</strong>
              <p>{provider.providerType} · {provider.defaultModel}</p>
            </div>
            <span className={`secret-status ${provider.hasApiKey || provider.providerType === "ollama" ? "saved" : ""}`}>
              {provider.hasApiKey ? "Key saved" : provider.providerType === "ollama" ? "No key required" : "No key"}
            </span>
            <div className="button-row">
              <button className="secondary-button compact-button" onClick={() => editProvider(provider)} type="button">
                Edit
              </button>
              <button className="secondary-button compact-button" onClick={() => setDefaultProvider(provider.id)} type="button">
                {settings.defaultAiProviderId === provider.id ? "Default" : "Make default"}
              </button>
              <button className="secondary-button compact-button" onClick={() => removeProvider(provider.id)} type="button">
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>

      <h2>{providerForm.id ? "Edit provider" : "Add provider"}</h2>
      <div className="settings-grid two-column">
        <div>
          <label htmlFor="provider-type">Provider type</label>
          <select
            id="provider-type"
            onChange={(event) => updateProviderType(event.target.value as AiProviderType)}
            value={providerForm.providerType}
          >
            {aiProviderTypes.map((providerType) => (
              <option key={providerType} value={providerType}>
                {providerType}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="provider-name">Provider name</label>
          <input
            id="provider-name"
            onChange={(event) => setProviderForm((current) => ({ ...current, name: event.target.value }))}
            value={providerForm.name}
          />
        </div>
      </div>

      <details className="advanced-details">
        <summary>Advanced provider settings</summary>
        <LabelWithHelp
          htmlFor="provider-base-url"
          label="Base URL"
          help="Only change this for local servers, gateways, or custom OpenAI-compatible providers."
        />
        <input
          id="provider-base-url"
          onChange={(event) => setProviderForm((current) => ({ ...current, baseUrl: event.target.value }))}
          placeholder={isBaseUrlRequiredForProvider(providerForm.providerType) ? "Required" : defaultBaseUrl(providerForm.providerType) || "Optional"}
          value={providerForm.baseUrl}
        />

        <label className="checkbox-row" htmlFor="provider-structured-json">
          <input
            checked={providerForm.supportsStructuredJson}
            id="provider-structured-json"
            onChange={(event) => setProviderForm((current) => ({ ...current, supportsStructuredJson: event.target.checked }))}
            type="checkbox"
          />
          <span>Provider can reliably return structured JSON</span>
          <HelpTip text="This matters for Build with AI because drafts must be valid JSON before rendering." />
        </label>
        {getProviderCapabilities(providerForm.providerType).notes && (
          <p className="form-copy">{getProviderCapabilities(providerForm.providerType).notes}</p>
        )}
      </details>

      <label htmlFor="provider-api-key">API key</label>
      <div className="input-with-icon">
        <KeyRound size={18} />
        <input
          id="provider-api-key"
          onChange={(event) => setProviderForm((current) => ({ ...current, apiKey: event.target.value }))}
          placeholder={
            providerForm.id
              ? "Saved key is hidden. Enter a new key to update."
              : isApiKeyRequiredForProvider(providerForm.providerType)
                ? "Required"
                : "Optional for local providers"
          }
          type="password"
          value={providerForm.apiKey}
        />
      </div>

      <label htmlFor="provider-model">Default model</label>
      <ModelInput
        id="provider-model"
        model={providerForm.defaultModel}
        onModelChange={(value) => setProviderForm((current) => ({ ...current, defaultModel: value }))}
        providerType={providerForm.providerType}
      />

      <div className="button-row">
        <button className="primary-button" disabled={isSavingKey} onClick={saveProvider} type="button">
          {isSavingKey ? "Saving" : "Save provider"}
        </button>
        <button className="secondary-button" onClick={() => setProviderForm(defaultProviderForm(settings))} type="button">
          New provider
        </button>
        <button
          className="secondary-button"
          disabled={isTestingConnection || settings.aiProviders.length === 0}
          onClick={testOpenAIConnection}
          type="button"
        >
          {isTestingConnection ? "Testing" : "Test selected provider"}
        </button>
      </div>

      <div className="inline-warning">
        Settings are stored as local app data at {settings.settingsPath || "the app-local settings file"}.
        API keys are saved there for v0.1; they are not stored in an OS keychain yet.
      </div>

      {settingsMessage && <div className="copy-state">{settingsMessage}</div>}
      {settingsError && (
        <div className="error-state" role="alert">
          {settingsError}
        </div>
      )}

      <label htmlFor="default-output-folder">Default output folder</label>
      <div className="path-picker">
        <input
          id="default-output-folder"
          onChange={(event) => setDefaultOutputFolder(event.target.value)}
          placeholder="C:\\kits\\output"
          value={defaultOutputFolder}
        />
        <button
          className="icon-button"
          disabled={isSelectingOutputFolder}
          onClick={selectDefaultOutputFolder}
          title="Select output folder"
          type="button"
        >
          <FolderOpen size={18} />
        </button>
      </div>

      <label htmlFor="preferred-validation-profile">Preferred validation profile</label>
      <select
        id="preferred-validation-profile"
        onChange={(event) => setPreferredValidationProfile(event.target.value as ValidationProfile)}
        value={preferredValidationProfile}
      >
        {validationProfiles.map((validationProfile) => (
          <option key={validationProfile} value={validationProfile}>
            {validationProfile}
          </option>
        ))}
      </select>

      <label htmlFor="preferred-context-mode">Preferred context mode</label>
      <select
        id="preferred-context-mode"
        onChange={(event) => setPreferredContextMode(event.target.value as AgentKitContextMode)}
        value={preferredContextMode}
      >
        {contextModes.map((mode) => (
          <option key={mode} value={mode}>
            {mode}
          </option>
        ))}
      </select>

      <label htmlFor="app-theme">Theme</label>
      <select
        id="app-theme"
        onChange={(event) => setTheme(event.target.value as ThemeMode)}
        value={theme}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>

      <div className="checkbox-grid">
        <label className="checkbox-row" htmlFor="settings-include-policies">
          <input
            checked={includePolicies}
            id="settings-include-policies"
            onChange={(event) => setIncludePolicies(event.target.checked)}
            type="checkbox"
          />
          <span>Include policies</span>
        </label>
        <label className="checkbox-row" htmlFor="settings-include-templates">
          <input
            checked={includeTemplates}
            id="settings-include-templates"
            onChange={(event) => setIncludeTemplates(event.target.checked)}
            type="checkbox"
          />
          <span>Include templates</span>
        </label>
        <label className="checkbox-row" htmlFor="settings-include-workflows">
          <input
            checked={includeWorkflows}
            id="settings-include-workflows"
            onChange={(event) => setIncludeWorkflows(event.target.checked)}
            type="checkbox"
          />
          <span>Include workflows</span>
        </label>
        <label className="checkbox-row" htmlFor="settings-include-references">
          <input
            checked={includeReferences}
            id="settings-include-references"
            onChange={(event) => setIncludeReferences(event.target.checked)}
            type="checkbox"
          />
          <span>Include references</span>
        </label>
      </div>

      <button
        className="primary-button settings-inline-button"
        disabled={isSavingPreferences}
        onClick={savePreferences}
        type="button"
      >
        {isSavingPreferences ? "Saving" : "Save preferences"}
      </button>
    </div>
  );
}

function AboutScreen({ settings }: { settings: PublicSettings }) {
  return (
    <div className="about-screen">
      <section className="form-panel about-panel">
        <div className="about-header">
          <img alt="" className="about-mark" src={agentKitForgeIcon} />
          <div>
            <h2>AgentKitForge</h2>
            <p>Version {appVersion}</p>
          </div>
        </div>

        <p className="form-copy">
          AgentKitForge is a downloadable desktop app for building, validating, packaging,
          installing, and using portable Agent Kits.
        </p>

        <dl className="report-meta about-meta">
          <div>
            <dt>App mode</dt>
            <dd>Local desktop workspace</dd>
          </div>
          <div>
            <dt>Settings file</dt>
            <dd>{settings.settingsPath || "Resolved by Tauri app-local data at runtime"}</dd>
          </div>
        </dl>

        <div className="about-links">
          <a href="https://AgentKitForge.com" target="_blank" rel="noreferrer">
            AgentKitForge.com
          </a>
          <a href="https://AgentKitMarket.com" target="_blank" rel="noreferrer">
            AgentKitMarket.com
          </a>
          <a href="https://github.com/agentkitforge/agentkitforge-app" target="_blank" rel="noreferrer">
            GitHub repo placeholder
          </a>
        </div>
      </section>

      <section className="form-panel about-panel">
        <h2>Privacy and Storage</h2>
        <p className="form-copy">
          AgentKitForge stores My Kits entries and app preferences locally on this machine. It does
          not require an account and does not sync local library data remotely.
        </p>
        <div className="inline-warning">
          For v0.1, AI provider API keys are stored in local app data, not an OS keychain. Do not share
          local app data or commit generated settings files.
        </div>
      </section>
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
          <dt>Template</dt>
          <dd>{result.template}</dd>
        </div>
        <div>
          <dt>Validation profile</dt>
          <dd>{validationProfile}</dd>
        </div>
      </dl>
      <details className="advanced-details">
        <summary>Advanced details</summary>
        <dl className="report-meta">
          <div>
            <dt>Full folder path</dt>
            <dd>{result.rootPath}</dd>
          </div>
        </dl>
      </details>

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

function RenderAgentKitDraftResults({
  error,
  isLoading,
  onValidateRenderedKit,
  result,
}: {
  error: string | null;
  isLoading: boolean;
  onValidateRenderedKit: (rootPath: string) => void;
  result: RenderAgentKitDraftResult | null;
}) {
  if (isLoading) {
    return <p className="state-copy">Rendering Agent Kit from draft JSON...</p>;
  }

  if (error) {
    return (
      <div className="error-state" role="alert">
        {error}
      </div>
    );
  }

  if (!result) {
    return <p className="state-copy">Render a draft JSON file to see the generated kit files.</p>;
  }

  return (
    <div className="create-result">
      <div className="status-banner valid">
        <strong>Rendered</strong>
        <span>{result.files.length} file{result.files.length === 1 ? "" : "s"}</span>
      </div>

      <dl className="report-meta">
        <div>
          <dt>Validation profile</dt>
          <dd>local-valid</dd>
        </div>
      </dl>
      <details className="advanced-details">
        <summary>Advanced details</summary>
        <dl className="report-meta">
          <div>
            <dt>Full folder path</dt>
            <dd>{result.rootPath}</dd>
          </div>
        </dl>
      </details>

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
        onClick={() => onValidateRenderedKit(result.rootPath)}
        type="button"
      >
        <CheckCircle2 size={18} />
        Validate rendered kit
      </button>
    </div>
  );
}

function GeneratedDraftResults({
  copyState,
  error,
  isLoading,
  isRenderingDraft,
  isSelectingRenderOutput,
  onCopyJson,
  onRenderDraft,
  onRenderForceChange,
  onRenderOutputFolderChange,
  onSaveJson,
  onSelectRenderOutputFolder,
  onValidateRenderedKit,
  renderError,
  renderForce,
  renderOutputFolder,
  renderResult,
  result,
  savePath,
}: {
  copyState: "idle" | "copied" | "failed";
  error: string | null;
  isLoading: boolean;
  isRenderingDraft: boolean;
  isSelectingRenderOutput: boolean;
  onCopyJson: () => void;
  onRenderDraft: () => void;
  onRenderForceChange: (value: boolean) => void;
  onRenderOutputFolderChange: (value: string) => void;
  onSaveJson: () => void;
  onSelectRenderOutputFolder: () => void;
  onValidateRenderedKit: (rootPath: string) => void;
  renderError: string | null;
  renderForce: boolean;
  renderOutputFolder: string;
  renderResult: RenderAgentKitDraftResult | null;
  result: GenerateAgentKitDraftResult | null;
  savePath: string | null;
}) {
  if (isLoading) {
    return <p className="state-copy">Generating AgentKitDraft JSON with the selected AI provider...</p>;
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
        Generate a draft JSON object, review it, then save it or render it into an Agent Kit folder.
      </p>
    );
  }

  return (
    <div className="generated-draft-result">
      <div className="status-banner valid">
        <strong>Draft generated</strong>
        <span>{result.providerName} · {result.model}</span>
      </div>

      {result.warnings.length > 0 && (
        <div className="inline-warning">
          {result.warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      )}

      <div className="button-row">
        <button className="secondary-button" onClick={onCopyJson} type="button">
          Copy JSON
        </button>
        <button className="secondary-button" onClick={onSaveJson} type="button">
          Save draft JSON
        </button>
      </div>

      {copyState === "copied" && <div className="copy-state">JSON copied to clipboard.</div>}
      {copyState === "failed" && (
        <div className="field-error">Clipboard access failed. Select and copy the JSON text.</div>
      )}
      {savePath && <div className="copy-state">Saved to {savePath}</div>}

      <details className="advanced-details">
        <summary>Advanced: draft JSON</summary>
        <pre className="json-panel">{result.draftJsonPretty}</pre>
      </details>

      <div className="render-generated-panel">
        <h3>Render this draft</h3>
        <LabelWithHelp
          htmlFor="generated-render-output"
          label="Save location"
          help="Choose where the rendered kit folder should be created."
        />
        <div className="path-picker">
          <input
            id="generated-render-output"
            onChange={(event) => onRenderOutputFolderChange(event.target.value)}
            placeholder="C:\\kits\\generated-agent-kit"
            value={renderOutputFolder}
          />
          <button
            className="icon-button"
            disabled={isSelectingRenderOutput || isRenderingDraft}
            onClick={onSelectRenderOutputFolder}
            title="Select output folder"
            type="button"
          >
            <FolderOpen size={18} />
          </button>
        </div>

        <label className="checkbox-row" htmlFor="generated-render-force">
          <input
            checked={renderForce}
            id="generated-render-force"
            onChange={(event) => onRenderForceChange(event.target.checked)}
            type="checkbox"
          />
          <span>Force overwrite generated files</span>
          <HelpTip text="Use this only when you intentionally want generated files to replace existing files." />
        </label>

        <button
          className="primary-button"
          disabled={isRenderingDraft}
          onClick={onRenderDraft}
          type="button"
        >
          <FileArchive size={18} />
          {isRenderingDraft ? "Rendering" : "Render this draft"}
        </button>

        {renderError && (
          <div className="error-state" role="alert">
            {renderError}
          </div>
        )}

        {renderResult && (
          <div className="create-result">
            <div className="status-banner valid">
              <strong>Rendered</strong>
              <span>{renderResult.files.length} file{renderResult.files.length === 1 ? "" : "s"}</span>
            </div>
            <details className="advanced-details">
              <summary>Advanced details</summary>
              <dl className="report-meta">
                <div>
                  <dt>Full folder path</dt>
                  <dd>{renderResult.rootPath}</dd>
                </div>
              </dl>
            </details>
            <button
              className="primary-button"
              onClick={() => onValidateRenderedKit(renderResult.rootPath)}
              type="button"
            >
              <CheckCircle2 size={18} />
              Validate rendered kit
            </button>
          </div>
        )}
      </div>
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

function validateDraftRenderForm(form: RenderAgentKitDraftInput) {
  const errors: Partial<Record<keyof RenderAgentKitDraftInput, string>> = {};

  if (form.draftFilePath.trim() === "") {
    errors.draftFilePath = "Draft JSON file is required.";
  }

  if (form.outputFolder.trim() === "") {
    errors.outputFolder = "Output folder is required.";
  }

  return errors;
}

function validateGenerateDraftForm(settings: PublicSettings, form: GenerateAgentKitDraftInput) {
  const errors: Partial<Record<keyof GenerateAgentKitDraftInput | "apiKey", string>> = {};

  if (settings.aiProviders.length === 0) {
    errors.apiKey = "AI provider is required. Add one in Settings first.";
  }

  if (form.providerId.trim() === "") {
    errors.providerId = "AI provider is required.";
  }

  if (form.userRequest.trim() === "") {
    errors.userRequest = "Describe the Agent Kit you want.";
  }

  if (!validationProfiles.includes(form.desiredValidationLevel)) {
    errors.desiredValidationLevel = "Desired validation level is required.";
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
