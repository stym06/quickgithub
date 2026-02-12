// Documentation JSON structure matching the Go worker output

export interface SetupGuide {
  prerequisites: string;
  installation: string;
  configuration?: string;
  running: string;
  testing?: string;
}

export interface SystemOverview {
  description: string;
  purpose: string;
  keyFeatures: string[];
  gettingStarted: string;
  mainLanguage: string;
  repoType: string;
  setupGuide?: SetupGuide;
}

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

export interface Architecture {
  description: string;
  components: ArchComponent[];
  dataFlow: string;
  diagrams?: ArchDiagram[];
}

export interface TechStack {
  languages: string[];
  frameworks: string[];
  databases?: string[];
  tools?: string[];
  infrastructure?: string[];
}

export interface ModuleExport {
  name: string;
  type: string;
  description: string;
}

export interface ModuleAnalysis {
  moduleName: string;
  modulePath: string;
  description: string;
  keyExports: ModuleExport[];
  internalDependencies: string[];
  publicAPI: string[];
  sourceFiles?: string[];
}

export interface EntryPoint {
  name: string;
  path: string;
  description: string;
  type?: string;
}

export interface EntryPoints {
  main: EntryPoint[];
  cli?: EntryPoint[];
  api?: EntryPoint[];
  config?: EntryPoint[];
}

export interface KeyDependency {
  name: string;
  purpose: string;
}

export interface Dependencies {
  runtime: string[];
  dev?: string[];
  key: KeyDependency[];
}

export interface Documentation {
  systemOverview: SystemOverview;
  architecture: Architecture;
  techStack: TechStack;
  keyModules: ModuleAnalysis[];
  entryPoints: EntryPoints;
  dependencies: Dependencies;
  repoContext: string;
}

export type RepoStatus =
  | "PENDING"
  | "FETCHING"
  | "PARSING"
  | "ANALYZING"
  | "COMPLETED"
  | "FAILED";

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
}
