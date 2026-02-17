// Documentation JSON structure matching the Python worker output

// ── Overview ──
export interface TechStack {
  languages: string[];
  frameworks: string[];
  databases?: string[];
  tools?: string[];
  infrastructure?: string[];
}

export interface Overview {
  description: string;
  purpose: string;
  keyFeatures: string[];
  mainLanguage: string;
  repoType: string;
  techStack: TechStack;
}

// ── Getting Started ──
export interface ConfigOption {
  name: string;
  description: string;
  required: boolean;
  default?: string;
}

export interface GettingStarted {
  prerequisites: string;
  installation: string;
  quickStart: string;
  configuration?: ConfigOption[];
}

// ── Core Architecture ──
export interface ArchComponent {
  name: string;
  description: string;
  path: string;
  dependsOn?: string[];
}

export interface ArchDiagram {
  title: string;
  type: string;
  content: string;
}

export interface CoreArchitecture {
  description: string;
  components: ArchComponent[];
  dataFlow: string;
  diagrams?: ArchDiagram[];
}

// ── API Reference ──
export interface APIExport {
  name: string;
  type: string;
  signature?: string;
  description: string;
}

export interface APIModule {
  moduleName: string;
  modulePath: string;
  description: string;
  exports: APIExport[];
}

export interface APIReference {
  modules: APIModule[];
}

// ── Usage Patterns ──
export interface UsageExample {
  title: string;
  description: string;
  code: string;
  language: string;
}

export interface UsagePattern {
  name: string;
  description: string;
  examples: UsageExample[];
}

export interface UsagePatterns {
  patterns: UsagePattern[];
}

// ── Development Guide ──
export interface KeyCommand {
  command: string;
  description: string;
}

export interface DevelopmentGuide {
  setup: string;
  projectStructure: string;
  testing?: string;
  contributing?: string;
  keyCommands?: KeyCommand[];
}

// ── Wiki (dynamic structure) ──
export interface WikiPage {
  slug: string;
  title: string;
  content: string; // markdown
}

// ── Top-level Documentation ──
export interface Documentation {
  // New wiki structure
  pages?: WikiPage[];
  // Legacy fixed structure (for old docs)
  overview?: Overview;
  gettingStarted?: GettingStarted;
  coreArchitecture?: CoreArchitecture;
  apiReference?: APIReference;
  usagePatterns?: UsagePatterns;
  developmentGuide?: DevelopmentGuide;
  repoContext?: string;
}

// ── Status & Chat (unchanged) ──
export type RepoStatus =
  | "PENDING"
  | "FETCHING"
  | "PARSING"
  | "ANALYZING"
  | "COMPLETED"
  | "FAILED"
  | "STALLED";

export interface IndexingStatus {
  status: RepoStatus;
  progress: number;
  message: string;
}

export interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
}

export interface RepoDocsResponse extends Documentation {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  status: RepoStatus;
  updatedAt?: string;
  indexedWith?: string;
}
