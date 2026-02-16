const WORKER_API_URL = process.env.WORKER_API_URL || "http://localhost:8080";

interface EnqueueTaskParams {
  type: string;
  payload: {
    repo_id: string;
    owner: string;
    repo: string;
    full_name: string;
    agent_sdk?: string;
  };
}

/**
 * Enqueue a task by calling the Go worker's HTTP enqueue API.
 * The Go worker uses the asynq client to properly serialize the task
 * in protobuf format that the asynq server expects.
 */
export async function enqueueTask({ payload }: EnqueueTaskParams): Promise<string> {
  const res = await fetch(`${WORKER_API_URL}/enqueue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      repoId: payload.repo_id,
      owner: payload.owner,
      repo: payload.repo,
      fullName: payload.full_name,
      agentSdk: payload.agent_sdk ?? "claude",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to enqueue task: ${text}`);
  }

  const data = await res.json();
  return data.taskId;
}
