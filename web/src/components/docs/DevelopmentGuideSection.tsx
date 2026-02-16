"use client";

import type { DevelopmentGuide } from "@/types";
import { Terminal, FolderTree, TestTube, GitPullRequest } from "lucide-react";

function MarkdownContent({ content, title, icon: Icon }: { content: string; title: string; icon: React.ComponentType<{ className?: string }> }) {
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

export function DevelopmentGuideSection({ data }: { data: DevelopmentGuide }) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Development Guide</h1>
        <p className="text-sm text-muted-foreground">
          Everything you need to contribute to this project
        </p>
      </div>

      <div className="h-px bg-border/50" />

      {data.setup && (
        <MarkdownContent title="Dev Environment Setup" icon={Terminal} content={data.setup} />
      )}

      {data.projectStructure && (
        <MarkdownContent title="Project Structure" icon={FolderTree} content={data.projectStructure} />
      )}

      {data.testing && (
        <MarkdownContent title="Testing" icon={TestTube} content={data.testing} />
      )}

      {data.contributing && (
        <MarkdownContent title="Contributing" icon={GitPullRequest} content={data.contributing} />
      )}

      {/* Key Commands Table */}
      {data.keyCommands && data.keyCommands.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            Key Commands
          </h2>

          {/* Mobile: card layout */}
          <div className="space-y-3 md:hidden">
            {data.keyCommands.map((cmd, i) => (
              <div key={i} className="rounded-lg border border-border/50 bg-card/50 p-4 space-y-2">
                <code className="font-mono text-sm text-primary/90 break-all">{cmd.command}</code>
                <p className="text-sm text-muted-foreground">{cmd.description}</p>
              </div>
            ))}
          </div>

          {/* Desktop: table layout */}
          <div className="rounded-lg border border-border/50 overflow-hidden hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border/30">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Command</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody>
                {data.keyCommands.map((cmd, i) => (
                  <tr key={i} className="border-b border-border/20 last:border-0">
                    <td className="px-4 py-3">
                      <code className="font-mono text-xs bg-muted/50 px-1.5 py-0.5 rounded">{cmd.command}</code>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{cmd.description}</td>
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
