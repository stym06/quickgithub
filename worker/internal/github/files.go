package github

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"sync"

	"go.opentelemetry.io/otel/attribute"
	otelmetric "go.opentelemetry.io/otel/metric"
	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/semaphore"

	qgotel "github.com/stym06/quickgithub/worker/internal/otel"
)

const maxConcurrentDownloads = 20

// FetchFiles downloads file contents concurrently from raw.githubusercontent.com.
// Files that fail to download are skipped with a warning.
// Files exceeding maxSizeBytes (based on Content-Length) are skipped.
func (c *Client) FetchFiles(ctx context.Context, owner, repo, branch string, paths []string, maxSizeBytes int) (map[string][]byte, error) {
	results := make(map[string][]byte, len(paths))
	var mu sync.Mutex

	sem := semaphore.NewWeighted(maxConcurrentDownloads)
	g, ctx := errgroup.WithContext(ctx)

	for _, p := range paths {
		path := p
		g.Go(func() error {
			if err := sem.Acquire(ctx, 1); err != nil {
				return err
			}
			defer sem.Release(1)

			qgotel.GHAPICallsTotal.Add(ctx, 1,
				otelmetric.WithAttributes(attribute.String("github.api.endpoint", "files")),
			)

			data, err := c.downloadFile(ctx, owner, repo, branch, path, maxSizeBytes)
			if err != nil {
				log.Printf("warning: skipping %s: %v", path, err)
				return nil // Skip failed files, don't abort batch.
			}

			mu.Lock()
			results[path] = data
			mu.Unlock()
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, fmt.Errorf("fetching files: %w", err)
	}

	return results, nil
}

// downloadFile fetches a single file from raw.githubusercontent.com.
func (c *Client) downloadFile(ctx context.Context, owner, repo, branch, path string, maxSizeBytes int) ([]byte, error) {
	url := fmt.Sprintf("%s/%s/%s/%s/%s", rawBaseURL, owner, repo, branch, path)

	resp, err := c.doRaw(ctx, url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}

	// Check Content-Length before reading.
	if cl := resp.Header.Get("Content-Length"); cl != "" {
		size, err := strconv.Atoi(cl)
		if err == nil && size > maxSizeBytes {
			return nil, fmt.Errorf("file too large: %d bytes (max %d)", size, maxSizeBytes)
		}
	}

	// Read with a size limit to protect against missing/wrong Content-Length.
	limited := io.LimitReader(resp.Body, int64(maxSizeBytes)+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		return nil, fmt.Errorf("reading body: %w", err)
	}

	if len(data) > maxSizeBytes {
		return nil, fmt.Errorf("file too large: read %d bytes (max %d)", len(data), maxSizeBytes)
	}

	return data, nil
}
