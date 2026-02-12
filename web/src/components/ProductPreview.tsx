"use client";

import { motion } from "framer-motion";
import { FileText, FolderTree, Layers, MessageSquare } from "lucide-react";

export function ProductPreview() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-24 sm:px-6">
      <h2 className="text-center text-3xl font-bold text-white">
        What you get
      </h2>
      <p className="mt-2 text-center text-gray-400">
        Comprehensive, AI-generated documentation in seconds
      </p>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mt-12 overflow-hidden rounded-xl border border-white/10 bg-white/5"
      >
        <div className="flex h-[400px]">
          {/* Sidebar mock */}
          <div className="hidden w-56 shrink-0 border-r border-white/10 bg-white/[0.02] p-4 sm:block">
            <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Documentation
            </div>
            <div className="space-y-1">
              {[
                { icon: FileText, label: "Overview", active: true },
                { icon: Layers, label: "Architecture" },
                { icon: FolderTree, label: "Key Modules" },
                { icon: MessageSquare, label: "Ask AI" },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                    item.active
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "text-gray-400"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          {/* Content mock */}
          <div className="flex-1 p-6">
            <div className="mb-6">
              <div className="h-5 w-48 rounded bg-white/10" />
              <div className="mt-3 space-y-2">
                <div className="h-3 w-full rounded bg-white/5" />
                <div className="h-3 w-5/6 rounded bg-white/5" />
                <div className="h-3 w-4/6 rounded bg-white/5" />
              </div>
            </div>

            <div className="mb-6">
              <div className="h-4 w-36 rounded bg-white/10" />
              <div className="mt-3 grid grid-cols-3 gap-3">
                {["React", "TypeScript", "Node.js"].map((tech) => (
                  <div
                    key={tech}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-xs text-gray-400"
                  >
                    {tech}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="h-4 w-40 rounded bg-white/10" />
              <div className="mt-3 space-y-2">
                <div className="h-3 w-full rounded bg-white/5" />
                <div className="h-3 w-3/4 rounded bg-white/5" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
