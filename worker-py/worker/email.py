import httpx

from .config import settings


async def send_completion_email(email: str, owner: str, repo: str, success: bool) -> None:
    if not settings.RESEND_API_KEY:
        return

    subject = (
        f"Docs ready for {owner}/{repo}" if success
        else f"Indexing failed for {owner}/{repo}"
    )
    body = (
        f'<p>Your documentation for <strong>{owner}/{repo}</strong> is ready!</p>'
        f'<p><a href="{settings.APP_BASE_URL}/{owner}/{repo}">View Docs</a></p>'
        if success else
        f'<p>We were unable to generate documentation for <strong>{owner}/{repo}</strong>. '
        f'Please try again later.</p>'
    )

    async with httpx.AsyncClient() as client:
        await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            json={
                "from": settings.NOTIFICATION_FROM_EMAIL,
                "to": [email],
                "subject": subject,
                "html": body,
            },
        )
