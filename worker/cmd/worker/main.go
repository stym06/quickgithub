package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/hibiken/asynq"
	"github.com/stym06/quickgithub/worker/internal/api"
	"github.com/stym06/quickgithub/worker/internal/cache"
	"github.com/stym06/quickgithub/worker/internal/config"
	"github.com/stym06/quickgithub/worker/internal/db"
	"github.com/stym06/quickgithub/worker/internal/llm"
	"github.com/stym06/quickgithub/worker/internal/notify"
	qgotel "github.com/stym06/quickgithub/worker/internal/otel"
	"github.com/stym06/quickgithub/worker/internal/orchestrator"
	"github.com/stym06/quickgithub/worker/internal/tasks"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("loading config: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	otelShutdown, err := qgotel.Init(ctx)
	if err != nil {
		log.Printf("warning: failed to initialize OpenTelemetry: %v", err)
	} else {
		defer func() {
			if err := otelShutdown(ctx); err != nil {
				log.Printf("warning: OpenTelemetry shutdown error: %v", err)
			}
		}()
	}

	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connecting to database: %v", err)
	}
	defer pool.Close()

	redisClient, err := cache.NewClient(cfg.RedisURL)
	if err != nil {
		log.Fatalf("connecting to redis: %v", err)
	}
	defer redisClient.Close()

	if err := cache.ClearAllLocks(ctx, redisClient); err != nil {
		log.Printf("warning: failed to clear stale locks: %v", err)
	}

	llmClient := llm.NewClient(cfg.LLMProvider, cfg.AnthropicAPIKey, cfg.OpenAIAPIKey)
	log.Printf("using LLM provider: %s", cfg.LLMProvider)

	redisOpt, err := asynq.ParseRedisURI(cfg.RedisURL)
	if err != nil {
		log.Fatalf("parsing redis URI for asynq: %v", err)
	}

	srv := asynq.NewServer(
		redisOpt,
		asynq.Config{
			Concurrency: cfg.WorkerConcurrency,
			Queues: map[string]int{
				"default": 1,
			},
		},
	)

	emailClient := notify.NewEmailClient(cfg.ResendAPIKey, cfg.EmailFrom, cfg.AppBaseURL)
	if emailClient != nil {
		log.Printf("email notifications enabled (from: %s)", cfg.EmailFrom)
	} else {
		log.Printf("email notifications disabled (no RESEND_API_KEY)")
	}

	handler := &orchestrator.TaskHandler{
		Pool:   pool,
		Redis:  redisClient,
		LLM:    llmClient,
		Config: cfg,
		Email:  emailClient,
	}

	mux := asynq.NewServeMux()
	mux.HandleFunc(tasks.TypeIndexRepo, handler.HandleIndexRepo)

	// asynq client for enqueueing tasks via HTTP API.
	asynqClient := asynq.NewClient(redisOpt)
	defer asynqClient.Close()

	// Start HTTP enqueue API.
	httpMux := http.NewServeMux()
	httpMux.HandleFunc("/enqueue", api.NewEnqueueHandler(asynqClient))
	httpMux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	go func() {
		addr := ":" + cfg.APIPort
		log.Printf("starting enqueue API on %s", addr)
		if err := http.ListenAndServe(addr, httpMux); err != nil {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// Graceful shutdown on SIGINT/SIGTERM.
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigCh
		log.Printf("received signal %v, shutting down...", sig)
		srv.Shutdown()
		cancel()
	}()

	log.Printf("starting worker with concurrency=%d", cfg.WorkerConcurrency)
	if err := srv.Run(mux); err != nil {
		log.Fatalf("running asynq server: %v", err)
	}
}
