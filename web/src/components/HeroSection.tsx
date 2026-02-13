"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, FolderTree, Layers, Code, ArrowRight, Github, Zap, Star, MousePointer2 } from "lucide-react";
import Link from "next/link";
import { RepoUrlInput } from "./RepoUrlInput";

interface DocumentedRepo {
  owner: string;
  name: string;
  description: string;
  language: string;
}

const LANGUAGE_COLORS: Record<string, string> = {
  javascript: "bg-yellow-400",
  typescript: "bg-blue-500",
  python: "bg-blue-400",
  go: "bg-cyan-400",
  rust: "bg-orange-500",
  java: "bg-red-400",
  ruby: "bg-red-500",
  c: "bg-gray-400",
  "c++": "bg-pink-400",
  "c#": "bg-purple-400",
  swift: "bg-orange-400",
  kotlin: "bg-purple-500",
  php: "bg-indigo-400",
};

function getLanguageColor(language: string) {
  return LANGUAGE_COLORS[language.toLowerCase()] ?? "bg-gray-400";
}

export function HeroSection({ repos = [] }: { repos?: DocumentedRepo[] }) {
  return (
    <section className="relative flex min-h-svh items-center overflow-x-hidden px-4 pb-8 pt-24 sm:min-h-[85vh] sm:pb-0 sm:pt-20">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[400px] w-[500px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px] sm:h-[600px] sm:w-[800px]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-8 sm:gap-12">
        <div className="flex w-full flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-12">
        {/* Left side — text + input */}
        <div className="w-full min-w-0 flex-1 text-center lg:text-left">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-[family-name:var(--font-display)] text-lg font-bold sm:text-2xl lg:text-3xl"
          >
            <TypewriterHeading />
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mt-8 w-full max-w-md lg:mx-0 lg:max-w-xl"
          >
            <RepoUrlInput />
          </motion.div>

          {/* Recently documented repos — ticker */}
          {repos.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mx-auto mt-6 w-full max-w-md lg:mx-0 lg:max-w-xl"
            >
              <p className="mb-3 text-xs font-medium text-gray-500">
                Already documented <span className="text-gray-600">&middot; no login required</span>
              </p>
              <RepoTicker repos={repos} />
            </motion.div>
          )}
        </div>

        {/* Right side — URL transform + doc wireframe animation */}
        {/* Mobile: blurred background, Desktop: normal */}
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

        {/* Star on GitHub */}
        <GitHubStarButton />
      </div>
    </section>
  );
}

function TypewriterHeading() {
  const text = "Understand any GitHub repo.";
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (count >= text.length) return;
    const t = setTimeout(() => setCount((c) => c + 1), 60);
    return () => clearTimeout(t);
  }, [count, text.length]);

  return (
    <span className="inline-flex items-center whitespace-nowrap">
      <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
        {text.slice(0, count)}
      </span>
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
        className="ml-0.5 inline-block h-[1em] w-[2px] bg-emerald-400"
      />
    </span>
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

function GitHubStarButton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.7 }}
    >
      <a
        href="https://github.com/stym06/quickgithub"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Github className="h-5 w-5" />
        <Star className="h-4 w-4 text-yellow-300" />
        Star
      </a>
    </motion.div>
  );
}

function RepoTicker({ repos }: { repos: DocumentedRepo[] }) {
  const items = [...repos, ...repos];
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative overflow-hidden">
      {/* Factory icons row */}
      <div className="relative mb-2 flex items-end justify-between px-4 sm:px-6">
        {/* Left: QuickGitHub output */}
        <div className="relative z-10 flex flex-col items-center">
          <div
            className="relative overflow-hidden rounded-xl bg-emerald-500/10 px-3 py-1.5 sm:px-4 sm:py-2"
            style={{ border: "1px solid rgba(52,211,153,0.3)" }}
          >
            {/* Shiny border sweep */}
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[200%]"
              style={{
                translate: "-50% -50%",
                background: "conic-gradient(from 0deg, transparent 0%, rgba(52,211,153,0.8) 8%, rgba(167,243,208,1) 10%, rgba(52,211,153,0.8) 12%, transparent 20%)",
                animation: "border-shine 4s linear infinite",
              }}
            />
            <div className="absolute inset-[1px] rounded-[11px] bg-gray-950" />
            {/* Blur glow behind */}
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-xl bg-emerald-500/20 blur-xl" />
            <div className="relative flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-emerald-400 sm:h-4 sm:w-4" />
              <span className="text-[10px] font-bold text-emerald-400 sm:text-xs">QuickGitHub</span>
            </div>
          </div>
          <div className="h-4 w-px bg-gradient-to-b from-emerald-400/40 to-transparent" />
        </div>

        {/* Animated dotted line from GitHub to QuickGitHub */}
        <div className="pointer-events-none absolute inset-x-[20%] top-1/2 z-0 sm:inset-x-[25%]">
          <div
            className="h-px w-full"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(167,139,250,0.5) 1px, transparent 1px)",
              backgroundSize: "8px 1px",
              animation: "dash-flow 1.5s linear infinite",
            }}
          />
        </div>

        {/* Right: GitHub source */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 sm:px-4 sm:py-2">
            {/* Blur glow behind */}
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-xl bg-white/5 blur-xl" />
            <Github className="h-3.5 w-3.5 text-gray-400 sm:h-4 sm:w-4" />
            <span className="text-[10px] font-medium text-gray-400 sm:text-xs">GitHub</span>
          </div>
          <div className="h-4 w-px bg-gradient-to-b from-white/20 to-transparent" />
        </div>
      </div>

      {/* Conveyor belt track */}
      <div className="relative rounded-lg border border-white/[0.06] bg-white/[0.02] py-1">
        {/* Dashed conveyor line */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed border-white/[0.06]" />

        {/* Scrolling items */}
        <div
          className="overflow-hidden"
          style={{
            maskImage: "linear-gradient(to right, transparent, black 4%, black 96%, transparent)",
            WebkitMaskImage: "linear-gradient(to right, transparent, black 4%, black 96%, transparent)",
          }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div
            ref={trackRef}
            className="flex w-max gap-3 px-2 py-1"
            style={{
              animation: "ticker 20s linear infinite",
              animationPlayState: paused ? "paused" : "running",
            }}
          >
            {items.map((repo, i) => (
              <Link
                key={`${repo.owner}/${repo.name}-${i}`}
                href={`/${repo.owner}/${repo.name}`}
                className="relative flex shrink-0 items-center gap-2 rounded-md border border-white/10 bg-gray-950 px-3 py-1.5 transition-colors hover:border-emerald-400/30 hover:bg-white/[0.07]"
              >
                {repo.language && (
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${getLanguageColor(repo.language)}`}
                  />
                )}
                <span className="text-sm text-gray-400 whitespace-nowrap">
                  {repo.owner}/
                  <span className="text-emerald-400">{repo.name}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Animated mouse cursor */}
        <ClickCursor />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes dash-flow {
          0% { background-position: 0 0; }
          100% { background-position: -16px 0; }
        }
        @keyframes border-shine {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}

function ClickCursor() {
  const [clicking, setClicking] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setClicking(true);
      setTimeout(() => setClicking(false), 600);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="pointer-events-none absolute left-[40%] top-1/2 z-20 -translate-y-1/2">
      <motion.div
        animate={clicking
          ? { y: [0, -4, 2, 0], scale: [1, 0.9, 1.05, 1] }
          : { y: 0, scale: 1 }
        }
        transition={{ duration: 0.5, ease: "easeInOut" }}
      >
        <MousePointer2 className="h-5 w-5 fill-white/50 text-white/60 blur-[0.5px] drop-shadow-lg" />
      </motion.div>
      {/* Click ripple */}
      <AnimatePresence>
        {clicking && (
          <motion.div
            initial={{ opacity: 0.6, scale: 0 }}
            animate={{ opacity: 0, scale: 2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute left-0 top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-400/50"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const POPUP_MESSAGES = [
  "Understand Next.js architecture",
  "How does the auth flow work?",
  "Map out the API routes",
  "What does this middleware do?",
  "Explain the database schema",
  "Find the entry points",
];

function DocWireframe() {
  const [popupIdx, setPopupIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setPopupIdx((i) => (i + 1) % POPUP_MESSAGES.length);
        setVisible(true);
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const sidebarItems = [
    { icon: FileText, label: "Overview", active: true },
    { icon: Layers, label: "Architecture", active: false },
    { icon: FolderTree, label: "Key Modules", active: false },
    { icon: Code, label: "Entry Points", active: false },
  ];

  return (
    <div className="relative flex h-[340px]">
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

      {/* Floating popup message */}
      <AnimatePresence mode="wait">
        {visible && (
          <motion.div
            key={popupIdx}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-4 right-4 max-w-[180px] rounded-lg border border-emerald-400/20 bg-gray-950/90 px-3 py-2 shadow-lg shadow-emerald-500/10 backdrop-blur-sm"
          >
            <div className="flex items-start gap-2">
              <Zap className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
              <span className="text-[11px] leading-tight text-gray-300">
                {POPUP_MESSAGES[popupIdx]}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
