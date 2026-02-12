"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

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

export function FeaturedRepos({ repos }: { repos: DocumentedRepo[] }) {
  if (repos.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <h2 className="text-center text-3xl font-bold text-white">
        Already documented
      </h2>
      <p className="mt-2 text-center text-gray-400">
        Browse AI-generated docs for recently indexed projects
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {repos.map((repo) => (
          <Link
            key={`${repo.owner}/${repo.name}`}
            href={`/${repo.owner}/${repo.name}`}
          >
            <Card className="group h-full border-white/10 bg-white/5 transition-colors hover:border-emerald-400/30 hover:bg-white/[0.07]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-white">
                    {repo.owner}/
                    <span className="text-emerald-400">{repo.name}</span>
                  </CardTitle>
                  <ArrowRight className="h-4 w-4 text-gray-500 transition-transform group-hover:translate-x-1 group-hover:text-emerald-400" />
                </div>
                <CardDescription className="text-sm text-gray-400 line-clamp-2">
                  {repo.description}
                </CardDescription>
                {repo.language && (
                  <div className="flex items-center gap-3 pt-2">
                    <Badge
                      variant="secondary"
                      className="border-0 bg-white/10 text-xs text-gray-300"
                    >
                      <span
                        className={`mr-1 inline-block h-2 w-2 rounded-full ${getLanguageColor(repo.language)}`}
                      />
                      {repo.language}
                    </Badge>
                  </div>
                )}
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
