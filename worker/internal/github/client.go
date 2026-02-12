package github

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel/attribute"
	otelmetric "go.opentelemetry.io/otel/metric"

	qgotel "github.com/stym06/quickgithub/worker/internal/otel"
)

const (
	apiBaseURL = "https://api.github.com"
	rawBaseURL = "https://raw.githubusercontent.com"
)

// Client wraps net/http with GitHub API authentication and rate-limit handling.
type Client struct {
	httpClient  *http.Client
	accessToken string
}

// NewClient creates a GitHub API client with the given access token.
func NewClient(accessToken string) *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout:   30 * time.Second,
			Transport: otelhttp.NewTransport(http.DefaultTransport),
		},
		accessToken: accessToken,
	}
}

// doAPI performs an authenticated GitHub API request with retry on 429.
func (c *Client) doAPI(ctx context.Context, method, path string) (*http.Response, error) {
	url := apiBaseURL + path
	return c.doRequest(ctx, method, url, true)
}

// doRaw performs a raw content request (no API auth needed but we include it).
func (c *Client) doRaw(ctx context.Context, url string) (*http.Response, error) {
	return c.doRequest(ctx, "GET", url, true)
}

func (c *Client) doRequest(ctx context.Context, method, url string, auth bool) (*http.Response, error) {
	const maxRetries = 3

	start := time.Now()
	defer func() {
		durationMs := time.Since(start).Milliseconds()
		qgotel.GHAPILatency.Record(ctx, durationMs,
			otelmetric.WithAttributes(attribute.String("http.method", method)),
		)
	}()

	for attempt := range maxRetries {
		req, err := http.NewRequestWithContext(ctx, method, url, nil)
		if err != nil {
			return nil, fmt.Errorf("creating request: %w", err)
		}

		if auth && c.accessToken != "" {
			req.Header.Set("Authorization", "Bearer "+c.accessToken)
		}
		req.Header.Set("Accept", "application/vnd.github.v3+json")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("executing request: %w", err)
		}

		if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode == http.StatusForbidden {
			qgotel.GHRateLimitHits.Add(ctx, 1,
				otelmetric.WithAttributes(attribute.Int("http.status_code", resp.StatusCode)),
			)

			// Check for rate limit reset time.
			if resetStr := resp.Header.Get("X-RateLimit-Reset"); resetStr != "" {
				if resetUnix, err := strconv.ParseInt(resetStr, 10, 64); err == nil {
					waitDuration := time.Until(time.Unix(resetUnix, 0))
					if waitDuration > 0 && waitDuration < 60*time.Second {
						resp.Body.Close()
						select {
						case <-ctx.Done():
							return nil, ctx.Err()
						case <-time.After(waitDuration):
						}
						continue
					}
				}
			}

			// Exponential backoff fallback.
			resp.Body.Close()
			backoff := time.Duration(math.Pow(2, float64(attempt))) * time.Second
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
			}
			continue
		}

		return resp, nil
	}

	return nil, fmt.Errorf("max retries exceeded for %s %s", method, url)
}

// decodeJSON reads the response body and decodes JSON into target.
func decodeJSON(resp *http.Response, target interface{}) error {
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	return json.NewDecoder(resp.Body).Decode(target)
}
