package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config holds all worker configuration loaded from environment variables.
type Config struct {
	DatabaseURL              string
	RedisURL                 string
	AnthropicAPIKey          string
	OpenAIAPIKey             string
	LLMProvider              string // "anthropic" or "openai"
	WorkerConcurrency        int
	MaxFilesPerRepo          int
	MaxFileSizeBytes         int
	MaxCriticalFileSizeBytes int    // Higher limit for critical files (READMEs, configs)
	APIPort                  string // HTTP port for enqueue API
	ResendAPIKey             string // RESEND_API_KEY (optional — no email if empty)
	EmailFrom                string // NOTIFICATION_FROM_EMAIL
	AppBaseURL               string // APP_BASE_URL for constructing links
}

// Load reads configuration from environment variables, applying defaults where appropriate.
func Load() (*Config, error) {
	provider := os.Getenv("LLM_PROVIDER")
	if provider == "" {
		provider = "anthropic"
	}

	emailFrom := os.Getenv("NOTIFICATION_FROM_EMAIL")
	if emailFrom == "" {
		emailFrom = "QuickGitHub <noreply@quickgithub.com>"
	}
	appBaseURL := os.Getenv("APP_BASE_URL")
	if appBaseURL == "" {
		appBaseURL = "http://localhost:3000"
	}

	cfg := &Config{
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		RedisURL:          os.Getenv("REDIS_URL"),
		AnthropicAPIKey:   os.Getenv("ANTHROPIC_API_KEY"),
		OpenAIAPIKey:      os.Getenv("OPENAI_API_KEY"),
		LLMProvider:       provider,
		WorkerConcurrency:        5,
		MaxFilesPerRepo:          2000,
		MaxFileSizeBytes:         102400,
		MaxCriticalFileSizeBytes: 512000,
		APIPort:                  "8080",
		ResendAPIKey:      os.Getenv("RESEND_API_KEY"),
		EmailFrom:         emailFrom,
		AppBaseURL:        appBaseURL,
	}

	if v := os.Getenv("WORKER_API_PORT"); v != "" {
		cfg.APIPort = v
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.RedisURL == "" {
		return nil, fmt.Errorf("REDIS_URL is required")
	}

	switch cfg.LLMProvider {
	case "anthropic":
		if cfg.AnthropicAPIKey == "" {
			return nil, fmt.Errorf("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic")
		}
	case "openai":
		if cfg.OpenAIAPIKey == "" {
			return nil, fmt.Errorf("OPENAI_API_KEY is required when LLM_PROVIDER=openai")
		}
	default:
		return nil, fmt.Errorf("invalid LLM_PROVIDER %q: must be \"anthropic\" or \"openai\"", cfg.LLMProvider)
	}

	if v := os.Getenv("WORKER_CONCURRENCY"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid WORKER_CONCURRENCY: %w", err)
		}
		cfg.WorkerConcurrency = n
	}

	if v := os.Getenv("MAX_FILES_PER_REPO"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid MAX_FILES_PER_REPO: %w", err)
		}
		cfg.MaxFilesPerRepo = n
	}

	if v := os.Getenv("MAX_FILE_SIZE_BYTES"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid MAX_FILE_SIZE_BYTES: %w", err)
		}
		cfg.MaxFileSizeBytes = n
	}

	return cfg, nil
}
