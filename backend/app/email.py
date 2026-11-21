"""SMTP email delivery for recovery tokens."""

# This currently is not functional (& emails are not required for account registration).

from email.message import EmailMessage
import smtplib

from .config import settings


def send_recovery_email(recipient: str, token: str) -> None:
    if not settings.smtp_host or not settings.recovery_email_from:
        raise RuntimeError(
            "Recovery email is not configured. Set SMTP_HOST and RECOVERY_EMAIL_FROM."
        )

    message = EmailMessage()
    message["Subject"] = "Your Trojan Horse Protocol recovery token"
    message["From"] = settings.recovery_email_from
    message["To"] = recipient
    message.set_content(
        "Your recovery token is:\n\n"
        f"{token}\n\n"
        f"This token expires in {settings.recovery_token_minutes} minutes. "
        "If you did not request account recovery, contact an administrator."
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_username and settings.smtp_password:
            server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)
