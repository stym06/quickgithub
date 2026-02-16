from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


class EnqueueRequest(BaseModel):
    repoId: str
    owner: str
    repo: str
    fullName: str
    agentSdk: str = "claude"


class EnqueueResponse(BaseModel):
    taskId: str
    queue: str


app = FastAPI()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/enqueue", response_model=EnqueueResponse)
async def enqueue(req: EnqueueRequest):
    pool = app.state.arq_pool
    if pool is None:
        raise HTTPException(status_code=503, detail="Worker not ready")
    job = await pool.enqueue_job(
        "repo:index",
        repo_id=req.repoId,
        owner=req.owner,
        repo=req.repo,
        full_name=req.fullName,
        agent_sdk=req.agentSdk,
    )
    return EnqueueResponse(taskId=job.job_id, queue="arq:queue")
