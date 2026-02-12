package llm

import (
	"fmt"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/stym06/quickgithub/worker/internal/tasks"
)

// SystemOverviewPrompt builds the system + user messages for the overview stage.
func SystemOverviewPrompt(readmeContent, fileTree, packageFiles string) (string, []anthropic.MessageParam) {
	userContent := fmt.Sprintf(`Analyze this repository and generate a system overview.

## README
%s

## File Tree
%s

## Package/Config Files
%s

Use the generate_system_overview tool to provide the structured overview.`, readmeContent, fileTree, packageFiles)

	messages := []anthropic.MessageParam{
		anthropic.NewUserMessage(
			anthropic.NewTextBlock(userContent),
		),
	}

	return prompts.SystemOverview, messages
}

// ModuleAnalysisPrompt builds messages for analyzing a directory chunk.
func ModuleAnalysisPrompt(modulePath string, structures []tasks.FileStructure) (string, []anthropic.MessageParam) {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("## Module: %s\n\n", modulePath))

	for _, f := range structures {
		sb.WriteString(fmt.Sprintf("### File: %s (%s)\n", f.Path, f.Language))

		if len(f.Imports) > 0 {
			sb.WriteString("**Imports:** " + strings.Join(f.Imports, ", ") + "\n")
		}
		if len(f.Exports) > 0 {
			sb.WriteString("**Exports:** " + strings.Join(f.Exports, ", ") + "\n")
		}

		if len(f.Functions) > 0 {
			sb.WriteString("**Functions:**\n")
			for _, fn := range f.Functions {
				exported := ""
				if fn.IsExported {
					exported = " [exported]"
				}
				sb.WriteString(fmt.Sprintf("- %s(%s) → %s%s\n", fn.Name, fn.Params, fn.ReturnType, exported))
				if fn.DocComment != "" {
					sb.WriteString(fmt.Sprintf("  // %s\n", fn.DocComment))
				}
			}
		}

		if len(f.Classes) > 0 {
			sb.WriteString("**Classes/Structs:**\n")
			for _, cls := range f.Classes {
				exported := ""
				if cls.IsExported {
					exported = " [exported]"
				}
				sb.WriteString(fmt.Sprintf("- %s%s\n", cls.Name, exported))
				if len(cls.Fields) > 0 {
					sb.WriteString(fmt.Sprintf("  Fields: %s\n", strings.Join(cls.Fields, ", ")))
				}
				for _, m := range cls.Methods {
					sb.WriteString(fmt.Sprintf("  - %s(%s) → %s\n", m.Name, m.Params, m.ReturnType))
				}
			}
		}

		if len(f.TypeDefs) > 0 {
			sb.WriteString("**Type Definitions:** " + strings.Join(f.TypeDefs, ", ") + "\n")
		}
		if len(f.Constants) > 0 {
			sb.WriteString("**Constants:** " + strings.Join(f.Constants, ", ") + "\n")
		}
		sb.WriteString("\n")
	}

	sb.WriteString("\nUse the analyze_module tool to provide the structured module analysis.")

	messages := []anthropic.MessageParam{
		anthropic.NewUserMessage(
			anthropic.NewTextBlock(sb.String()),
		),
	}

	return prompts.ModuleAnalysis, messages
}

// SynthesisPrompt builds messages for the cross-cutting synthesis stage.
func SynthesisPrompt(overviewJSON string, moduleAnalyses string) (string, []anthropic.MessageParam) {
	userContent := fmt.Sprintf(`## System Overview
%s

## Module Analyses
%s

Use the synthesize_documentation tool to provide the structured cross-cutting documentation.`, overviewJSON, moduleAnalyses)

	messages := []anthropic.MessageParam{
		anthropic.NewUserMessage(
			anthropic.NewTextBlock(userContent),
		),
	}

	return prompts.Synthesis, messages
}

// ContextGenerationPrompt builds messages for generating a Q&A context blob.
func ContextGenerationPrompt(fullDocumentation string) (string, []anthropic.MessageParam) {
	messages := []anthropic.MessageParam{
		anthropic.NewUserMessage(
			anthropic.NewTextBlock(fmt.Sprintf("Generate a Q&A context summary from this documentation:\n\n%s", fullDocumentation)),
		),
	}

	return prompts.ContextGeneration, messages
}

// QAChatSystemPrompt builds the system prompt for the Q&A chat.
func QAChatSystemPrompt(repoContext, overview, architecture string) string {
	return fmt.Sprintf(prompts.QAChat, repoContext, overview, architecture)
}
