import { RepoPageClient } from "./RepoPageClient";

interface PageProps {
  params: Promise<{ owner: string; repo: string }>;
}

export default async function RepoPage({ params }: PageProps) {
  const { owner, repo } = await params;
  return <RepoPageClient owner={owner} repo={repo} />;
}
