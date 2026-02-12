"use client";

import type { SetupGuide as SetupGuideType } from "@/types";
import { Cpu, Download, Settings, Play, TestTube } from "lucide-react";

interface SetupGuideProps {
  data?: SetupGuideType;
}

const SECTIONS: {
  key: keyof SetupGuideType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "prerequisites", label: "Prerequisites", icon: Cpu },
  { key: "installation", label: "Installation", icon: Download },
  { key: "configuration", label: "Configuration", icon: Settings },
  { key: "running", label: "Running", icon: Play },
  { key: "testing", label: "Testing", icon: TestTube },
];

function TerminalBlock({ title, icon: Icon, content }: { title: string; icon: React.ComponentType<{ className?: string }>; content: string }) {
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

export function SetupGuide({ data }: SetupGuideProps) {
  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Setup Guide</h1>
        <p className="text-muted-foreground">
          No setup guide is available for this repository yet. Re-index the
          repository to generate one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Setup Guide</h1>
        <p className="text-sm text-muted-foreground">
          Step-by-step instructions to get this project running locally.
        </p>
      </div>

      <div className="h-px bg-border/50" />

      {SECTIONS.map(({ key, label, icon }) => {
        const content = data[key];
        if (!content) return null;
        return <TerminalBlock key={key} title={label} icon={icon} content={content} />;
      })}
    </div>
  );
}
