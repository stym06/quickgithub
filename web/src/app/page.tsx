import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { HowItWorks } from "@/components/HowItWorks";
import { Footer } from "@/components/Footer";
import { IndexingBanner } from "@/components/IndexingBanner";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getDocumentedRepos() {
  const repos = await prisma.repo.findMany({
    where: { status: "COMPLETED" },
    include: { documentation: { select: { systemOverview: true } } },
    orderBy: { updatedAt: "desc" },
    take: 6,
  });

  return repos.map((r) => {
    const overview = r.documentation?.systemOverview as
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

export default async function Home() {
  const documentedRepos = await getDocumentedRepos();

  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-950">
      <Navbar />
      <HeroSection repos={documentedRepos} />
      <HowItWorks />
      <Footer />
      <Suspense>
        <IndexingBanner />
      </Suspense>
    </div>
  );
}
