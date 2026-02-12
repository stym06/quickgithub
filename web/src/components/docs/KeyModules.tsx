"use client";

import { useState } from "react";
import type { ModuleAnalysis } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, FileCode } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function ModuleCard({ module, owner, repo }: { module: ModuleAnalysis; owner: string; repo: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Card
      id={`module-${module.modulePath}`}
      className="border-border/50 bg-card/50 overflow-hidden"
    >
      <CardHeader
        className="cursor-pointer select-none hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">{module.moduleName}</h3>
              {module.keyExports.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {module.keyExports.length} export{module.keyExports.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <code className="text-xs text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">
              {module.modulePath}
            </code>
          </div>
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mt-2">
          {module.description}
        </p>
      </CardHeader>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="border-t border-border/30 pt-4 space-y-4">
              {module.keyExports.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Exports
                  </h4>
                  <div className="space-y-1.5">
                    {module.keyExports.map((exp, j) => (
                      <div key={j} className="flex items-start gap-2 text-sm">
                        <Badge
                          variant="outline"
                          className="shrink-0 text-xs font-mono bg-primary/5"
                        >
                          {exp.type}
                        </Badge>
                        <code className="font-mono text-xs text-primary/90">
                          {exp.name}
                        </code>
                        <span className="text-muted-foreground text-xs">
                          — {exp.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {module.publicAPI.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Public API
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {module.publicAPI.map((api, j) => (
                      <code
                        key={j}
                        className="text-xs font-mono bg-muted/70 border border-border/50 px-2 py-0.5 rounded-md"
                      >
                        {api}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {module.internalDependencies.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Internal Dependencies
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {module.internalDependencies.map((dep, j) => (
                      <code
                        key={j}
                        className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md"
                      >
                        {dep}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {module.sourceFiles && module.sourceFiles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Source Files
                  </h4>
                  <div className="space-y-1">
                    {module.sourceFiles.map((file, j) => (
                      <a
                        key={j}
                        href={`https://github.com/${owner}/${repo}/blob/HEAD/${file}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-mono text-primary/80 hover:text-primary hover:underline"
                      >
                        <FileCode className="h-3.5 w-3.5 shrink-0" />
                        {file}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export function KeyModules({ data, owner, repo }: { data: ModuleAnalysis[]; owner: string; repo: string }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Key Modules</h1>
        <p className="text-sm text-muted-foreground">
          {data.length} module{data.length !== 1 ? "s" : ""} analyzed
        </p>
      </div>

      <div className="h-px bg-border/50" />

      <div className="space-y-3">
        {data.map((module, i) => (
          <ModuleCard key={i} module={module} owner={owner} repo={repo} />
        ))}
      </div>
    </div>
  );
}
