import { NextRequest } from "next/server";
import { getIndexingStatus } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { SSE_TIMEOUT } from "@/lib/constants";

type RouteParams = { params: Promise<{ owner: string; repo: string }> };

const VALID_SLUG = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { owner, repo } = await params;

  if (!VALID_SLUG.test(owner) || !VALID_SLUG.test(repo)) {
    return new Response("Invalid repository format", { status: 400 });
  }

  const fullName = `${owner}/${repo}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now();
      let closed = false;
      let pollTimer: ReturnType<typeof setTimeout> | null = null;

      function close() {
        if (closed) return;
        closed = true;
        if (pollTimer) clearTimeout(pollTimer);
        controller.close();
      }

      function sendEvent(data: Record<string, unknown>) {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      }

      const poll = async () => {
        if (closed) return;

        // Check timeout
        if (Date.now() - startTime > SSE_TIMEOUT) {
          sendEvent({
            status: "TIMEOUT",
            progress: 0,
            message: "Status polling timed out",
          });
          close();
          return;
        }

        try {
          // Check Redis first for real-time status
          const redisStatus = await getIndexingStatus(owner, repo);
          if (redisStatus) {
            sendEvent(redisStatus);

            const status = redisStatus.status as string;
            if (status === "COMPLETED" || status === "FAILED") {
              close();
              return;
            }
          } else {
            // Fall back to DB
            const repoRecord = await prisma.repo.findUnique({
              where: { fullName },
              select: { status: true, progress: true, errorMessage: true },
            });

            if (repoRecord) {
              sendEvent({
                status: repoRecord.status,
                progress: repoRecord.progress,
                message: repoRecord.errorMessage || "",
              });

              if (
                repoRecord.status === "COMPLETED" ||
                repoRecord.status === "FAILED"
              ) {
                close();
                return;
              }
            } else {
              sendEvent({
                status: "NOT_FOUND",
                progress: 0,
                message: "Repository not found",
              });
              close();
              return;
            }
          }
        } catch {
          sendEvent({
            status: "ERROR",
            progress: 0,
            message: "Internal error polling status",
          });
        }

        // Poll again in 500ms
        if (!closed) {
          pollTimer = setTimeout(poll, 500);
        }
      };

      request.signal.addEventListener("abort", () => close());

      await poll();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
