import asyncio
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings
from app.models.parametro_global import ParametroGlobal
from sqlalchemy.orm import Session


def _get_param(db: Session, chave: str, default: str = "") -> str:
    obj = db.query(ParametroGlobal).filter(ParametroGlobal.chave == chave).first()
    return obj.valor if obj else default


def _send_email_sync(
    smtp_host: str,
    smtp_port: int,
    smtp_user: str,
    smtp_password: str,
    destinatario: str,
    assunto: str,
    corpo: str,
    attachments: list[tuple[str, bytes]],
    corpo_html: str | None = None,
) -> None:
    msg = MIMEMultipart("alternative" if corpo_html and not attachments else "mixed")
    msg["From"] = smtp_user
    msg["To"] = destinatario
    msg["Subject"] = assunto

    if corpo_html:
        alt = MIMEMultipart("alternative")
        alt.attach(MIMEText(corpo, "plain", "utf-8"))
        alt.attach(MIMEText(corpo_html, "html", "utf-8"))
        msg.attach(alt)
    else:
        msg.attach(MIMEText(corpo, "plain", "utf-8"))

    for filename, content in attachments:
        part = MIMEApplication(content, Name=filename)
        part["Content-Disposition"] = f'attachment; filename="{filename}"'
        msg.attach(part)

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.send_message(msg)


async def enviar_oc_por_email(
    db: Session,
    destinatario: str,
    fornecedor: str,
    tipo: str,
    filename: str,
    csv_content: bytes,
) -> None:
    smtp_host = _get_param(db, "smtp_host")
    smtp_port = int(_get_param(db, "smtp_port", "587"))
    smtp_user = _get_param(db, "smtp_user")
    smtp_password = settings.smtp_password

    if not smtp_host or not smtp_user:
        raise ValueError("SMTP não configurado. Configure smtp_host e smtp_user em Parâmetros Globais.")

    assunto = f"[SafeStock] Ordem de Compra — {tipo.upper()} — {fornecedor}"
    corpo = (
        f"Segue em anexo a Ordem de Compra gerada pelo SafeStock.\n\n"
        f"Tipo: {tipo.upper()}\n"
        f"Fornecedor: {fornecedor}\n"
        f"Arquivo: {filename}\n\n"
        f"Este e-mail foi gerado automaticamente."
    )

    await asyncio.to_thread(
        _send_email_sync,
        smtp_host, smtp_port, smtp_user, smtp_password,
        destinatario, assunto, corpo, [(filename, csv_content)],
    )


async def enviar_email_generico(
    db: Session,
    destinatario: str,
    assunto: str,
    corpo_texto: str,
    corpo_html: str | None = None,
    attachments: list[tuple[str, bytes]] | None = None,
) -> None:
    smtp_host = _get_param(db, "smtp_host")
    smtp_port = int(_get_param(db, "smtp_port", "587"))
    smtp_user = _get_param(db, "smtp_user")
    smtp_password = settings.smtp_password

    if not smtp_host or not smtp_user:
        raise ValueError("SMTP não configurado. Configure smtp_host e smtp_user em Parâmetros Globais.")

    await asyncio.to_thread(
        _send_email_sync,
        smtp_host, smtp_port, smtp_user, smtp_password,
        destinatario, assunto, corpo_texto,
        attachments or [],
        corpo_html,
    )
