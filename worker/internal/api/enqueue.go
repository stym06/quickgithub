package api

import (
	"encoding/json"
	"log"
	"net/http"
	"regexp"
	"time"

	"github.com/hibiken/asynq"
	"github.com/stym06/quickgithub/worker/internal/tasks"
)

// validSlugRe matches valid GitHub owner or repo names:
// alphanumeric, hyphens, underscores, dots; 1-100 chars.
var validSlugRe = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$`)

type EnqueueRequest struct {
	RepoID    string `json:"repoId"`
	Owner     string `json:"owner"`
	Repo      string `json:"repo"`
	FullName  string `json:"fullName"`
}

// NewEnqueueHandler returns an HTTP handler that enqueues indexing tasks via asynq.
func NewEnqueueHandler(client *asynq.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req EnqueueRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if req.RepoID == "" || req.Owner == "" || req.Repo == "" {
			http.Error(w, "repoId, owner, and repo are required", http.StatusBadRequest)
			return
		}

		if !validSlugRe.MatchString(req.Owner) || !validSlugRe.MatchString(req.Repo) {
			http.Error(w, "owner and repo must be valid GitHub identifiers (alphanumeric, hyphens, underscores, dots)", http.StatusBadRequest)
			return
		}

		payload, err := json.Marshal(tasks.IndexRepoPayload{
			RepoID: req.RepoID,
			Owner:  req.Owner,
			Repo:   req.Repo,
		})
		if err != nil {
			http.Error(w, "failed to marshal payload", http.StatusInternalServerError)
			return
		}

		task := asynq.NewTask(tasks.TypeIndexRepo, payload,
			asynq.Queue("default"),
			asynq.MaxRetry(5),
			asynq.Timeout(30*time.Minute),
			asynq.Retention(24*time.Hour),
		)

		info, err := client.Enqueue(task)
		if err != nil {
			log.Printf("failed to enqueue task: %v", err)
			http.Error(w, "failed to enqueue task", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"taskId": info.ID,
			"queue":  info.Queue,
		})
	}
}
