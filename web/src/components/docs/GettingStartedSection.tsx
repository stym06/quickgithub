"use client";

import type { GettingStarted } from "@/types";
import { Cpu, Download, Rocket, Settings } from "lucide-react";

interface GettingStartedSectionProps {
  data?: GettingStarted;
}

function MarkdownBlock({ title, icon: Icon, content }: { title: string; icon: React.ComponentType<{ className?: string }>; content: string }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        {title}
      </h2>
      <div className="relative rounded-lg border border-border/50 bg-zinc-950 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border/30 bg-zinc-900/50 px-4 py-2">
          <div className="h-3 w-3 rounded-full bg-red-500/60" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
          <div className="h-3 w-3 rounded-full bg-green-500/60" />
          <span className="ml-2 text-xs text-muted-foreground font-mono">terminal</span>
        </div>
        <pre className="p-4 overflow-x-auto text-sm leading-relaxed whitespace-pre-wrap break-words">
          <code className="font-mono text-green-400">{content}</code>
        </pre>
      </div>
    </div>
  );
}

export function GettingStartedSection({ data }: GettingStartedSectionProps) {
  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Getting Started</h1>
        <p className="text-muted-foreground">
          No getting started guide is available for this repository yet. Re-index the
          repository to generate one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Getting Started</h1>
        <p className="text-sm text-muted-foreground">
          Step-by-step instructions to get this project up and running.
        </p>
      </div>

      <div className="h-px bg-border/50" />

      {data.prerequisites && (
        <MarkdownBlock title="Prerequisites" icon={Cpu} content={data.prerequisites} />
      )}

      {data.installation && (
        <MarkdownBlock title="Installation" icon={Download} content={data.installation} />
      )}

      {data.quickStart && (
        <MarkdownBlock title="Quick Start" icon={Rocket} content={data.quickStart} />
      )}

      {/* Configuration Options Table */}
      {data.configuration && data.configuration.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Configuration Options
          </h2>

          {/* Mobile: card layout */}
          <div className="space-y-3 md:hidden">
            {data.configuration.map((opt, i) => (
              <div key={i} className="rounded-lg border border-border/50 bg-card/50 p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-mono text-sm font-medium">{opt.name}</code>
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                      opt.required
                        ? "bg-red-500/15 text-red-400 border-red-500/30"
                        : "bg-green-500/15 text-green-400 border-green-500/30"
                    }`}
                  >
                    {opt.required ? "required" : "optional"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{opt.description}</p>
                {opt.default && (
                  <p className="text-xs text-muted-foreground">
                    Default: <code className="font-mono bg-muted/50 px-1 py-0.5 rounded">{opt.default}</code>
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: table layout */}
          <div className="rounded-lg border border-border/50 overflow-hidden hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border/30">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Required</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Default</th>
                </tr>
              </thead>
              <tbody>
                {data.configuration.map((opt, i) => (
                  <tr key={i} className="border-b border-border/20 last:border-0">
                    <td className="px-4 py-3">
                      <code className="font-mono text-xs">{opt.name}</code>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{opt.description}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                          opt.required
                            ? "bg-red-500/15 text-red-400 border-red-500/30"
                            : "bg-green-500/15 text-green-400 border-green-500/30"
                        }`}
                      >
                        {opt.required ? "yes" : "no"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {opt.default ? (
                        <code className="font-mono text-xs bg-muted/50 px-1.5 py-0.5 rounded">{opt.default}</code>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
