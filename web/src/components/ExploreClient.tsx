"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

interface ExploreRepo {
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

export function ExploreClient({ repos }: { repos: ExploreRepo[] }) {
  const [query, setQuery] = useState("");

  const filtered = repos.filter((r) => {
    const q = query.toLowerCase();
    return (
      r.owner.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      `${r.owner}/${r.name}`.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mt-6">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Search repos..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/25"
        />
      </div>

      {/* Repo grid */}
      {filtered.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-gray-500">No repos found matching &ldquo;{query}&rdquo;</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((repo) => (
            <Link
              key={`${repo.owner}/${repo.name}`}
              href={`/${repo.owner}/${repo.name}`}
              className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-emerald-400/30 hover:bg-white/[0.06]"
            >
              <div className="flex items-center gap-2">
                {repo.language && (
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${getLanguageColor(repo.language)}`}
                  />
                )}
                <span className="truncate text-sm font-medium text-gray-300 group-hover:text-white">
                  {repo.owner}/
                  <span className="text-emerald-400">{repo.name}</span>
                </span>
              </div>
              {repo.language && (
                <span className="mt-2 inline-block rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-gray-400">
                  {repo.language}
                </span>
              )}
              {repo.description && (
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-500">
                  {repo.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
