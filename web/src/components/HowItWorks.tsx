"use client";

import { Link2, Cpu, BookOpen } from "lucide-react";

const STEPS = [
  {
    icon: Link2,
    title: "Paste URL",
    description:
      "Drop any GitHub repository URL. Public repos only for V0.",
  },
  {
    icon: Cpu,
    title: "We analyze",
    description:
      "Our AI reads the codebase, parses structure, and generates comprehensive documentation.",
  },
  {
    icon: BookOpen,
    title: "Read docs",
    description:
      "Get architecture overviews, tech stack breakdowns, key modules, and entry points.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-24 sm:px-6">
      <h2 className="text-center text-3xl font-bold text-white">
        How it works
      </h2>
      <p className="mt-2 text-center text-gray-400">
        Three steps to understanding any codebase
      </p>

      <div className="mt-16 grid gap-8 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <div key={step.title} className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <step.icon className="h-6 w-6 text-emerald-400" />
            </div>
            <div className="mt-1 text-xs font-medium text-emerald-400">
              Step {i + 1}
            </div>
            <h3 className="mt-3 text-lg font-semibold text-white">
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
