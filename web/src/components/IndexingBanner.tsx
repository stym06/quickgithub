"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

type BannerState = "indexing" | "completed" | "failed";

export function IndexingBanner() {
  const searchParams = useSearchParams();
  const indexingRepo = searchParams.get("indexing");
  const [state, setState] = useState<BannerState>("indexing");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [dismissed, setDismissed] = useState(false);

  const owner = indexingRepo?.split("/")[0];
  const repo = indexingRepo?.split("/")[1];

  useEffect(() => {
    if (!owner || !repo) return;

    const evtSource = new EventSource(`/api/repos/${owner}/${repo}/status`);

    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setProgress(data.progress || 0);
        setMessage(data.message || "");

        if (data.status === "COMPLETED") {
          setState("completed");
          evtSource.close();
        } else if (data.status === "FAILED") {
          setState("failed");
          evtSource.close();
        }
      } catch {
        // ignore parse errors
      }
    };

    evtSource.onerror = () => {
      evtSource.close();
    };

    return () => evtSource.close();
  }, [owner, repo]);

  if (!indexingRepo || !owner || !repo || dismissed) return null;

  if (state === "completed") {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-3 rounded-full border border-emerald-500/50 bg-gray-900/95 px-5 py-3 shadow-lg backdrop-blur-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span className="text-sm text-white">
            Docs ready for{" "}
            <span className="font-semibold text-emerald-400">
              {owner}/{repo}
            </span>
          </span>
          <Link
            href={`/${owner}/${repo}`}
            className="rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-medium text-white hover:bg-emerald-600 transition-colors"
          >
            View docs
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="ml-1 text-white/40 hover:text-white/70 text-xs"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-3 rounded-full border border-red-500/30 bg-gray-900/95 px-5 py-3 shadow-lg backdrop-blur-sm">
          <XCircle className="h-4 w-4 text-red-400" />
          <span className="text-sm text-white">
            Failed to generate docs for{" "}
            <span className="font-semibold text-red-400">
              {owner}/{repo}
            </span>
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="ml-1 text-white/40 hover:text-white/70 text-xs"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <Link
        href={`/${owner}/${repo}`}
        className="flex items-center gap-3 rounded-full border border-emerald-500/30 bg-gray-900/95 px-5 py-3 shadow-lg backdrop-blur-sm transition-colors hover:border-emerald-500/50"
      >
        <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
        <span className="text-sm text-white">
          Generating docs for{" "}
          <span className="font-semibold text-emerald-400">
            {owner}/{repo}
          </span>
        </span>
        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
          {progress > 0 ? `${progress}%` : "In progress"}
        </span>
      </Link>
    </div>
  );
}
