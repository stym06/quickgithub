"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, Github } from "lucide-react";

function parseGitHubUrl(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim().replace(/\/+$/, "");

  // Try full URL: https://github.com/owner/repo (extracts owner/repo even if
  // deeper paths like /tree/main/... follow — we only care about the first two segments)
  const urlMatch = trimmed.match(
    /^(?:https?:\/\/)?github\.com\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,99})\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,99})(?:\/.*|\.git)?$/
  );
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, "") };
  }

  // Try owner/repo format
  const shortMatch = trimmed.match(
    /^([a-zA-Z0-9][a-zA-Z0-9._-]{0,99})\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,99})$/
  );
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] };
  }

  return null;
}

export function RepoUrlInput() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      setError("Enter a GitHub repo like vercel/next.js or paste a full URL");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/github/check?owner=${encodeURIComponent(parsed.owner)}&repo=${encodeURIComponent(parsed.repo)}`
      );
      const data = await res.json();

      if (!data.exists) {
        setError(data.error || "Repository not found on GitHub");
        return;
      }

      router.push(`/${parsed.owner}/${parsed.repo}`);
    } catch {
      setError("Could not verify repository. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl">
      <div className="group relative flex items-center rounded-2xl border border-white/10 bg-white/5 transition-colors focus-within:border-emerald-400/50 focus-within:bg-white/[0.07]">
        <Github className="ml-3 h-5 w-5 shrink-0 text-gray-500 sm:ml-4" />
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError("");
          }}
          placeholder="vercel/next.js"
          disabled={loading}
          className="h-12 min-w-0 flex-1 bg-transparent px-2 text-sm text-white placeholder:text-gray-600 focus:outline-none disabled:opacity-50 sm:h-14 sm:px-3 sm:text-base"
        />
        <button
          type="submit"
          disabled={loading}
          className="mr-1.5 flex h-9 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-sm font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-50 sm:mr-2 sm:h-10 sm:px-5"
        >
          {loading ? (
            <Search className="h-4 w-4 animate-pulse" />
          ) : (
            <>
              <span className="hidden sm:inline">Generate</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-3 px-1">
        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : (
          <p className="text-xs text-gray-600">
            Paste a GitHub URL or type <span className="text-gray-500">owner/repo</span>
          </p>
        )}
      </div>
    </form>
  );
}
