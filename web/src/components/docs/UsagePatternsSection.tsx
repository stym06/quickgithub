"use client";

import type { UsagePatterns } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="relative rounded-lg border border-border/50 bg-zinc-950 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/30 bg-zinc-900/50 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500/60" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
          <div className="h-3 w-3 rounded-full bg-green-500/60" />
        </div>
        <span className="text-xs text-muted-foreground font-mono">{language}</span>
      </div>
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
        <code className="font-mono text-green-400 whitespace-pre-wrap break-words">{code}</code>
      </pre>
    </div>
  );
}

export function UsagePatternsSection({ data }: { data: UsagePatterns }) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Usage Patterns</h1>
        <p className="text-sm text-muted-foreground">
          Common use cases and code examples
        </p>
      </div>

      <div className="h-px bg-border/50" />

      {data.patterns.map((pattern, i) => (
        <div key={i} className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">{pattern.name}</h2>
            <p className="text-muted-foreground leading-relaxed">{pattern.description}</p>
          </div>

          <div className="space-y-4">
            {pattern.examples.map((example, j) => (
              <Card key={j} className="border-border/50 bg-card/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{example.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{example.description}</p>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={example.code} language={example.language} />
                </CardContent>
              </Card>
            ))}
          </div>

          {i < data.patterns.length - 1 && <div className="h-px bg-border/50" />}
        </div>
      ))}
    </div>
  );
}
