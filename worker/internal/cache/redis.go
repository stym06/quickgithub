package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	statusTTL  = 1 * time.Hour
	lockTTL    = 35 * time.Minute
	lockPrefix = "lock:indexing:"
)

// NewClient creates a new Redis client from a URL string.
func NewClient(redisURL string) (*redis.Client, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parsing redis URL: %w", err)
	}

	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("pinging redis: %w", err)
	}

	return client, nil
}

// SetIndexingStatus stores the current indexing status for a repo as a JSON string with a 1-hour TTL.
func SetIndexingStatus(ctx context.Context, client *redis.Client, owner, repo, status string, progress int, message string) error {
	key := fmt.Sprintf("indexing:%s/%s:status", owner, repo)
	value := fmt.Sprintf(`{"status":%q,"progress":%d,"message":%q}`, status, progress, message)
	if err := client.Set(ctx, key, value, statusTTL).Err(); err != nil {
		return fmt.Errorf("setting indexing status: %w", err)
	}
	return nil
}

// SetDocsCache stores the documentation JSON permanently (no TTL).
func SetDocsCache(ctx context.Context, client *redis.Client, owner, repo string, docsJSON []byte) error {
	key := fmt.Sprintf("docs:%s/%s", owner, repo)
	if err := client.Set(ctx, key, docsJSON, 0).Err(); err != nil {
		return fmt.Errorf("caching docs: %w", err)
	}
	return nil
}

// AcquireLock attempts to acquire an indexing lock for a repo.
// Returns true if the lock was acquired, false if another worker holds it.
func AcquireLock(ctx context.Context, client *redis.Client, owner, repo string) (bool, error) {
	key := lockPrefix + owner + "/" + repo
	ok, err := client.SetNX(ctx, key, "locked", lockTTL).Result()
	if err != nil {
		return false, fmt.Errorf("acquiring lock: %w", err)
	}
	return ok, nil
}

// ReleaseLock releases the indexing lock for a repo.
func ReleaseLock(ctx context.Context, client *redis.Client, owner, repo string) error {
	key := lockPrefix + owner + "/" + repo
	if err := client.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("releasing lock: %w", err)
	}
	return nil
}
