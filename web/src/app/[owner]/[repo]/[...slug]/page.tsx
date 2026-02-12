import { SubpageClient } from "./SubpageClient";

interface PageProps {
  params: Promise<{ owner: string; repo: string; slug: string[] }>;
}

export default async function SubPage({ params }: PageProps) {
  const { owner, repo, slug } = await params;
  return <SubpageClient owner={owner} repo={repo} slug={slug} />;
}
