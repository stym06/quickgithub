package llm

import "github.com/anthropics/anthropic-sdk-go"

// SystemOverviewTool returns the tool definition for generating a system overview.
func SystemOverviewTool() anthropic.ToolUnionParam {
	return anthropic.ToolUnionParam{
		OfTool: &anthropic.ToolParam{
			Name:        "generate_system_overview",
			Description: anthropic.String("Generate a comprehensive system overview for a GitHub repository."),
			InputSchema: anthropic.ToolInputSchemaParam{
				Properties: map[string]interface{}{
					"description": map[string]interface{}{
						"type":        "string",
						"description": "A concise 2-3 sentence description of what this repository does.",
					},
					"purpose": map[string]interface{}{
						"type":        "string",
						"description": "The primary purpose and problem this project solves.",
					},
					"keyFeatures": map[string]interface{}{
						"type": "array",
						"items": map[string]interface{}{
							"type": "string",
						},
						"description": "5-10 key features or capabilities of the project.",
					},
					"gettingStarted": map[string]interface{}{
						"type":        "string",
						"description": "Brief getting started guide (install + basic usage) in markdown.",
					},
					"mainLanguage": map[string]interface{}{
						"type":        "string",
						"description": "The primary programming language used.",
					},
					"repoType": map[string]interface{}{
						"type":        "string",
						"description": "Type of project: library, framework, application, CLI tool, API, etc.",
					},
					"setupGuide": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"prerequisites": map[string]interface{}{"type": "string", "description": "System requirements, language/runtime versions needed"},
							"installation":  map[string]interface{}{"type": "string", "description": "Step-by-step install instructions (clone, deps)"},
							"configuration": map[string]interface{}{"type": "string", "description": "Environment variables, config files to set up"},
							"running":       map[string]interface{}{"type": "string", "description": "How to start/run the project locally"},
							"testing":       map[string]interface{}{"type": "string", "description": "How to run the test suite"},
						},
						"required": []string{"prerequisites", "installation", "running"},
					},
				},
				Required: []string{"description", "purpose", "keyFeatures", "gettingStarted", "mainLanguage", "repoType", "setupGuide"},
			},
		},
	}
}

// ModuleAnalysisTool returns the tool definition for analyzing a source code module.
func ModuleAnalysisTool() anthropic.ToolUnionParam {
	return anthropic.ToolUnionParam{
		OfTool: &anthropic.ToolParam{
			Name:        "analyze_module",
			Description: anthropic.String("Analyze a source code module/directory and generate documentation for it."),
			InputSchema: anthropic.ToolInputSchemaParam{
				Properties: map[string]interface{}{
					"moduleName": map[string]interface{}{
						"type":        "string",
						"description": "Human-readable name for this module.",
					},
					"description": map[string]interface{}{
						"type":        "string",
						"description": "Detailed description of what this module does and its role in the project.",
					},
					"keyExports": map[string]interface{}{
						"type": "array",
						"items": map[string]interface{}{
							"type": "object",
							"properties": map[string]interface{}{
								"name":        map[string]interface{}{"type": "string"},
								"type":        map[string]interface{}{"type": "string", "description": "function, class, constant, type, etc."},
								"description": map[string]interface{}{"type": "string"},
							},
							"required": []string{"name", "type", "description"},
						},
						"description": "Key exported symbols from this module.",
					},
					"internalDependencies": map[string]interface{}{
						"type": "array",
						"items": map[string]interface{}{
							"type": "string",
						},
						"description": "Other modules within this project that this module depends on.",
					},
					"publicAPI": map[string]interface{}{
						"type": "array",
						"items": map[string]interface{}{
							"type": "string",
						},
						"description": "Public API surface: function signatures, class names, etc.",
					},
					"sourceFiles": map[string]interface{}{
						"type": "array",
						"items": map[string]interface{}{
							"type": "string",
						},
						"description": "Key source file paths in this module (e.g. 'src/auth/login.ts')",
					},
				},
				Required: []string{"moduleName", "description", "keyExports", "internalDependencies", "publicAPI", "sourceFiles"},
			},
		},
	}
}

// SynthesisTool returns the tool definition for the synthesis stage.
func SynthesisTool() anthropic.ToolUnionParam {
	return anthropic.ToolUnionParam{
		OfTool: &anthropic.ToolParam{
			Name:        "synthesize_documentation",
			Description: anthropic.String("Synthesize cross-cutting documentation: architecture, tech stack, entry points, and dependencies."),
			InputSchema: anthropic.ToolInputSchemaParam{
				Properties: map[string]interface{}{
					"architecture": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"description": map[string]interface{}{"type": "string", "description": "High-level architecture overview in markdown."},
							"components": map[string]interface{}{
								"type": "array",
								"items": map[string]interface{}{
									"type": "object",
									"properties": map[string]interface{}{
										"name":        map[string]interface{}{"type": "string"},
										"description": map[string]interface{}{"type": "string"},
										"path":        map[string]interface{}{"type": "string"},
										"dependsOn":   map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}},
									},
									"required": []string{"name", "description", "path"},
								},
							},
							"dataFlow":    map[string]interface{}{"type": "string", "description": "Description of how data flows through the system."},
							"diagrams": map[string]interface{}{
								"type": "array",
								"items": map[string]interface{}{
									"type": "object",
									"properties": map[string]interface{}{
										"title":   map[string]interface{}{"type": "string"},
										"type":    map[string]interface{}{"type": "string", "description": "mermaid diagram type: flowchart, sequenceDiagram, classDiagram, etc."},
										"content": map[string]interface{}{"type": "string", "description": "Valid Mermaid diagram code."},
									},
									"required": []string{"title", "type", "content"},
								},
							},
						},
						"required": []string{"description", "components", "dataFlow"},
					},
					"techStack": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"languages":      map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}},
							"frameworks":     map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}},
							"databases":      map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}},
							"tools":          map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}},
							"infrastructure": map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}},
						},
						"required": []string{"languages", "frameworks"},
					},
					"entryPoints": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"main":   entryPointArraySchema(),
							"cli":    entryPointArraySchema(),
							"api":    entryPointArraySchema(),
							"config": entryPointArraySchema(),
						},
						"required": []string{"main"},
					},
					"dependencies": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"runtime": map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}},
							"dev":     map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}},
							"key": map[string]interface{}{
								"type": "array",
								"items": map[string]interface{}{
									"type": "object",
									"properties": map[string]interface{}{
										"name":    map[string]interface{}{"type": "string"},
										"purpose": map[string]interface{}{"type": "string"},
									},
									"required": []string{"name", "purpose"},
								},
							},
						},
						"required": []string{"runtime", "key"},
					},
				},
				Required: []string{"architecture", "techStack", "entryPoints", "dependencies"},
			},
		},
	}
}

func entryPointArraySchema() map[string]interface{} {
	return map[string]interface{}{
		"type": "array",
		"items": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"name":        map[string]interface{}{"type": "string"},
				"path":        map[string]interface{}{"type": "string"},
				"description": map[string]interface{}{"type": "string"},
				"type":        map[string]interface{}{"type": "string"},
			},
			"required": []string{"name", "path", "description"},
		},
	}
}
