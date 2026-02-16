# QuickGitHub - Improvement Ideas

Brainstorm of potential improvements organized by category, with effort estimates
(S/M/L) and impact ratings (1-5).

---

## 1. Core Indexing Pipeline

### 1.1 Parallel Module Analysis
**Effort: S | Impact: 4**

The module analysis stage (`runModuleStage` in `worker/internal/llm/pipeline.go:139`)
processes directory chunks sequentially. Since each chunk is an independent LLM call,
these can be parallelized with a bounded worker pool (e.g., 3-5 concurrent requests).
This would cut the longest stage of the pipeline roughly in half for repos with many
modules.

```go
// Instead of sequential loop, use an errgroup with concurrency limit
g, ctx := errgroup.WithContext(ctx)
g.SetLimit(4)
for i, chunk := range chunks {
    g.Go(func() error { ... })
}
```

### 1.2 Incremental Re-indexing
**Effort: L | Impact: 5**

Currently, re-indexing regenerates everything from scratch. Instead:
- Store the `commitSha` that was indexed (the `Repo` model already has this field
  but it's never populated)
- On re-index, fetch the Git diff between old and new SHA
- Only re-parse and re-analyze changed files/modules
- Re-run synthesis only if changes are significant

This would make re-indexing much faster and cheaper on LLM tokens.

### 1.3 Branch and Tag Support
**Effort: M | Impact: 4**

Currently only indexes the default branch (`HEAD`). Allow users to:
- Specify a branch or tag when indexing (e.g., `owner/repo@v2.0`)
- Store branch info in the `Repo` model
- Support versioned documentation (view docs for different releases)

Requires schema change: add `branch` field to `Repo`, update the unique constraint
to `(fullName, branch)`, and pass the ref through the pipeline.

### 1.4 Private Repository Support
**Effort: M | Impact: 5**

The worker currently uses unauthenticated GitHub API calls (or a static token). To
support private repos:
- Pass the user's GitHub OAuth `access_token` from the `Account` table through the
  asynq task payload
- Use it in the Go worker's GitHub client for API calls
- Handle token expiration/refresh
- Update the UI to show a clear distinction between public/private repos

The `Account` model already stores `access_token` and `refresh_token` from OAuth.

### 1.5 Smarter File Prioritization with Dependency Graph
**Effort: L | Impact: 3**

The current file filter (`worker/internal/github/filter.go`) uses heuristic tiers.
Improve this by:
- Building a lightweight dependency graph from import statements
- Prioritizing files that are imported by many other files (high fan-in)
- De-prioritizing leaf files with no dependents
- This helps identify the "core" of a codebase more accurately

---

## 2. Documentation Quality

### 2.1 API Endpoint Documentation
**Effort: M | Impact: 5**

Add a dedicated documentation section for API endpoints. The parser already extracts
route handlers and function signatures. A new LLM stage could:
- Detect REST/GraphQL/gRPC endpoints from route definitions
- Document request/response schemas, methods, paths, auth requirements
- Generate an interactive API reference (similar to Swagger UI)
- Add as a new tab alongside Architecture, Modules, etc.

### 2.2 Configuration Reference
**Effort: S | Impact: 3**

Generate a "Configuration" documentation section that:
- Identifies all environment variables used in the codebase
- Documents config file formats (`.env`, YAML, TOML, etc.)
- Lists available CLI flags and options
- Shows defaults and required vs optional values

### 2.3 Documentation Quality Scoring
**Effort: S | Impact: 2**

After generation, run a lightweight evaluation pass that scores:
- Completeness (all sections filled, no empty arrays)
- Mermaid diagram validity (parse check)
- Coverage (% of source files referenced in module docs)
- Consistency (no contradictions between overview and module descriptions)

Display the score to users and flag areas that could be improved with a re-index.

### 2.4 Multi-language README Support
**Effort: S | Impact: 2**

Some repos have READMEs in multiple languages (`README.ja.md`, `README.zh.md`).
Detect these and either:
- Use the English one for analysis but note others exist
- Allow users to pick which language to generate docs in

---

## 3. User Experience

### 3.1 Full-text Search Across Documentation
**Effort: M | Impact: 4**

Add search functionality within generated docs:
- Index documentation content in PostgreSQL using `tsvector` full-text search
- Or use a lightweight client-side search (e.g., Fuse.js) since docs are JSON
- Search across all sections: overview, modules, architecture
- Highlight matches and link to relevant sections

### 3.2 Documentation Export
**Effort: S | Impact: 3**

Allow users to export documentation as:
- Single-page Markdown file
- PDF (using a server-side renderer)
- Static HTML site (for self-hosting)

This is straightforward since all docs are already structured JSON.

### 3.3 Compare / Changelog View
**Effort: M | Impact: 3**

When a repo is re-indexed, keep the previous version and offer a diff view:
- What modules were added/removed
- What architecture components changed
- Changes in tech stack or dependencies
- Useful for tracking how a project evolves

Requires storing documentation versions (add `version` to `Documentation` model).

### 3.4 Embed Widget
**Effort: S | Impact: 2**

Provide an embeddable widget/badge that repo owners can put in their README:
- "View AI Docs" badge linking to QuickGitHub
- Embeddable iframe for specific sections (e.g., architecture diagram)
- OpenGraph meta tags for rich link previews when sharing docs URLs

### 3.5 Mobile-Responsive Sidebar
**Effort: S | Impact: 3**

The docs sidebar (`DocsSidebar`) is hidden on mobile (`hidden md:block` in
`RepoPageClient.tsx:109`). Add:
- A hamburger menu or bottom sheet for mobile navigation
- Swipe gestures to open/close sidebar
- Sticky section headers while scrolling

---

## 4. Infrastructure & Reliability

### 4.1 Automated Testing
**Effort: L | Impact: 5**

The codebase has zero tests. Priority additions:
- **Go worker unit tests**: Test file filtering logic, tree-sitter parsing,
  LLM response parsing, chunking logic
- **Go integration tests**: Test the full pipeline with mocked GitHub/LLM APIs
- **Next.js API route tests**: Test the indexing trigger, cache logic, auth guards
- **E2E tests**: Playwright tests for the full user flow (land on homepage, enter
  repo URL, wait for indexing, view docs)

### 4.2 CI/CD Pipeline
**Effort: M | Impact: 4**

No CI/CD exists beyond the Makefile. Set up:
- GitHub Actions: lint, type-check, test on every PR
- Separate workflows for web and worker
- Automated deployment on merge to main
- Database migration checks (Prisma)

### 4.3 Rate Limiting for Unauthenticated Endpoints
**Effort: S | Impact: 3**

The GET endpoint for fetching docs (`/api/repos/[owner]/[repo]`) has no rate
limiting. Add:
- IP-based rate limiting for read endpoints using the existing Redis setup
- Stricter limits for the POST (indexing trigger) endpoint
- Return `Retry-After` headers on 429 responses

### 4.4 Graceful Worker Shutdown
**Effort: S | Impact: 3**

When the worker process is stopped (deploy, crash), in-flight jobs get retried but
the user sees a stalled progress bar. Improve this by:
- Handling `SIGTERM` in the worker to update Redis status to "RETRYING"
- Setting a TTL on the worker lock so it auto-expires
- The web SSE endpoint could detect stale status and inform the user

### 4.5 Structured Logging
**Effort: S | Impact: 2**

Replace `log.Printf` calls throughout the Go worker with structured logging
(e.g., `slog` from the standard library). Benefits:
- JSON log output for log aggregation tools
- Consistent field names (repo, stage, duration)
- Log levels (debug for per-file parsing, info for stage completion, error for
  failures)

---

## 5. Growth & Monetization

### 5.1 Enable the Chat Feature
**Effort: M | Impact: 5**

The Q&A chat feature is fully built (models, API route, context generation stage)
but disabled with a "coming soon" message. To enable it:
- Implement the actual chat API route using the stored `repoContext`
- Add conversation history with the existing `ChatSession`/`ChatMessage` models
- Rate limit to `MAX_CHAT_QUESTIONS` per session
- This is the most impactful "new" feature that's already 80% built

### 5.2 Org/Team Workspaces
**Effort: L | Impact: 4**

Currently each user has an individual free-tier limit. Add:
- Organization accounts that can pool repo limits
- Shared documentation across team members
- Role-based access (admin, member, viewer)

### 5.3 GitHub App Integration
**Effort: L | Impact: 4**

Instead of OAuth-only, offer a GitHub App that:
- Auto-indexes repos on push (via webhooks)
- Posts documentation links as PR comments
- Adds a "Docs" tab to the GitHub repo page
- Provides finer-grained permissions than OAuth

### 5.4 Custom Domain Support
**Effort: M | Impact: 3**

Allow users to serve docs under their own domain:
- `docs.mycompany.com` pointing to their QuickGitHub docs
- Leverage Caddy's automatic HTTPS with on-demand TLS
- Store custom domain mappings in the database

---

## 6. Quick Wins (< 1 day each)

| Improvement | File(s) | Description |
|---|---|---|
| Populate `commitSha` | `worker/internal/orchestrator/handler.go` | Store the HEAD SHA when indexing for staleness detection |
| Add `robots.txt` | `web/public/robots.txt` | SEO: allow search engines to index doc pages |
| OpenGraph meta tags | `web/src/app/[owner]/[repo]/layout.tsx` | Rich previews when sharing doc links on social media |
| Keyboard shortcuts | `RepoPageClient.tsx` | `?` for help, `/` for search, `j/k` navigation |
| Dark mode Mermaid | `MermaidDiagram.tsx` | Mermaid diagrams don't adapt to dark theme |
| Copy code blocks | Doc components | Add copy-to-clipboard buttons on code snippets |
| Breadcrumb navigation | `[...slug]/page.tsx` | Show `owner/repo > Architecture > ...` breadcrumbs |
| Favicon for indexed repos | Navbar/sidebar | Fetch and display the GitHub org/user avatar |
| Error boundary | `RepoPageClient.tsx` | Wrap doc rendering in React error boundary for resilience |
| Health check endpoint | `web/src/app/api/health/route.ts` | Simple `/api/health` for uptime monitoring |

---

## Recommended Priority Order

1. **Parallel module analysis** (1.1) - Immediate performance win, minimal risk
2. **Enable chat** (5.1) - Already mostly built, high user value
3. **Automated testing** (4.1) - Foundation for safe iteration
4. **Private repo support** (1.4) - Unlocks enterprise use cases
5. **API endpoint documentation** (2.1) - Biggest documentation quality gap
6. **Full-text search** (3.1) - Essential UX for larger repos
7. **Incremental re-indexing** (1.2) - Cost reduction at scale
8. **CI/CD pipeline** (4.2) - Required before growing the team
9. **Branch/tag support** (1.3) - Natural extension of the product
10. **GitHub App** (5.3) - Growth lever for organic adoption
