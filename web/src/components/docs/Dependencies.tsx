"use client";

import type { Dependencies as DepsType } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

export function Dependencies({ data }: { data: DepsType }) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dependencies</h1>
        <p className="text-sm text-muted-foreground">
          Runtime, development, and key project dependencies
        </p>
      </div>

      <div className="h-px bg-border/50" />

      {/* Key Dependencies */}
      {data.key.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">
            Key Dependencies
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {data.key.map((dep, i) => (
              <Card key={i} className="border-border/50 bg-card/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary/70" />
                    <code className="font-mono">{dep.name}</code>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {dep.purpose}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Runtime Dependencies */}
      {data.runtime.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">
              Runtime Dependencies
            </h2>
            <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full font-mono">
              {data.runtime.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.runtime.map((dep, i) => (
              <code
                key={i}
                className="inline-flex items-center rounded-md border border-border/50 bg-muted/50 px-2.5 py-1 text-xs font-mono text-foreground/80 hover:bg-muted/70 transition-colors"
              >
                {dep}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Dev Dependencies */}
      {data.dev && data.dev.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">
              Dev Dependencies
            </h2>
            <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full font-mono">
              {data.dev.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.dev.map((dep, i) => (
              <code
                key={i}
                className="inline-flex items-center rounded-md border border-dashed border-border/50 bg-muted/30 px-2.5 py-1 text-xs font-mono text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                {dep}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
