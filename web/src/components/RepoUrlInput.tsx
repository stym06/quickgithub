"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

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
      setError("Please enter a valid GitHub URL (e.g. github.com/vercel/next.js)");
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
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
            quickgithub.com/
          </span>
          <Input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError("");
            }}
            placeholder="owner/repo or paste GitHub URL"
            disabled={loading}
            className="h-14 rounded-xl border-white/20 bg-white/5 pl-[140px] text-base text-white placeholder:text-gray-500 focus:border-emerald-400 focus:ring-emerald-400/20"
          />
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="h-14 rounded-xl bg-emerald-500 px-6 text-base font-semibold text-white hover:bg-emerald-400"
        >
          {loading ? "Checking..." : "Go"}
          {!loading && <ArrowRight className="ml-1 h-4 w-4" />}
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}
    </form>
  );
}
