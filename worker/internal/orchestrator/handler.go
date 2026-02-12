package orchestrator

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"path/filepath"
	"strings"
	"time"

	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	otelmetric "go.opentelemetry.io/otel/metric"
	oteltrace "go.opentelemetry.io/otel/trace"

	"github.com/stym06/quickgithub/worker/internal/cache"
	"github.com/stym06/quickgithub/worker/internal/config"
	"github.com/stym06/quickgithub/worker/internal/db"
	ghclient "github.com/stym06/quickgithub/worker/internal/github"
	"github.com/stym06/quickgithub/worker/internal/llm"
	"github.com/stym06/quickgithub/worker/internal/notify"
	qgotel "github.com/stym06/quickgithub/worker/internal/otel"
	"github.com/stym06/quickgithub/worker/internal/parser"
	"github.com/stym06/quickgithub/worker/internal/tasks"
)

var indexTracer = otel.Tracer("quickgithub-worker/orchestrator")

// TaskHandler holds all initialized clients needed by the orchestrator.
type TaskHandler struct {
	Pool   *pgxpool.Pool
	Redis  *redis.Client
	LLM    *llm.Client
	Config *config.Config
	Email  *notify.EmailClient
}

// HandleIndexRepo is the main orchestrator for the repo:index task.
func (h *TaskHandler) HandleIndexRepo(ctx context.Context, t *asynq.Task) error {
	start := time.Now()

	payload, err := tasks.UnmarshalPayload(t.Payload())
	if err != nil {
		return fmt.Errorf("unmarshaling payload: %w", err)
	}

	repoSlug := payload.Owner + "/" + payload.Repo

	// Root span for the entire indexing job.
	ctx, rootSpan := indexTracer.Start(ctx, "indexing.repo",
		oteltrace.WithAttributes(
			attribute.String("repo.owner", payload.Owner),
			attribute.String("repo.name", payload.Repo),
			attribute.String("repo.full_name", repoSlug),
		),
	)
	defer rootSpan.End()

	log.Printf("[%s] starting indexing", repoSlug)

	// Acquire lock to prevent duplicate indexing.
	locked, err := cache.AcquireLock(ctx, h.Redis, payload.Owner, payload.Repo)
	if err != nil {
		rootSpan.SetStatus(codes.Error, err.Error())
		rootSpan.RecordError(err)
		return fmt.Errorf("acquiring lock: %w", err)
	}
	if !locked {
		log.Printf("[%s] already being indexed by another worker, skipping", repoSlug)
		rootSpan.SetAttributes(attribute.String("indexing.skip_reason", "already_locked"))
		return nil
	}

	// Determine if asynq has more retries remaining.
	retryCount, _ := asynq.GetRetryCount(ctx)
	maxRetry, _ := asynq.GetMaxRetry(ctx)

	// Ensure lock is released and status is updated on exit.
	var finalErr error
	defer func() {
		if r := recover(); r != nil {
			finalErr = fmt.Errorf("panic: %v", r)
			log.Printf("[%s] panic recovered: %v", repoSlug, r)
		}

		durationMs := time.Since(start).Milliseconds()
		qgotel.IndexingDuration.Record(ctx, durationMs,
			otelmetric.WithAttributes(attribute.String("repo.full_name", repoSlug)),
		)

		if finalErr != nil {
			qgotel.IndexingErrors.Add(ctx, 1,
				otelmetric.WithAttributes(attribute.String("repo.full_name", repoSlug)),
			)

			rootSpan.SetStatus(codes.Error, finalErr.Error())
			rootSpan.RecordError(finalErr)

			errMsg := finalErr.Error()

			// Non-retryable errors (parse failures, malformed LLM output) should
			// not be retried — treat them as final regardless of retry budget.
			isNonRetryable := errors.As(finalErr, new(*llm.NonRetryableError))
			isFinalAttempt := retryCount >= maxRetry || isNonRetryable

			if isFinalAttempt {
				// Final attempt: mark as FAILED, release lock, send failure email.
				qgotel.IndexingTotal.Add(ctx, 1,
					otelmetric.WithAttributes(
						attribute.String("repo.full_name", repoSlug),
						attribute.String("status", "failed"),
					),
				)
				_ = db.UpdateRepoStatus(ctx, h.Pool, payload.RepoID, "FAILED", 0, &errMsg)
				_ = cache.SetIndexingStatus(ctx, h.Redis, payload.Owner, payload.Repo, "FAILED", 0, errMsg)
				cache.ReleaseLock(ctx, h.Redis, payload.Owner, payload.Repo)

				if h.Email != nil {
					if email, err := db.GetRepoClaimerEmail(ctx, h.Pool, payload.RepoID); err == nil && email != "" {
						if sendErr := h.Email.SendIndexingFailed(ctx, email, repoSlug, errMsg); sendErr != nil {
							log.Printf("[%s] failed to send failure email: %v", repoSlug, sendErr)
						}
					}
				}
				log.Printf("[%s] indexing permanently failed in %v: %v", repoSlug, time.Since(start), finalErr)
			} else {
				// More retries remain: keep lock, set PENDING so user can't re-submit.
				_ = db.UpdateRepoStatus(ctx, h.Pool, payload.RepoID, "PENDING", 0, nil)
				_ = cache.SetIndexingStatus(ctx, h.Redis, payload.Owner, payload.Repo, "RETRYING", 0, "Retrying after error...")
				log.Printf("[%s] indexing failed (attempt %d/%d), will retry: %v", repoSlug, retryCount+1, maxRetry+1, finalErr)
			}
		} else {
			cache.ReleaseLock(ctx, h.Redis, payload.Owner, payload.Repo)
			qgotel.IndexingTotal.Add(ctx, 1,
				otelmetric.WithAttributes(
					attribute.String("repo.full_name", repoSlug),
					attribute.String("status", "success"),
				),
			)
		}
	}()

	progress := func(status string, pct int, message string) {
		_ = db.UpdateRepoStatus(ctx, h.Pool, payload.RepoID, status, pct, nil)
		_ = cache.SetIndexingStatus(ctx, h.Redis, payload.Owner, payload.Repo, status, pct, message)
		log.Printf("[%s] %s %d%% - %s", repoSlug, status, pct, message)
	}

	// Stage: Fetch repository tree.
	progress("FETCHING", 10, "Fetching repository tree...")

	ctx, fetchTreeSpan := indexTracer.Start(ctx, "indexing.fetch_tree")
	gh := ghclient.NewClient(payload.AccessToken)
	tree, err := gh.FetchTree(ctx, payload.Owner, payload.Repo)
	fetchTreeSpan.SetAttributes(attribute.Int("tree.entries", len(tree)))
	fetchTreeSpan.End()
	if err != nil {
		finalErr = fmt.Errorf("fetching tree: %w", err)
		return finalErr
	}
	log.Printf("[%s] fetched tree with %d entries", repoSlug, len(tree))

	// Stage: Filter tree.
	filtered := ghclient.FilterTree(tree, h.Config.MaxFilesPerRepo, h.Config.MaxFileSizeBytes, h.Config.MaxCriticalFileSizeBytes)
	log.Printf("[%s] filtered to %d files", repoSlug, len(filtered))

	// Stage: Download files.
	progress("FETCHING", 20, fmt.Sprintf("Downloading %d files...", len(filtered)))

	ctx, fetchFilesSpan := indexTracer.Start(ctx, "indexing.fetch_files",
		oteltrace.WithAttributes(attribute.Int("files.count", len(filtered))),
	)
	paths := make([]string, len(filtered))
	for i, entry := range filtered {
		paths[i] = entry.Path
	}

	// Use the critical file size limit for downloads since FilterTree may have
	// included critical files up to MaxCriticalFileSizeBytes.
	downloadSizeLimit := h.Config.MaxCriticalFileSizeBytes
	if downloadSizeLimit < h.Config.MaxFileSizeBytes {
		downloadSizeLimit = h.Config.MaxFileSizeBytes
	}
	files, err := gh.FetchFiles(ctx, payload.Owner, payload.Repo, "HEAD", paths, downloadSizeLimit)
	fetchFilesSpan.SetAttributes(attribute.Int("files.downloaded", len(files)))
	fetchFilesSpan.End()
	if err != nil {
		finalErr = fmt.Errorf("fetching files: %w", err)
		return finalErr
	}
	log.Printf("[%s] downloaded %d files", repoSlug, len(files))

	// Stage: Parse source code.
	progress("PARSING", 30, "Parsing source code...")

	ctx, parseSpan := indexTracer.Start(ctx, "indexing.parse")
	p := parser.NewParser()
	var structures []tasks.FileStructure
	var readme string
	var packageFilesContent strings.Builder
	var fileTreeLines []string

	for filePath, content := range files {
		fileTreeLines = append(fileTreeLines, filePath)

		// Capture README.
		base := strings.ToLower(filepath.Base(filePath))
		if base == "readme.md" || base == "readme" {
			readme = string(content)
		}

		// Capture package/config files.
		if isPackageFile(base) {
			packageFilesContent.WriteString(fmt.Sprintf("--- %s ---\n%s\n\n", filePath, string(content)))
		}

		// Parse with tree-sitter.
		ext := strings.ToLower(filepath.Ext(filePath))
		lang := parser.GetLanguage(ext)
		langName := parser.GetLanguageName(ext)

		var pfs parser.FileStructure
		if lang != nil {
			tsTree, parseErr := p.Parse(content, lang)
			if parseErr != nil {
				log.Printf("[%s] tree-sitter parse failed for %s: %v", repoSlug, filePath, parseErr)
				pfs = parser.ExtractStructure(content, nil, langName)
			} else {
				pfs = parser.ExtractStructure(content, tsTree, langName)
			}
		} else {
			pfs = parser.ExtractStructure(content, nil, langName)
		}

		pfs.Path = filePath
		fs := convertFileStructure(pfs)

		// Attach full source code for key files so the LLM can produce
		// deeper, more accurate documentation.
		if isKeyFile(filePath) {
			fs.IsKeyFile = true
			fs.SourceCode = string(content)
		}

		structures = append(structures, fs)
	}
	parseSpan.SetAttributes(attribute.Int("files.parsed", len(structures)))
	parseSpan.End()

	log.Printf("[%s] parsed %d files", repoSlug, len(structures))

	// Build file tree string.
	fileTree := strings.Join(fileTreeLines, "\n")

	// Stage: LLM pipeline.
	progress("ANALYZING", 40, "Analyzing with AI...")

	ctx, llmSpan := indexTracer.Start(ctx, "indexing.llm_pipeline")
	doc, err := llm.RunPipeline(ctx, h.LLM, structures, readme, fileTree, packageFilesContent.String(), func(status string, pct int, message string) {
		progress(status, pct, message)
	})
	llmSpan.End()
	if err != nil {
		finalErr = fmt.Errorf("LLM pipeline: %w", err)
		return finalErr
	}
	log.Printf("[%s] LLM pipeline completed", repoSlug)

	// Stage: Save documentation.
	progress("ANALYZING", 95, "Saving documentation...")

	ctx, saveSpan := indexTracer.Start(ctx, "indexing.save")
	if err := db.SaveDocumentation(ctx, h.Pool, payload.RepoID, doc); err != nil {
		saveSpan.End()
		finalErr = fmt.Errorf("saving documentation: %w", err)
		return finalErr
	}

	if err := db.UpdateRepoStatus(ctx, h.Pool, payload.RepoID, "COMPLETED", 100, nil); err != nil {
		saveSpan.End()
		finalErr = fmt.Errorf("updating repo status: %w", err)
		return finalErr
	}

	// Cache documentation in Redis.
	docsJSON, err := json.Marshal(doc)
	if err != nil {
		log.Printf("[%s] warning: failed to marshal docs for cache: %v", repoSlug, err)
	} else {
		if err := cache.SetDocsCache(ctx, h.Redis, payload.Owner, payload.Repo, docsJSON); err != nil {
			log.Printf("[%s] warning: failed to cache docs: %v", repoSlug, err)
		}
	}
	saveSpan.End()

	// Send success email notification.
	if h.Email != nil {
		if email, err := db.GetRepoClaimerEmail(ctx, h.Pool, payload.RepoID); err == nil && email != "" {
			if sendErr := h.Email.SendIndexingComplete(ctx, email, repoSlug); sendErr != nil {
				log.Printf("[%s] failed to send success email: %v", repoSlug, sendErr)
			}
		}
	}

	progress("COMPLETED", 100, "Documentation ready!")
	log.Printf("[%s] indexing completed in %v", repoSlug, time.Since(start))

	return nil
}

// isKeyFile returns true for files whose full source code should be sent to the
// LLM instead of just parsed signatures. These are entry points, READMEs, and
// config files that provide critical context for documentation generation.
func isKeyFile(filePath string) bool {
	base := strings.ToLower(filepath.Base(filePath))
	nameNoExt := strings.TrimSuffix(base, filepath.Ext(base))

	// READMEs and config files.
	switch base {
	case "readme.md", "readme", "readme.rst", "readme.txt",
		"package.json", "go.mod", "cargo.toml", "pyproject.toml",
		"setup.py", "requirements.txt", "gemfile", "pom.xml",
		"build.gradle", "composer.json",
		"dockerfile", "makefile",
		"docker-compose.yml", "docker-compose.yaml":
		return true
	}

	// Entry point files.
	entryPointNames := map[string]bool{
		"main": true, "index": true, "app": true, "server": true, "cli": true,
	}
	if entryPointNames[nameNoExt] {
		return true
	}

	// cmd/**/*.go (Go CLI entry points).
	parts := strings.Split(filePath, "/")
	if len(parts) >= 2 && strings.ToLower(parts[0]) == "cmd" {
		return true
	}

	return false
}

// isPackageFile returns true for files that contain project metadata.
func isPackageFile(baseName string) bool {
	switch baseName {
	case "package.json", "go.mod", "cargo.toml", "pyproject.toml",
		"setup.py", "requirements.txt", "gemfile", "pom.xml",
		"build.gradle", "composer.json":
		return true
	}
	return false
}

// convertFileStructure converts parser.FileStructure to tasks.FileStructure.
func convertFileStructure(pfs parser.FileStructure) tasks.FileStructure {
	fs := tasks.FileStructure{
		Path:      pfs.Path,
		Language:  pfs.Language,
		Imports:   pfs.Imports,
		Exports:   pfs.Exports,
		Constants: pfs.Constants,
		TypeDefs:  pfs.TypeDefs,
	}

	for _, fn := range pfs.Functions {
		fs.Functions = append(fs.Functions, tasks.FunctionSig{
			Name:       fn.Name,
			Params:     fn.Params,
			ReturnType: fn.ReturnType,
			IsExported: fn.IsExported,
			DocComment: fn.DocComment,
		})
	}

	for _, cls := range pfs.Classes {
		c := tasks.ClassSig{
			Name:       cls.Name,
			Fields:     cls.Fields,
			IsExported: cls.IsExported,
		}
		for _, m := range cls.Methods {
			c.Methods = append(c.Methods, tasks.FunctionSig{
				Name:       m.Name,
				Params:     m.Params,
				ReturnType: m.ReturnType,
				IsExported: m.IsExported,
				DocComment: m.DocComment,
			})
		}
		fs.Classes = append(fs.Classes, c)
	}

	return fs
}
