"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidDiagram } from "./MermaidDiagram";

interface WikiPageRendererProps {
  title: string;
  content: string;
}

export function WikiPageRenderer({ title, content }: WikiPageRendererProps) {
  return (
    <div className="wiki-page">
      <h1 className="text-3xl font-bold tracking-tight mb-6">{title}</h1>
      <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-pre:bg-muted prose-pre:text-foreground prose-pre:border prose-pre:border-border/50 prose-code:before:content-none prose-code:after:content-none prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-table:border-collapse prose-th:border prose-th:border-border/50 prose-th:px-3 prose-th:py-2 prose-th:bg-muted/50 prose-td:border prose-td:border-border/50 prose-td:px-3 prose-td:py-2">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "");
              const lang = match ? match[1] : "";
              const codeString = String(children).replace(/\n$/, "");

              // Mermaid diagrams
              if (lang === "mermaid") {
                return <MermaidDiagram content={codeString} />;
              }

              // Inline code (no language class, not inside pre)
              const isInline = !className;
              if (isInline) {
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }

              // Code blocks
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
            pre({ children }) {
              return (
                <pre className="overflow-x-auto rounded-lg border border-border/50 bg-muted p-4 text-sm text-foreground">
                  {children}
                </pre>
              );
            },
            table({ children }) {
              return (
                <div className="overflow-x-auto my-6">
                  <table className="w-full">{children}</table>
                </div>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
