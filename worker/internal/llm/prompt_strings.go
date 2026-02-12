package llm

import (
	_ "embed"
	"encoding/json"
	"log"
)

//go:embed prompts.json
var promptsJSON []byte

var prompts struct {
	SystemOverview    string `json:"systemOverview"`
	ModuleAnalysis    string `json:"moduleAnalysis"`
	Synthesis         string `json:"synthesis"`
	ContextGeneration string `json:"contextGeneration"`
	QAChat            string `json:"qaChat"`
}

func init() {
	if err := json.Unmarshal(promptsJSON, &prompts); err != nil {
		log.Fatalf("failed to parse prompts.json: %v", err)
	}
}
