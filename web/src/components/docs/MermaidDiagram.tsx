"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    primaryColor: "#3b82f6",
    primaryTextColor: "#e2e8f0",
    primaryBorderColor: "#475569",
    lineColor: "#64748b",
    secondaryColor: "#1e293b",
    tertiaryColor: "#0f172a",
    background: "#0f172a",
    mainBkg: "#1e293b",
    nodeBorder: "#475569",
    clusterBkg: "#1e293b",
    titleColor: "#e2e8f0",
    edgeLabelBackground: "#1e293b",
    fontSize: "14px",
  },
  flowchart: { curve: "basis", padding: 16 },
  sequence: { actorMargin: 50, messageMargin: 40 },
});

let renderCounter = 0;

export function MermaidDiagram({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const render = async () => {
      if (!containerRef.current) return;
      try {
        const id = `mermaid-${++renderCounter}`;
        const { svg } = await mermaid.render(id, content);
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to render diagram");
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }
      }
    };
    render();
  }, [content]);

  if (error) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/50 p-4 overflow-x-auto">
        <pre className="text-sm font-mono text-muted-foreground whitespace-pre-wrap">
          {content}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="rounded-lg border border-border/50 bg-muted/30 p-4 md:p-6 overflow-x-auto [&_svg]:mx-auto [&_svg]:max-w-full"
    />
  );
}
