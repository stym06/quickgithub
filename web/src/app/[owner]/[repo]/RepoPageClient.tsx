"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { OverviewSection } from "@/components/docs/OverviewSection";
import { WikiPageRenderer } from "@/components/docs/WikiPageRenderer";
import { IndexingProgress } from "@/components/IndexingProgress";
import { Github, RefreshCw, Sparkles } from "lucide-react";
import type { Documentation, RepoStatus } from "@/types";

type PageState =
  | { kind: "loading" }
  | { kind: "docs"; docs: Documentation; updatedAt?: string; indexedWith?: string }
  | { kind: "indexing" }
  | { kind: "not-indexed-auth" }
  | { kind: "not-indexed-anon" }
  | { kind: "not-found" }
  | { kind: "error"; message: string };

export function RepoPageClient({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>({ kind: "loading" });
  const [triggering, setTriggering] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userTier = (session?.user as any)?.tier ?? "FREE";
  const isPro = userTier === "PRO";

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/repos/${owner}/${repo}`);
      if (res.ok) {
        const data = await res.json();
        const isWiki = data.pages && data.pages.length > 0;
        if (data.status === "COMPLETED" && (isWiki || data.overview?.description)) {
          setPageState({ kind: "docs", docs: data, updatedAt: data.updatedAt, indexedWith: data.indexedWith });
        } else if (
          ["PENDING", "FETCHING", "PARSING", "ANALYZING"].includes(
            data.status as RepoStatus
          )
        ) {
          setPageState({ kind: "indexing" });
        } else if (data.status === "FAILED") {
          setPageState({
            kind: "error",
            message: data.errorMessage || "Indexing failed",
          });
        } else if (data.status === "COMPLETED") {
          // COMPLETED but no valid docs (e.g. post-migration empty data)
          if (authStatus === "authenticated") {
            setPageState({ kind: "not-indexed-auth" });
          } else {
            setPageState({ kind: "not-indexed-anon" });
          }
        }
      } else if (res.status === 404) {
        // Not in our DB — verify the repo exists on GitHub before prompting.
        const checkRes = await fetch(
          `/api/github/check?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`
        );
        const checkData = await checkRes.json();

        if (!checkData.exists) {
          setPageState({ kind: "not-found" });
        } else if (authStatus === "authenticated") {
          setPageState({ kind: "not-indexed-auth" });
        } else {
          setPageState({ kind: "not-indexed-anon" });
        }
      } else {
        setPageState({ kind: "error", message: "Failed to load repository" });
      }
    } catch {
      setPageState({ kind: "error", message: "Network error" });
    }
  }, [owner, repo, authStatus]);

  useEffect(() => {
    if (authStatus !== "loading") {
      fetchDocs();
    }
  }, [fetchDocs, authStatus]);

  const handleTriggerIndex = async () => {
    setTriggering(true);
    try {
      const res = await fetch(`/api/repos/${owner}/${repo}`, {
        method: "POST",
      });
      if (res.ok || res.status === 202 || res.status === 409) {
        // 409 = indexing already in progress — show progress instead of error
        setPageState({ kind: "indexing" });
        return;
      } else {
        const data = await res.json().catch(() => ({}));
        setPageState({
          kind: "error",
          message: data.error || "Failed to start indexing",
        });
      }
    } catch {
      setPageState({ kind: "error", message: "Network error" });
    } finally {
      setTriggering(false);
    }
  };

  if (pageState.kind === "loading") {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <div className="w-64 border-r bg-muted/30 hidden md:block p-4">
          <Skeleton className="h-6 w-32 mb-4" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full mb-2" />
          ))}
        </div>
        <div className="flex-1 px-4 py-6 pt-16 md:px-8 md:py-8 md:pt-8">
          <Skeleton className="h-10 w-3/4 md:w-96 mb-4" />
          <Skeleton className="h-6 w-full mb-2" />
          <Skeleton className="h-6 w-3/4 mb-6" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (pageState.kind === "docs") {
    const isWiki = pageState.docs.pages && pageState.docs.pages.length > 0;
    const firstPage = isWiki ? pageState.docs.pages![0] : null;
    const indexedWithClaude = pageState.indexedWith?.includes("claude");

    return (
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <DocsSidebar
          owner={owner}
          repo={repo}
          modules={!isWiki ? pageState.docs.apiReference?.modules : undefined}
          pages={isWiki ? pageState.docs.pages : undefined}
          indexedWith={pageState.indexedWith}
        />
        <main className="flex-1 min-w-0 max-w-4xl px-4 py-6 pt-16 md:px-8 md:py-8 md:pt-8 overflow-x-hidden">
          <div className="flex flex-wrap items-center justify-end gap-3 mb-4">
            {pageState.updatedAt && (
              <span className="text-xs text-muted-foreground">
                Indexed on {new Date(pageState.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {pageState.indexedWith && (
                  <span className="ml-1 text-muted-foreground/70">via {pageState.indexedWith}</span>
                )}
              </span>
            )}
            {indexedWithClaude && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Sparkles className="h-3 w-3" />
                Pro
              </span>
            )}
            {session && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTriggerIndex}
                disabled={triggering}
                className="flex items-center gap-1.5"
              >
                {isPro ? (
                  <Sparkles className={`h-3.5 w-3.5 ${triggering ? "animate-pulse" : ""}`} />
                ) : (
                  <RefreshCw className={`h-3.5 w-3.5 ${triggering ? "animate-spin" : ""}`} />
                )}
                {triggering
                  ? "Re-indexing..."
                  : isPro
                    ? "Generate Docs with Claude"
                    : "Regenerate Docs"}
              </Button>
            )}
            <a
              href={`https://github.com/${owner}/${repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="h-4 w-4" />
              Open in GitHub
            </a>
          </div>
          {isWiki && firstPage ? (
            <WikiPageRenderer title={firstPage.title} content={firstPage.content} />
          ) : (
            <OverviewSection data={pageState.docs.overview!} />
          )}
        </main>
      </div>
    );
  }

  if (pageState.kind === "indexing") {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <IndexingProgress
          owner={owner}
          repo={repo}
          onComplete={() => fetchDocs()}
        />
      </div>
    );
  }

  if (pageState.kind === "not-indexed-auth") {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold">
            {owner}/{repo}
          </h1>
          <p className="text-muted-foreground">
            This repository hasn&apos;t been documented yet. Generate AI-powered
            documentation in under 60 seconds.
          </p>
          <Button
            size="lg"
            onClick={handleTriggerIndex}
            disabled={triggering}
            className="flex items-center gap-2"
          >
            {isPro && <Sparkles className="h-4 w-4" />}
            {triggering
              ? "Starting..."
              : isPro
                ? "Generate Docs with Claude"
                : "Generate Docs"}
          </Button>
        </div>
      </div>
    );
  }

  if (pageState.kind === "not-indexed-anon") {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold">
            {owner}/{repo}
          </h1>
          <p className="text-muted-foreground">
            This repository hasn&apos;t been documented yet. Sign in with GitHub
            to generate AI-powered documentation.
          </p>
          <Button size="lg" asChild>
            <Link href="/login">Sign in to Generate Docs</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (pageState.kind === "not-found") {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold">Repository not found</h1>
          <p className="text-muted-foreground">
            <span className="font-mono">{owner}/{repo}</span> doesn&apos;t exist
            on GitHub. Check the URL and try again.
          </p>
          <Button variant="outline" asChild>
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-2xl font-bold text-destructive">Error</h1>
        <p className="text-muted-foreground">
          {pageState.kind === "error" ? pageState.message : "Unknown error"}
        </p>
        {session ? (
          <Button onClick={handleTriggerIndex} disabled={triggering}>
            {triggering ? "Starting..." : "Regenerate Docs"}
          </Button>
        ) : (
          <Button variant="outline" asChild>
            <Link href="/login">Sign in to Regenerate</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
