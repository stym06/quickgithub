from __future__ import annotations

from pydantic import BaseModel


# ── Overview ──
class TechStack(BaseModel):
    languages: list[str]
    frameworks: list[str]
    databases: list[str] | None = None
    tools: list[str] | None = None
    infrastructure: list[str] | None = None


class Overview(BaseModel):
    description: str
    purpose: str
    keyFeatures: list[str]
    mainLanguage: str
    repoType: str
    techStack: TechStack


# ── Getting Started ──
class ConfigOption(BaseModel):
    name: str
    description: str
    required: bool
    default: str | None = None


class GettingStarted(BaseModel):
    prerequisites: str
    installation: str
    quickStart: str
    configuration: list[ConfigOption] | None = None


# ── Core Architecture ──
class ArchComponent(BaseModel):
    name: str
    description: str
    path: str
    dependsOn: list[str] | None = None


class ArchDiagram(BaseModel):
    title: str
    type: str
    content: str


class CoreArchitecture(BaseModel):
    description: str
    components: list[ArchComponent]
    dataFlow: str
    diagrams: list[ArchDiagram] | None = None


# ── API Reference ──
class APIExport(BaseModel):
    name: str
    type: str
    signature: str | None = None
    description: str


class APIModule(BaseModel):
    moduleName: str
    modulePath: str
    description: str
    exports: list[APIExport]


class APIReference(BaseModel):
    modules: list[APIModule]


# ── Usage Patterns ──
class UsageExample(BaseModel):
    title: str
    description: str
    code: str
    language: str


class UsagePattern(BaseModel):
    name: str
    description: str
    examples: list[UsageExample]


class UsagePatterns(BaseModel):
    patterns: list[UsagePattern]


# ── Development Guide ──
class KeyCommand(BaseModel):
    command: str
    description: str


class DevelopmentGuide(BaseModel):
    setup: str
    projectStructure: str
    testing: str | None = None
    contributing: str | None = None
    keyCommands: list[KeyCommand] | None = None


# ── Wiki (dynamic structure) ──
class WikiPagePlan(BaseModel):
    slug: str            # URL-safe identifier, e.g. "getting-started"
    title: str           # Display title, e.g. "Getting Started"
    description: str     # What this page should cover
    priority: int        # Generation order (1 = first)
    promptHint: str      # Guidance for the content generation agent


class WikiStructure(BaseModel):
    pages: list[WikiPagePlan]


class WikiPage(BaseModel):
    slug: str
    title: str
    content: str         # Full markdown content


# ── Top-level (legacy, kept for backward compat) ──
class Documentation(BaseModel):
    overview: Overview
    gettingStarted: GettingStarted
    coreArchitecture: CoreArchitecture
    apiReference: APIReference
    usagePatterns: UsagePatterns
    developmentGuide: DevelopmentGuide
    repoContext: str


class WikiDocumentation(BaseModel):
    pages: list[WikiPage]
    repoContext: str
