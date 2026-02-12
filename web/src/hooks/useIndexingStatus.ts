"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { IndexingStatus } from "@/types";

export function useIndexingStatus(owner: string, repo: string, enabled: boolean) {
  const [status, setStatus] = useState<IndexingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!enabled) return;

    const es = new EventSource(`/api/repos/${owner}/${repo}/status`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as IndexingStatus;
        setStatus(data);

        if (data.status === "COMPLETED" || data.status === "FAILED") {
          es.close();
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      setError("Connection lost. Retrying...");
      es.close();
      // Retry after 3 seconds
      setTimeout(connect, 3000);
    };
  }, [owner, repo, enabled]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
    };
  }, [connect]);

  return { status, error };
}
