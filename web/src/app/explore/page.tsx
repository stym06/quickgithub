import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ExploreClient } from "@/components/ExploreClient";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Explore Repos | QuickGitHub",
  description: "Browse all indexed GitHub repositories on QuickGitHub",
};

async function getAllCompletedRepos() {
  const repos = await prisma.repo.findMany({
    where: { status: "COMPLETED" },
    include: { documentation: { select: { overview: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return repos.map((r) => {
    const overview = r.documentation?.overview as
      | { description?: string; mainLanguage?: string }
      | null;
    return {
      owner: r.owner,
      name: r.name,
      description: overview?.description ?? "",
      language: overview?.mainLanguage ?? "",
    };
  });
}

export default async function ExplorePage() {
  const repos = await getAllCompletedRepos();

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-6">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-white sm:text-3xl">
          Explore <span className="text-emerald-400">Repos</span>
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          Browse all {repos.length} indexed repositories
        </p>
        <ExploreClient repos={repos} />
      </main>
      <Footer />
    </div>
  );
}
