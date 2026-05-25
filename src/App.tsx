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
import { useMemo, useState } from "react";

type SectionId = "my-kits" | "build" | "use" | "validate" | "settings";

type AppState = {
  currentKitPath: string;
  defaultOutputFolder: string;
  openAiApiKey: string;
  preferredValidationProfile: string;
};

type NavItem = {
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
};

const validationProfiles = ["standard", "strict", "publish-ready"];

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
    preferredValidationProfile: "standard",
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
          {activeSection === "build" && <BuildScreen />}
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

function BuildScreen() {
  return (
    <div className="screen-grid">
      <PlaceholderCard
        description="Start a new portable Agent Kit from a guided starter structure."
        icon={Box}
        title="Create from template"
      />
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
  );
}

function ValidateScreen({
  currentKitPath,
  profile,
  onKitPathChange,
  onProfileChange,
}: {
  currentKitPath: string;
  profile: string;
  onKitPathChange: (value: string) => void;
  onProfileChange: (value: string) => void;
}) {
  return (
    <div className="form-layout">
      <div className="form-panel">
        <label htmlFor="validate-kit-folder">Select kit folder</label>
        <input
          id="validate-kit-folder"
          onChange={(event) => onKitPathChange(event.target.value)}
          placeholder="C:\\kits\\agent-kit"
          value={currentKitPath}
        />

        <label htmlFor="validation-profile">Validation profile</label>
        <select
          id="validation-profile"
          onChange={(event) => onProfileChange(event.target.value)}
          value={profile}
        >
          {validationProfiles.map((validationProfile) => (
            <option key={validationProfile} value={validationProfile}>
              {validationProfile}
            </option>
          ))}
        </select>

        <button className="primary-button" type="button">
          <CheckCircle2 size={18} />
          Validate
        </button>
      </div>

      <div className="results-panel">
        <div className="panel-label">Results</div>
        <p>Validation output will appear here after agentkitforge-core commands are connected.</p>
      </div>
    </div>
  );
}

function UseScreen({ currentKitPath }: { currentKitPath: string }) {
  return (
    <div className="form-layout">
      <div className="form-panel">
        <label htmlFor="use-kit">Select kit</label>
        <input id="use-kit" placeholder="Choose an Agent Kit" readOnly value={currentKitPath} />
      </div>

      <div className="screen-grid compact">
        <PlaceholderCard
          description="Open a selected kit in the Forge runtime surface."
          icon={PlayCircle}
          title="Use inside Forge"
        />
        <PlaceholderCard
          description="Prepare a kit export that can be installed or used in ChatGPT workflows."
          icon={PackageOpen}
          title="Prepare for ChatGPT"
        />
        <PlaceholderCard
          description="Create a single portable Markdown document from the current kit."
          icon={FileArchive}
          title="Export one-file Markdown"
        />
      </div>
    </div>
  );
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
        onChange={(event) => onUpdate("preferredValidationProfile", event.target.value)}
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
