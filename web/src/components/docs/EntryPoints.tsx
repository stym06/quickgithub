"use client";

import { Fragment } from "react";
import type { EntryPoints as EntryPointsType, EntryPoint } from "@/types";
const typeColors: Record<string, string> = {
  server: "bg-green-500/15 text-green-400 border-green-500/30",
  cli: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  api: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  config: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  handler: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  middleware: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  worker: "bg-pink-500/15 text-pink-400 border-pink-500/30",
};

function getTypeStyle(type: string | undefined) {
  if (!type) return "";
  const key = type.toLowerCase();
  for (const [k, v] of Object.entries(typeColors)) {
    if (key.includes(k)) return v;
  }
  return "bg-muted text-muted-foreground border-border/50";
}

function EntryPointTable({
  title,
  items,
}: {
  title: string;
  items: EntryPoint[] | undefined;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_2fr] gap-px bg-border/30">
          {/* Header */}
          <div className="bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Name
          </div>
          <div className="bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Type
          </div>
          <div className="bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Description
          </div>

          {/* Rows */}
          {items.map((entry, i) => (
            <Fragment key={i}>
              <div
                className="bg-card/50 px-4 py-3 flex flex-col justify-center"
              >
                <span className="font-medium text-sm">{entry.name}</span>
                <code className="text-xs text-muted-foreground font-mono mt-0.5">
                  {entry.path}
                </code>
              </div>
              <div
                className="bg-card/50 px-4 py-3 flex items-center"
              >
                {entry.type && (
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono font-medium ${getTypeStyle(entry.type)}`}
                  >
                    {entry.type}
                  </span>
                )}
              </div>
              <div
                className="bg-card/50 px-4 py-3 flex items-center"
              >
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {entry.description}
                </p>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

export function EntryPoints({ data }: { data: EntryPointsType }) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Entry Points</h1>
        <p className="text-sm text-muted-foreground">
          Application entry points, CLI commands, and API endpoints
        </p>
      </div>

      <div className="h-px bg-border/50" />

      <EntryPointTable title="Main Entry Points" items={data.main} />
      <EntryPointTable title="CLI Commands" items={data.cli} />
      <EntryPointTable title="API Endpoints" items={data.api} />
      <EntryPointTable title="Configuration" items={data.config} />
    </div>
  );
}
