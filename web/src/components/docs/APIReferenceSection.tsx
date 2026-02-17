"use client";

import { useState } from "react";
import type { APIReference, APIModule } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const typeColors: Record<string, string> = {
  function: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  class: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  type: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  constant: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  endpoint: "bg-green-500/15 text-green-400 border-green-500/30",
  interface: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  method: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  component: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  hook: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

function getTypeStyle(type: string) {
  const key = type.toLowerCase();
  for (const [k, v] of Object.entries(typeColors)) {
    if (key.includes(k)) return v;
  }
  return "bg-muted text-muted-foreground border-border/50";
}

function ModuleCard({ module }: { module: APIModule }) {
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
              {module.exports.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {module.exports.length} export{module.exports.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <code className="text-xs text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded break-all">
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
            <CardContent className="border-t border-border/30 pt-4 space-y-3">
              {module.exports.map((exp, j) => (
                <div key={j} className="space-y-1">
                  <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono font-medium shrink-0 ${getTypeStyle(exp.type)}`}
                    >
                      {exp.type}
                    </span>
                    <code className="font-mono text-xs text-primary/90 break-all font-medium">
                      {exp.name}
                    </code>
                  </div>
                  {exp.signature && (
                    <code className="block text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded break-all">
                      {exp.signature}
                    </code>
                  )}
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {exp.description}
                  </p>
                </div>
              ))}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export function APIReferenceSection({ data }: { data: APIReference }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">API Reference</h1>
        <p className="text-sm text-muted-foreground">
          {data.modules.length} module{data.modules.length !== 1 ? "s" : ""} documented
        </p>
      </div>

      <div className="h-px bg-border/50" />

      <div className="space-y-3">
        {data.modules.map((module, i) => (
          <ModuleCard key={i} module={module} />
        ))}
      </div>
    </div>
  );
}
