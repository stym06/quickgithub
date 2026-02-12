package db

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stym06/quickgithub/worker/internal/tasks"
)

// Repo mirrors the repository row from the database.
type Repo struct {
	ID        string
	Owner     string
	Repo      string
	Status    string
	Progress  int
	Error     *string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// NewPool creates a new pgx connection pool.
func NewPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parsing database URL: %w", err)
	}

	cfg.MaxConns = 10
	cfg.MinConns = 2

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("creating connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("pinging database: %w", err)
	}

	return pool, nil
}

// UpdateRepoStatus updates the indexing status and progress of a repository.
func UpdateRepoStatus(ctx context.Context, pool *pgxpool.Pool, repoID, status string, progress int, errorMessage *string) error {
	query := `
		UPDATE "Repo"
		SET status = $1::text::"RepoStatus", progress = $2, "errorMessage" = $3, "updatedAt" = NOW()
		WHERE id = $4
	`
	_, err := pool.Exec(ctx, query, status, progress, errorMessage, repoID)
	if err != nil {
		return fmt.Errorf("updating repo status: %w", err)
	}
	return nil
}

// SaveDocumentation upserts the generated documentation for a repository into the Documentation table.
func SaveDocumentation(ctx context.Context, pool *pgxpool.Pool, repoID string, docs tasks.Documentation) error {
	overviewJSON, err := json.Marshal(docs.SystemOverview)
	if err != nil {
		return fmt.Errorf("marshaling systemOverview: %w", err)
	}
	archJSON, err := json.Marshal(docs.Architecture)
	if err != nil {
		return fmt.Errorf("marshaling architecture: %w", err)
	}
	techJSON, err := json.Marshal(docs.TechStack)
	if err != nil {
		return fmt.Errorf("marshaling techStack: %w", err)
	}
	modulesJSON, err := json.Marshal(docs.KeyModules)
	if err != nil {
		return fmt.Errorf("marshaling keyModules: %w", err)
	}
	entryJSON, err := json.Marshal(docs.EntryPoints)
	if err != nil {
		return fmt.Errorf("marshaling entryPoints: %w", err)
	}
	depsJSON, err := json.Marshal(docs.Dependencies)
	if err != nil {
		return fmt.Errorf("marshaling dependencies: %w", err)
	}

	query := `
		INSERT INTO "Documentation" (id, "repoId", "systemOverview", architecture, "techStack", "keyModules", "entryPoints", dependencies, "repoContext", "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
		ON CONFLICT ("repoId") DO UPDATE SET
			"systemOverview" = EXCLUDED."systemOverview",
			architecture = EXCLUDED.architecture,
			"techStack" = EXCLUDED."techStack",
			"keyModules" = EXCLUDED."keyModules",
			"entryPoints" = EXCLUDED."entryPoints",
			dependencies = EXCLUDED.dependencies,
			"repoContext" = EXCLUDED."repoContext",
			"updatedAt" = NOW()
	`
	_, err = pool.Exec(ctx, query, repoID, overviewJSON, archJSON, techJSON, modulesJSON, entryJSON, depsJSON, docs.RepoContext)
	if err != nil {
		return fmt.Errorf("saving documentation: %w", err)
	}
	return nil
}

// GetRepoClaimerEmail returns the email of the user who claimed the repo.
func GetRepoClaimerEmail(ctx context.Context, pool *pgxpool.Pool, repoID string) (string, error) {
	query := `SELECT u.email FROM "User" u JOIN "Repo" r ON r."claimedById" = u.id WHERE r.id = $1`
	var email string
	err := pool.QueryRow(ctx, query, repoID).Scan(&email)
	if err != nil {
		return "", fmt.Errorf("getting claimer email for repo %s: %w", repoID, err)
	}
	return email, nil
}

// GetRepo retrieves a repository by its ID.
func GetRepo(ctx context.Context, pool *pgxpool.Pool, repoID string) (*Repo, error) {
	query := `
		SELECT id, owner, name, status, progress, "errorMessage", "createdAt", "updatedAt"
		FROM "Repo"
		WHERE id = $1
	`
	row := pool.QueryRow(ctx, query, repoID)

	var r Repo
	err := row.Scan(&r.ID, &r.Owner, &r.Repo, &r.Status, &r.Progress, &r.Error, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("getting repo %s: %w", repoID, err)
	}
	return &r, nil
}
