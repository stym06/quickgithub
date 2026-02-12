"use client";

import type { Architecture as ArchitectureType } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MermaidDiagram } from "./MermaidDiagram";

export function Architecture({ data }: { data: ArchitectureType }) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Architecture</h1>
        <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {data.description}
        </p>
      </div>

      <div className="h-px bg-border/50" />

      {/* Diagrams */}
      {data.diagrams && data.diagrams.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold tracking-tight">Diagrams</h2>
          {data.diagrams.map((diagram, i) => (
            <div key={i} className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-medium">{diagram.title}</h3>
                <Badge variant="outline" className="font-mono text-xs">
                  {diagram.type}
                </Badge>
              </div>
              <MermaidDiagram content={diagram.content} />
            </div>
          ))}
        </div>
      )}

      {/* Components */}
      {data.components.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Components</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {data.components.map((component, i) => (
              <Card key={i} className="border-border/50 bg-card/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{component.name}</CardTitle>
                  <code className="text-xs text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded w-fit">
                    {component.path}
                  </code>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {component.description}
                  </p>
                  {component.dependsOn && component.dependsOn.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">Depends on:</span>
                      {component.dependsOn.map((dep, j) => (
                        <Badge key={j} variant="outline" className="text-xs font-mono">
                          {dep}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Data Flow */}
      {data.dataFlow && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">Data Flow</h2>
          <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {data.dataFlow}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
