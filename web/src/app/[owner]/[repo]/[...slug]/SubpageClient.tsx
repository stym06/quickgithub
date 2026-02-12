"use client";

import { useEffect, useState } from "react";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { Architecture } from "@/components/docs/Architecture";
import { SystemOverview } from "@/components/docs/SystemOverview";
import { KeyModules } from "@/components/docs/KeyModules";
import { SetupGuide } from "@/components/docs/SetupGuide";
import { EntryPoints } from "@/components/docs/EntryPoints";
import { Dependencies } from "@/components/docs/Dependencies";
import { Skeleton } from "@/components/ui/skeleton";
import { Github } from "lucide-react";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/repos/${owner}/${repo}`);
        if (res.ok) {
          const data = await res.json();
          if (data.systemOverview) {
            setDocs(data);
            setUpdatedAt(data.updatedAt ?? null);
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
        <div className="flex-1 p-8">
          <Skeleton className="h-10 w-96 mb-4" />
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

  const renderSection = () => {
    switch (section) {
      case "overview":
        return <SystemOverview data={docs.systemOverview} techStack={docs.techStack} />;
      case "architecture":
        return <Architecture data={docs.architecture} />;
      case "modules":
        return <KeyModules data={docs.keyModules} owner={owner} repo={repo} />;
      case "setup":
        return <SetupGuide data={docs.systemOverview.setupGuide} />;
      case "entry-points":
        return <EntryPoints data={docs.entryPoints} />;
      case "dependencies":
        return <Dependencies data={docs.dependencies} />;
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
        modules={docs.keyModules}
      />
      <main className="flex-1 max-w-4xl p-8">
        <div className="flex items-center justify-end gap-4 mb-4">
          {updatedAt && (
            <span className="text-xs text-muted-foreground">
              Indexed on {new Date(updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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
