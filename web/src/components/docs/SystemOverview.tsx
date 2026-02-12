"use client";

import type { SystemOverview as SystemOverviewType, TechStack } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Terminal } from "lucide-react";

interface SystemOverviewProps {
  data: SystemOverviewType;
  techStack?: TechStack;
}

function TechBadges({ techStack }: { techStack: TechStack }) {
  const allItems: { label: string; category: string }[] = [];

  techStack.languages.forEach((l) => allItems.push({ label: l, category: "language" }));
  techStack.frameworks.forEach((f) => allItems.push({ label: f, category: "framework" }));
  techStack.databases?.forEach((d) => allItems.push({ label: d, category: "database" }));
  techStack.tools?.forEach((t) => allItems.push({ label: t, category: "tool" }));
  techStack.infrastructure?.forEach((i) => allItems.push({ label: i, category: "infra" }));

  const categoryStyles: Record<string, string> = {
    language: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    framework: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    database: "bg-green-500/15 text-green-400 border-green-500/30",
    tool: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    infra: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  };

  return (
    <div className="flex flex-wrap gap-2">
      {allItems.map((item, i) => (
        <span
          key={i}
          className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium font-mono ${categoryStyles[item.category] ?? ""}`}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function SystemOverview({ data, techStack }: SystemOverviewProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
          <div className="flex gap-2">
            <Badge variant="secondary" className="font-mono text-xs">
              {data.mainLanguage}
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              {data.repoType}
            </Badge>
          </div>
        </div>
        <p className="text-lg text-muted-foreground leading-relaxed">
          {data.description}
        </p>
      </div>

      {/* Tech Stack Strip */}
      {techStack && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Tech Stack
          </h2>
          <TechBadges techStack={techStack} />
        </div>
      )}

      <div className="h-px bg-border/50" />

      {/* Purpose */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Purpose</h2>
        <p className="text-muted-foreground leading-relaxed">{data.purpose}</p>
      </div>

      {/* Key Features */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Key Features
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.keyFeatures.map((feature, i) => (
            <Card key={i} className="border-border/50 bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed">{feature}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Getting Started */}
      {data.gettingStarted && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            Getting Started
          </h2>
          <div className="relative rounded-lg border border-border/50 bg-zinc-950 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border/30 bg-zinc-900/50 px-4 py-2">
              <div className="h-3 w-3 rounded-full bg-red-500/60" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
              <div className="h-3 w-3 rounded-full bg-green-500/60" />
              <span className="ml-2 text-xs text-muted-foreground font-mono">terminal</span>
            </div>
            <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
              <code className="font-mono text-green-400">{data.gettingStarted}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
