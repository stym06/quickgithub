"use client";

import { useState } from "react";
import { useIndexingStatus } from "@/hooks/useIndexingStatus";
import { Button } from "@/components/ui/button";
import { Mail, RefreshCw } from "lucide-react";

const STAGE_LABELS: Record<string, string> = {
  PENDING: "Queued",
  FETCHING: "Fetching repository",
  PARSING: "Parsing source code",
  ANALYZING: "Analyzing with AI",
  COMPLETED: "Documentation ready!",
  FAILED: "Indexing failed",
  STALLED: "Indexing stalled",
};

export function IndexingProgress({
  owner,
  repo,
  onComplete,
}: {
  owner: string;
  repo: string;
  onComplete?: () => void;
}) {
  const { status, error } = useIndexingStatus(owner, repo, true);
  const [retrying, setRetrying] = useState(false);

  const progress = status?.progress ?? 0;
  const stage = status?.status ?? "PENDING";
  const message = status?.message ?? "Preparing...";

  if (stage === "COMPLETED" && onComplete) {
    onComplete();
  }

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/repos/${owner}/${repo}`, {
        method: "POST",
      });
      if (res.ok || res.status === 202) {
        // Reload the page to restart the SSE connection
        window.location.reload();
      }
    } catch {
      // ignore
    } finally {
      setRetrying(false);
    }
  };

  const isFailed = stage === "FAILED" || stage === "STALLED";

  return (
    <div className="max-w-lg mx-auto text-center space-y-6 py-16">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">
          {isFailed ? "Indexing Issue" : "Generating Documentation"}
        </h2>
        <p className="text-muted-foreground">
          {STAGE_LABELS[stage] ?? stage}
        </p>
      </div>

      {/* Progress bar */}
      {!isFailed && (
        <>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{message}</span>
            <span>{progress}%</span>
          </div>
        </>
      )}

      {!isFailed && stage !== "COMPLETED" && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          <span>You&apos;ll be notified via email once indexing completes.</span>
        </div>
      )}

      {stage === "FAILED" && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
          {message || "An error occurred during indexing."}
        </div>
      )}

      {stage === "STALLED" && (
        <div className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-lg p-4 text-sm">
          Indexing appears to have stalled. The worker may have stopped.
        </div>
      )}

      {isFailed && (
        <Button onClick={handleRetry} disabled={retrying} size="lg">
          <RefreshCw className={`h-4 w-4 mr-2 ${retrying ? "animate-spin" : ""}`} />
          {retrying ? "Retrying..." : "Regenerate Docs"}
        </Button>
      )}

      {error && (
        <p className="text-sm text-yellow-500">{error}</p>
      )}
    </div>
  );
}
