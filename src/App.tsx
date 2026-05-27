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
import agentKitForgeIcon from "./assets/brand/agentkitforge-icon.svg";

type SectionId = "my-kits" | "build" | "use" | "validate" | "settings";
type ExtendedSectionId = SectionId | "package-export" | "install-targets" | "about";
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
  model: string;
};

type GenerateAgentKitDraftResult = {
  draftJson: unknown;
  draftJsonPretty: string;
  warnings: string[];
  model: string;
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

type PublicSettings = {
  hasOpenaiApiKey: boolean;
  defaultModel: string;
  defaultOutputFolder: string;
  preferredValidationProfile: ValidationProfile;
  preferredContextMode: AgentKitContextMode;
  includePolicies: boolean;
  includeTemplates: boolean;
  includeWorkflows: boolean;
  includeReferences: boolean;
  settingsPath: string;
};

type RunAgentKitResult = {
  response: string;
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

type NavItem = {
  id: ExtendedSectionId;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
};

const validationProfiles: ValidationProfile[] = ["local-valid", "publishable", "trusted", "verified"];
const contextModes: AgentKitContextMode[] = ["all", "triggered"];
const contextTargets: AgentKitContextTarget[] = ["openai", "chatgpt", "claude", "generic"];
const agentKitTemplates: AgentKitTemplate[] = ["blank", "financial-review"];
const starterPrompt =
  "Use the attached Agent Kit instructions to help with this task. Follow the kit's skill routing, guardrails, procedures, and output expectations. Ask clarifying questions if required inputs are missing.";
const defaultRuntimeModel = "gpt-5-mini";
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
    defaultOutputFolder: "",
    preferredValidationProfile: "local-valid",
    preferredContextMode: "triggered",
    includePolicies: true,
    includeTemplates: true,
    includeWorkflows: true,
    includeReferences: false,
    settingsPath: "",
  });
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
          defaultOutputFolder: "",
          preferredValidationProfile: "local-valid",
          preferredContextMode: "triggered",
          includePolicies: true,
          includeTemplates: true,
          includeWorkflows: true,
          includeReferences: false,
          settingsPath: "",
        });
      });
  }, []);

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
          {activeSection === "my-kits" && (
            <MyKitsScreen
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
              onKitReady={(rootPath) => addKitToLibrary(rootPath, "built")}
              settings={settings}
              onValidateCreatedKit={(rootPath, profile) => {
                updateAppState("currentKitPath", rootPath);
                updateAppState("preferredValidationProfile", profile);
                setActiveSection("validate");
              }}
            />
          )}
          {activeSection === "use" && (
            <UseScreen currentKitPath={appState.currentKitPath} settings={settings} />
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
              onKitPackaged={(path) => addKitToLibrary(path, "manual")}
              settings={settings}
            />
          )}
          {activeSection === "install-targets" && (
            <InstallTargetsScreen currentKitPath={appState.currentKitPath} />
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
  onPackageKit,
  onUseKit,
  onValidateKit,
}: {
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
                <dt>Path</dt>
                <dd>{kit.path}</dd>
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
              <dt>Extracted path</dt>
              <dd>{importResult.extractedPath}</dd>
            </div>
            <div>
              <dt>Kit</dt>
              <dd>{importResult.metadata.name} {importResult.metadata.version}</dd>
            </div>
          </dl>
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
  onValidateCreatedKit,
  settings,
}: {
  onKitReady: (rootPath: string) => void;
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

  useEffect(() => {
    setAiForm((current) => ({ ...current, model: settings.defaultModel || defaultRuntimeModel }));
  }, [settings.defaultModel]);

  useEffect(() => {
    setForm((current) => ({ ...current, outputFolder: current.outputFolder || settings.defaultOutputFolder }));
    setDraftForm((current) => ({ ...current, outputFolder: current.outputFolder || settings.defaultOutputFolder }));
    setGeneratedRenderOutputFolder((current) => current || settings.defaultOutputFolder);
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
        "generate_agent_kit_draft_with_openai",
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
      <div className="build-layout">
        <div className="form-panel">
          <h2>Build with OpenAI</h2>

          {!settings.hasOpenaiApiKey && (
            <div className="inline-warning">Add an OpenAI API key in Settings before generating drafts.</div>
          )}

          <label htmlFor="ai-user-request">Describe the Agent Kit you want</label>
          <textarea
            id="ai-user-request"
            onChange={(event) => updateAiForm("userRequest", event.target.value)}
            placeholder="Describe the Agent Kit's purpose, skills, workflows, and expected outputs."
            rows={5}
            value={aiForm.userRequest}
          />
          <FieldError message={aiFieldErrors.userRequest} />
          <FieldError message={aiFieldErrors.apiKey} />

          <label htmlFor="ai-domain">Domain</label>
          <input
            id="ai-domain"
            onChange={(event) => updateAiForm("domain", event.target.value)}
            placeholder="Finance, support, legal ops, software delivery..."
            value={aiForm.domain}
          />

          <label htmlFor="ai-target-users">Target users</label>
          <input
            id="ai-target-users"
            onChange={(event) => updateAiForm("targetUsers", event.target.value)}
            placeholder="Analysts, managers, operators"
            value={aiForm.targetUsers}
          />

          <label htmlFor="ai-validation-level">Desired validation level</label>
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

          <label htmlFor="ai-model">Model</label>
          <input
            id="ai-model"
            onChange={(event) => updateAiForm("model", event.target.value)}
            value={aiForm.model}
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

          <label htmlFor="draft-output-folder">Target output folder</label>
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

function UseScreen({
  currentKitPath,
  settings,
}: {
  currentKitPath: string;
  settings: PublicSettings;
}) {
  const [kitPath, setKitPath] = useState(currentKitPath);
  const [userTask, setUserTask] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
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
    setModel(settings.defaultModel || defaultRuntimeModel);
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
    const validationErrors = validateRunForm(settings, kitPath, userTask);
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

      const runtimeResult = await invoke<RunAgentKitResult>("run_agent_kit_with_openai", {
        input: {
          kitPath,
          userTask,
          additionalContext,
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

          {!settings.hasOpenaiApiKey && (
            <div className="inline-warning">Add an OpenAI API key in Settings before running.</div>
          )}

          <label htmlFor="runtime-kit">Select kit folder</label>
          <div className="path-picker">
            <input
              id="runtime-kit"
              onChange={(event) => {
                setKitPath(event.target.value);
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

          <label htmlFor="runtime-task">Task</label>
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

          <label htmlFor="runtime-model">Model</label>
          <input
            id="runtime-model"
            onChange={(event) => setModel(event.target.value)}
            value={model}
          />

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

          <button
            className="primary-button"
            disabled={isRunning}
            onClick={runInsideForge}
            type="button"
          >
            <PlayCircle size={18} />
            {isRunning ? "Running" : "Run with OpenAI"}
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
                setKitPath(event.target.value);
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
  onKitPackaged,
  settings,
}: {
  currentKitPath: string;
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
              setKitPath(event.target.value);
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

function InstallTargetsScreen({ currentKitPath }: { currentKitPath: string }) {
  const [kitPath, setKitPath] = useState(currentKitPath);
  const [destinationSkillsDir, setDestinationSkillsDir] = useState("");
  const [force, setForce] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ kitPath?: string; destinationSkillsDir?: string }>({});
  const [result, setResult] = useState<CodexExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSelectingKit, setIsSelectingKit] = useState(false);
  const [isSelectingDestination, setIsSelectingDestination] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

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
        setResult(null);
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

  async function openDestinationFolder() {
    try {
      await invoke("open_folder", { path: result?.destinationSkillsDir ?? destinationSkillsDir });
    } catch (caughtError) {
      setError(errorToMessage(caughtError));
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

  return (
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
              setKitPath(event.target.value);
              setResult(null);
            }}
            placeholder="Choose an Agent Kit"
            value={kitPath}
          />
          <button className="icon-button" disabled={isSelectingKit || isExporting} onClick={selectKitFolder} title="Select kit folder" type="button">
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
        <span>{result.model}</span>
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
            {isSavingResponse ? "Saving" : "Save Markdown"}
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
  if (isLoading) {
    return <p className="state-copy compact-state">Checking for starter guidance...</p>;
  }

  if (error) {
    return null;
  }

  if (!hint) {
    return null;
  }

  return (
    <div className="starter-hint-panel">
      <strong>Starter hint from {hint.sourceFile}</strong>
      <p>{hint.excerpt}</p>
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

function validateRunForm(settings: PublicSettings, kitPath: string, userTask: string) {
  const errors: { apiKey?: string; kitPath?: string; userTask?: string } = {};

  if (!settings.hasOpenaiApiKey) {
    errors.apiKey = "OpenAI API key is required. Save it in Settings first.";
  }

  if (kitPath.trim() === "") {
    errors.kitPath = "Kit folder is required.";
  }

  if (userTask.trim() === "") {
    errors.userTask = "Task is required.";
  }

  return errors;
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
  const [includePolicies, setIncludePolicies] = useState(settings.includePolicies);
  const [includeTemplates, setIncludeTemplates] = useState(settings.includeTemplates);
  const [includeWorkflows, setIncludeWorkflows] = useState(settings.includeWorkflows);
  const [includeReferences, setIncludeReferences] = useState(settings.includeReferences);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [isSelectingOutputFolder, setIsSelectingOutputFolder] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  useEffect(() => {
    setDefaultModel(settings.defaultModel);
    setDefaultOutputFolder(settings.defaultOutputFolder);
    setPreferredValidationProfile(settings.preferredValidationProfile);
    setPreferredContextMode(settings.preferredContextMode);
    setIncludePolicies(settings.includePolicies);
    setIncludeTemplates(settings.includeTemplates);
    setIncludeWorkflows(settings.includeWorkflows);
    setIncludeReferences(settings.includeReferences);
  }, [settings]);

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
        "test_openai_connection",
        { input: { model: defaultModel } },
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
      <div className="settings-status-row">
        <span className={`secret-status ${settings.hasOpenaiApiKey ? "saved" : ""}`}>
          {settings.hasOpenaiApiKey ? "API key saved" : "No API key saved"}
        </span>
      </div>

      <label htmlFor="openai-api-key">OpenAI API key</label>
      <div className="input-with-icon">
        <KeyRound size={18} />
        <input
          id="openai-api-key"
          onChange={(event) => onUpdate("openAiApiKey", event.target.value)}
          placeholder={settings.hasOpenaiApiKey ? "Saved key is hidden" : "sk-..."}
          type="password"
          value={appState.openAiApiKey}
        />
      </div>
      <div className="button-row">
        <button
          className="primary-button"
          disabled={isSavingKey}
          onClick={saveApiKey}
          type="button"
        >
          {isSavingKey ? "Saving" : "Save API key"}
        </button>
        <button
          className="secondary-button"
          disabled={isClearingKey || !settings.hasOpenaiApiKey}
          onClick={clearApiKey}
          type="button"
        >
          {isClearingKey ? "Clearing" : "Clear API key"}
        </button>
      </div>
      <button
        className="secondary-button settings-inline-button"
        disabled={isTestingConnection || !settings.hasOpenaiApiKey}
        onClick={testOpenAIConnection}
        type="button"
      >
        {isTestingConnection ? "Testing" : "Test OpenAI connection"}
      </button>

      <label htmlFor="default-runtime-model">Default OpenAI model</label>
      <input
        id="default-runtime-model"
        onChange={(event) => setDefaultModel(event.target.value)}
        value={defaultModel}
      />

      <div className="inline-warning">
        Settings are stored as local app data at {settings.settingsPath || "the app-local settings file"}.
        The OpenAI API key is saved there for v0.1; it is not stored in an OS keychain yet.
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
          For v0.1, the OpenAI API key is stored in local app data, not an OS keychain. Do not share
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
          <dt>Root path</dt>
          <dd>{result.rootPath}</dd>
        </div>
        <div>
          <dt>Validation profile</dt>
          <dd>local-valid</dd>
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
    return <p className="state-copy">Generating AgentKitDraft JSON with OpenAI...</p>;
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
        <span>{result.model}</span>
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

      <pre className="json-panel">{result.draftJsonPretty}</pre>

      <div className="render-generated-panel">
        <h3>Render this draft</h3>
        <label htmlFor="generated-render-output">Target output folder</label>
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
            <dl className="report-meta">
              <div>
                <dt>Root path</dt>
                <dd>{renderResult.rootPath}</dd>
              </div>
            </dl>
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

  if (!settings.hasOpenaiApiKey) {
    errors.apiKey = "OpenAI API key is required. Save it in Settings first.";
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
