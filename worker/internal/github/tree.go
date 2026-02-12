package github

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel/attribute"
	otelmetric "go.opentelemetry.io/otel/metric"

	qgotel "github.com/stym06/quickgithub/worker/internal/otel"
)

// TreeEntry represents a single entry from the GitHub Git Trees API.
type TreeEntry struct {
	Path string `json:"path"`
	Type string `json:"type"` // "blob" or "tree"
	Size int    `json:"size"`
	SHA  string `json:"sha"`
}

type treeResponse struct {
	SHA       string      `json:"sha"`
	Tree      []TreeEntry `json:"tree"`
	Truncated bool        `json:"truncated"`
}

// FetchTree retrieves the full recursive file tree for a repository.
func (c *Client) FetchTree(ctx context.Context, owner, repo string) ([]TreeEntry, error) {
	qgotel.GHAPICallsTotal.Add(ctx, 1,
		otelmetric.WithAttributes(attribute.String("github.api.endpoint", "trees")),
	)

	path := fmt.Sprintf("/repos/%s/%s/git/trees/HEAD?recursive=1", owner, repo)

	resp, err := c.doAPI(ctx, "GET", path)
	if err != nil {
		return nil, fmt.Errorf("fetching tree: %w", err)
	}

	var result treeResponse
	if err := decodeJSON(resp, &result); err != nil {
		return nil, fmt.Errorf("decoding tree response: %w", err)
	}

	if result.Truncated {
		// For very large repos, the recursive tree may be truncated.
		// We still use what we got - FilterTree will prioritize the most important files.
		fmt.Printf("warning: tree for %s/%s was truncated, using partial results\n", owner, repo)
	}

	// Filter to only blobs (files), not trees (directories).
	blobs := make([]TreeEntry, 0, len(result.Tree))
	for _, entry := range result.Tree {
		if entry.Type == "blob" {
			blobs = append(blobs, entry)
		}
	}

	return blobs, nil
}
