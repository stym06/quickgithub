package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html"
	"log"
	"net/http"
	"time"
)

const resendAPI = "https://api.resend.com/emails"

// EmailClient sends email notifications via the Resend API.
// All methods are nil-safe: if the client is nil, they are no-ops.
type EmailClient struct {
	apiKey  string
	from    string
	baseURL string
}

// NewEmailClient creates a new EmailClient. Returns nil if apiKey is empty.
func NewEmailClient(apiKey, from, baseURL string) *EmailClient {
	if apiKey == "" {
		return nil
	}
	return &EmailClient{
		apiKey:  apiKey,
		from:    from,
		baseURL: baseURL,
	}
}

// SendIndexingComplete sends a "docs are ready" email. Best-effort: errors are logged.
func (c *EmailClient) SendIndexingComplete(ctx context.Context, to, repoFullName string) error {
	if c == nil {
		return nil
	}

	link := fmt.Sprintf("%s/repos/%s", c.baseURL, repoFullName)
	subject := fmt.Sprintf("Your docs for %s are ready!", repoFullName)
	body := fmt.Sprintf(`<html><body>
<h2>Your documentation is ready!</h2>
<p>We've finished indexing <strong>%s</strong>.</p>
<p><a href="%s" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">View Documentation</a></p>
<p style="color:#666;font-size:12px;">— QuickGitHub</p>
</body></html>`,
		html.EscapeString(repoFullName),
		html.EscapeString(link),
	)

	return c.send(ctx, to, subject, body)
}

// SendIndexingFailed sends a "indexing failed" email. Best-effort: errors are logged.
func (c *EmailClient) SendIndexingFailed(ctx context.Context, to, repoFullName, errMsg string) error {
	if c == nil {
		return nil
	}

	link := fmt.Sprintf("%s/repos/%s", c.baseURL, repoFullName)
	subject := fmt.Sprintf("We couldn't index %s", repoFullName)
	body := fmt.Sprintf(`<html><body>
<h2>Indexing failed</h2>
<p>We weren't able to generate documentation for <strong>%s</strong>.</p>
<p><strong>Error:</strong> %s</p>
<p><a href="%s" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Try Again</a></p>
<p style="color:#666;font-size:12px;">— QuickGitHub</p>
</body></html>`,
		html.EscapeString(repoFullName),
		html.EscapeString(errMsg),
		html.EscapeString(link),
	)

	return c.send(ctx, to, subject, body)
}

func (c *EmailClient) send(ctx context.Context, to, subject, htmlBody string) error {
	payload, err := json.Marshal(map[string]interface{}{
		"from":    c.from,
		"to":      []string{to},
		"subject": subject,
		"html":    htmlBody,
	})
	if err != nil {
		return fmt.Errorf("marshaling email payload: %w", err)
	}

	reqCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, resendAPI, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("creating email request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("email send failed for %s: %v", to, err)
		return fmt.Errorf("sending email: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		log.Printf("email send returned %d for %s", resp.StatusCode, to)
		return fmt.Errorf("resend API returned status %d", resp.StatusCode)
	}

	log.Printf("email sent to %s: %s", to, subject)
	return nil
}
