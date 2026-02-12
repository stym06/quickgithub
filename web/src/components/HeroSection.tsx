"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, FolderTree, Layers, Code, ArrowRight, Github } from "lucide-react";
import { RepoUrlInput } from "./RepoUrlInput";

export function HeroSection() {
  return (
    <section className="relative flex min-h-[85vh] items-center px-4 pt-20">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-16 lg:flex-row lg:items-center lg:gap-12">
        {/* Left side — text + input */}
        <div className="flex-1 text-center lg:text-left">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-5xl font-bold tracking-tight text-white sm:text-7xl"
          >
            Just add{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              quick
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-4 max-w-lg text-lg text-gray-400 sm:text-xl lg:max-w-md"
          >
            AI-powered documentation for any GitHub repo
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-8 w-full max-w-xl"
          >
            <RepoUrlInput />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-4 text-sm text-gray-500"
          >
            Paste any GitHub URL &rarr; get docs in 60 seconds
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-6"
          >
            <a
              href="https://github.com/stym06/quickgithub"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Github className="h-5 w-5" />
              View on GitHub
            </a>
          </motion.div>
        </div>

        {/* Right side — URL transform + doc wireframe animation */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="hidden w-full max-w-lg flex-1 lg:block"
        >
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] shadow-2xl shadow-emerald-500/5">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.02] px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
              </div>
              {/* URL bar with animation */}
              <div className="ml-3 flex-1 overflow-hidden rounded-md bg-white/5 px-3 py-1.5 font-mono text-xs">
                <UrlTransformAnimation />
              </div>
            </div>

            {/* Doc wireframe */}
            <DocWireframe />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

const REPOS = [
  "/vercel/next.js",
  "/facebook/react",
  "/denoland/deno",
  "/torvalds/linux",
];

function UrlTransformAnimation() {
  const [displayed, setDisplayed] = useState("");
  const repoIdx = useRef(0);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;

    function getBase() {
      return "github.com" + REPOS[repoIdx.current];
    }

    function sleep(ms: number) {
      return new Promise<void>((resolve) => {
        const t = setTimeout(() => { if (!cancelled.current) resolve(); }, ms);
        if (cancelled.current) clearTimeout(t);
      });
    }

    async function loop() {
      while (!cancelled.current) {
        const base = getBase();

        // Phase 1: type out "github.com/owner/repo"
        for (let i = 1; i <= base.length; i++) {
          if (cancelled.current) return;
          setDisplayed(base.slice(0, i));
          await sleep(45);
        }
        await sleep(600);

        // Phase 2: type "quick" in front
        const prefix = "quick";
        for (let i = 1; i <= prefix.length; i++) {
          if (cancelled.current) return;
          setDisplayed(prefix.slice(0, i) + base);
          await sleep(80);
        }
        await sleep(2500);

        // Phase 3: clear and move to next repo
        setDisplayed("");
        repoIdx.current = (repoIdx.current + 1) % REPOS.length;
        await sleep(300);
      }
    }

    loop();

    return () => { cancelled.current = true; };
  }, []);

  const isQuick = displayed.startsWith("quick");

  return (
    <span className="inline-flex items-center whitespace-nowrap">
      <AnimatePresence mode="wait">
        {isQuick ? (
          <motion.span
            key="quick"
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 1 }}
            className="text-emerald-400 font-semibold"
          >
            {displayed}
          </motion.span>
        ) : (
          <motion.span key="normal" className="text-gray-400">
            {displayed}
          </motion.span>
        )}
      </AnimatePresence>
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
        className="ml-px inline-block h-3.5 w-[2px] bg-emerald-400"
      />
    </span>
  );
}

function DocWireframe() {
  const sidebarItems = [
    { icon: FileText, label: "Overview", active: true },
    { icon: Layers, label: "Architecture", active: false },
    { icon: FolderTree, label: "Key Modules", active: false },
    { icon: Code, label: "Entry Points", active: false },
  ];

  return (
    <div className="flex h-[340px]">
      {/* Sidebar */}
      <div className="w-40 shrink-0 border-r border-white/10 bg-white/[0.02] p-3">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
          Documentation
        </div>
        <div className="space-y-0.5">
          {sidebarItems.map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] ${
                item.active
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-gray-500"
              }`}
            >
              <item.icon className="h-3 w-3" />
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden p-4">
        {/* Title */}
        <div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-emerald-500/20" />
            <div className="h-3.5 w-32 rounded bg-white/10" />
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-2 w-full rounded bg-white/5" />
            <div className="h-2 w-5/6 rounded bg-white/5" />
            <div className="h-2 w-4/6 rounded bg-white/5" />
          </div>
        </div>

        {/* Tech stack badges */}
        <div className="mt-5">
          <div className="h-2.5 w-20 rounded bg-white/10" />
          <div className="mt-2 flex gap-2">
            {["React", "TypeScript", "Node.js"].map((tech) => (
              <div
                key={tech}
                className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-gray-500"
              >
                {tech}
              </div>
            ))}
          </div>
        </div>

        {/* Architecture section */}
        <div className="mt-5">
          <div className="h-2.5 w-24 rounded bg-white/10" />
          <div className="mt-2 flex gap-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="flex-1 rounded-md border border-white/10 bg-white/[0.02] p-2"
              >
                <div className="h-2 w-full rounded bg-white/5" />
                <div className="mt-1.5 flex items-center gap-1">
                  <ArrowRight className="h-2 w-2 text-emerald-500/30" />
                  <div className="h-1.5 w-2/3 rounded bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom text lines */}
        <div className="mt-5 space-y-1.5">
          <div className="h-2 w-full rounded bg-white/5" />
          <div className="h-2 w-3/4 rounded bg-white/5" />
        </div>
      </div>
    </div>
  );
}
