import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDocsCache, setDocsCache, acquireIndexingLock, releaseIndexingLock, clearWorkerLock, clearWorkerLockIfStale, clearIndexingStatus, clearDocsCache, setIndexingStatus } from "@/lib/redis";
import { enqueueTask } from "@/lib/asynq";
import { MAX_REPOS_PER_USER } from "@/lib/constants";

type RouteParams = { params: Promise<{ owner: string; repo: string }> };

// Valid GitHub owner/repo: alphanumeric, hyphens, underscores, dots; 1-100 chars.
const VALID_SLUG = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;

function isValidRepoSlug(owner: string, repo: string): boolean {
  return VALID_SLUG.test(owner) && VALID_SLUG.test(repo);
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { owner, repo } = await params;

  if (!isValidRepoSlug(owner, repo)) {
    return NextResponse.json(
      { error: "Invalid repository format. Use owner/repo (e.g. vercel/next.js)" },
      { status: 400 }
    );
  }

  const fullName = `${owner}/${repo}`;

  // Always fetch updatedAt from DB (lightweight query).
  const repoMeta = await prisma.repo.findUnique({
    where: { fullName },
    select: { updatedAt: true },
  });

  // Check Redis cache first
  const cached = await getDocsCache(owner, repo);
  if (cached) {
    return NextResponse.json({
      ...cached,
      updatedAt: repoMeta?.updatedAt?.toISOString() ?? null,
      indexedWith: cached.indexedWith ?? null,
    });
  }

  // Fall back to DB
  const repoRecord = await prisma.repo.findUnique({
    where: { fullName },
    include: { documentation: true },
  });

  if (!repoRecord) {
    return NextResponse.json(
      { error: "Documentation not found" },
      { status: 404 }
    );
  }

  // Repo exists but no documentation yet (indexing in progress or failed)
  if (!repoRecord.documentation) {
    return NextResponse.json({
      id: repoRecord.id,
      owner,
      name: repo,
      fullName,
      status: repoRecord.status,
      errorMessage: repoRecord.errorMessage,
    });
  }

  const docs = {
    id: repoRecord.id,
    owner,
    name: repo,
    fullName,
    status: repoRecord.status,
    updatedAt: repoRecord.updatedAt.toISOString(),
    indexedWith: repoRecord.indexedWith,
    pages: repoRecord.documentation.pages,
    repoContext: repoRecord.documentation.repoContext,
    // Legacy fields (null for new wiki docs)
    overview: repoRecord.documentation.overview,
    gettingStarted: repoRecord.documentation.gettingStarted,
    coreArchitecture: repoRecord.documentation.coreArchitecture,
    apiReference: repoRecord.documentation.apiReference,
    usagePatterns: repoRecord.documentation.usagePatterns,
    developmentGuide: repoRecord.documentation.developmentGuide,
  };

  // Cache for future requests
  await setDocsCache(owner, repo, docs);

  return NextResponse.json(docs);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { owner, repo } = await params;

  if (!isValidRepoSlug(owner, repo)) {
    return NextResponse.json(
      { error: "Invalid repository format. Use owner/repo (e.g. vercel/next.js)" },
      { status: 400 }
    );
  }

  const fullName = `${owner}/${repo}`;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if repo already indexed or in progress
  const existing = await prisma.repo.findUnique({
    where: { fullName },
  });

  if (existing) {
    if (existing.status === "COMPLETED") {
      // Allow re-indexing: delete old documentation and clear all locks/cache
      await prisma.documentation.deleteMany({
        where: { repoId: existing.id },
      });
      await clearDocsCache(owner, repo);
      await clearIndexingStatus(owner, repo);
      await releaseIndexingLock(owner, repo);
    } else if (existing.status === "FAILED") {
      // Allow re-submission for FAILED repos — clear stale locks
      await clearIndexingStatus(owner, repo);
      await releaseIndexingLock(owner, repo);
    } else {
      // Allow re-submission for FAILED repos. For other statuses (PENDING,
      // FETCHING, etc.) check if a worker is actually running by testing the
      // worker-side Redis lock. If the lock is gone the previous attempt died
      // and we should allow re-submission rather than leaving the repo stuck.
      const workerLockHeld = !(await clearWorkerLockIfStale(owner, repo));
      if (workerLockHeld) {
        return NextResponse.json(
          {
            error: "Indexing already in progress",
            repoId: existing.id,
            statusUrl: `/api/repos/${owner}/${repo}/status`,
          },
          { status: 409 }
        );
      }
      // Lock is gone — previous worker died. Clear stale state and allow re-index.
      await clearIndexingStatus(owner, repo);
      await releaseIndexingLock(owner, repo);
    }
  }

  // Check user repo limit (skip for admin and Pro users)
  const isAdmin = process.env.ADMIN_USER_ID && session.user.id === process.env.ADMIN_USER_ID;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const agentSdk = user.tier === "PRO" ? "claude" : "openai";

  if (!isAdmin && user.tier !== "PRO" && user.reposClaimed >= MAX_REPOS_PER_USER) {
    return NextResponse.json(
      {
        error: `Free tier limit: max ${MAX_REPOS_PER_USER} repo(s). Join the Pro waitlist for unlimited repos.`,
      },
      { status: 403 }
    );
  }

  // Validate repo exists on GitHub
  const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    method: "HEAD",
    headers: {
      "User-Agent": "QuickGitHub",
    },
  });

  if (!ghRes.ok) {
    return NextResponse.json(
      { error: "Repository not found on GitHub" },
      { status: 404 }
    );
  }

  // Clear any stale worker lock / status from a previous failed run.
  await clearWorkerLock(owner, repo);
  await clearIndexingStatus(owner, repo);

  // Acquire indexing lock
  const lockAcquired = await acquireIndexingLock(owner, repo);
  if (!lockAcquired) {
    return NextResponse.json(
      { error: "Indexing already in progress" },
      { status: 409 }
    );
  }

  // Create or update repo record
  const repoRecord = await prisma.repo.upsert({
    where: { fullName },
    create: {
      owner,
      name: repo,
      fullName,
      status: "PENDING",
      claimedById: session.user.id,
    },
    update: {
      status: "PENDING",
      progress: 0,
      errorMessage: null,
      claimedById: session.user.id,
    },
  });

  // Increment user claimed count only for new repos (not re-indexing)
  if (!existing) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { reposClaimed: { increment: 1 } },
    });
  }

  // Set Redis status immediately so the SSE endpoint finds it
  // (prevents false "STALLED" before the worker picks up the job)
  await setIndexingStatus(owner, repo, {
    status: "PENDING",
    progress: 0,
    message: "Queued for indexing...",
  });

  // Enqueue task for the worker
  await enqueueTask({
    type: "index_repo",
    payload: {
      repo_id: repoRecord.id,
      owner,
      repo,
      full_name: fullName,
      agent_sdk: agentSdk,
    },
  });

  return NextResponse.json(
    {
      repoId: repoRecord.id,
      statusUrl: `/api/repos/${owner}/${repo}/status`,
    },
    { status: 202 }
  );
}
