"use client";

import { useEffect, useState } from "react";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { ArchitectureSection } from "@/components/docs/ArchitectureSection";
import { OverviewSection } from "@/components/docs/OverviewSection";
import { GettingStartedSection } from "@/components/docs/GettingStartedSection";
import { APIReferenceSection } from "@/components/docs/APIReferenceSection";
import { UsagePatternsSection } from "@/components/docs/UsagePatternsSection";
import { DevelopmentGuideSection } from "@/components/docs/DevelopmentGuideSection";
import { WikiPageRenderer } from "@/components/docs/WikiPageRenderer";
import { Skeleton } from "@/components/ui/skeleton";
import { Github, Sparkles } from "lucide-react";
import type { Documentation } from "@/types";

export function SubpageClient({
  owner,
  repo,
  slug,
}: {
  owner: string;
  repo: string;
  slug: string[];
}) {
  const [docs, setDocs] = useState<Documentation | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [indexedWith, setIndexedWith] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/repos/${owner}/${repo}`);
        if (res.ok) {
          const data = await res.json();
          const isWiki = data.pages && data.pages.length > 0;
          if (isWiki || data.overview?.description) {
            setDocs(data);
            setUpdatedAt(data.updatedAt ?? null);
            setIndexedWith(data.indexedWith ?? null);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [owner, repo]);

  if (loading) {
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
          <Skeleton className="h-6 w-3/4" />
        </div>
      </div>
    );
  }

  if (!docs) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <p className="text-muted-foreground">Documentation not found.</p>
      </div>
    );
  }

  const section = slug[0];
  const isWiki = docs.pages && docs.pages.length > 0;
  const indexedWithClaude = indexedWith?.includes("claude");

  const renderSection = () => {
    // Wiki mode: find page by slug
    if (isWiki) {
      const page = docs.pages!.find((p) => p.slug === section);
      if (page) {
        return <WikiPageRenderer title={page.title} content={page.content} />;
      }
      return (
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold mb-2">Page not found</h1>
          <p className="text-muted-foreground">
            The page &quot;{section}&quot; does not exist.
          </p>
        </div>
      );
    }

    // Legacy mode: fixed section routing
    switch (section) {
      case "overview":
        return <OverviewSection data={docs.overview!} />;
      case "getting-started":
        return <GettingStartedSection data={docs.gettingStarted!} />;
      case "architecture":
        return <ArchitectureSection data={docs.coreArchitecture!} />;
      case "api-reference":
        return <APIReferenceSection data={docs.apiReference!} />;
      case "usage-patterns":
        return <UsagePatternsSection data={docs.usagePatterns!} />;
      case "dev-guide":
        return <DevelopmentGuideSection data={docs.developmentGuide!} />;
      default:
        return (
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold mb-2">Page not found</h1>
            <p className="text-muted-foreground">
              The section &quot;{section}&quot; does not exist.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <DocsSidebar
        owner={owner}
        repo={repo}
        modules={!isWiki ? docs.apiReference?.modules : undefined}
        pages={isWiki ? docs.pages : undefined}
        indexedWith={indexedWith ?? undefined}
      />
      <main className="flex-1 min-w-0 max-w-4xl px-4 py-6 pt-16 md:px-8 md:py-8 md:pt-8 overflow-x-hidden">
        <div className="flex flex-wrap items-center justify-end gap-3 mb-4">
          {updatedAt && (
            <span className="text-xs text-muted-foreground">
              Indexed on {new Date(updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              {indexedWith && (
                <span className="ml-1 text-muted-foreground/70">via {indexedWith}</span>
              )}
            </span>
          )}
          {indexedWithClaude && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Sparkles className="h-3 w-3" />
              Pro
            </span>
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
        {renderSection()}
      </main>
    </div>
  );
}
