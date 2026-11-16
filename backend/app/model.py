from .database import Base
from datetime import datetime, timezone

from sqlalchemy import ForeignKey
from sqlalchemy import String
from sqlalchemy import LargeBinary

from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

#Referenced https://docs.sqlalchemy.org/en/21/orm/quickstart.html#declare-models
#           https://blog.miguelgrinberg.com/post/sqlalchemy-2-in-practice---chapter-8-sqlalchemy-and-the-web

def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

class User(Base):
    __tablename__ = 'users'

    id: Mapped[int]= mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(254), unique=True, index=True)

    role: Mapped[str] = mapped_column(default="member")
    handle: Mapped[bytes] = mapped_column(LargeBinary(32), unique=True)

    credentials: Mapped[list["Credential"]] = relationship(back_populates="user", cascade="all, delete-orphan")

class Credential(Base):
    __tablename__ = 'credentials'

    id: Mapped[int]= mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    credential_id: Mapped[bytes] = mapped_column(LargeBinary, unique=True, index=True)

    public_key: Mapped[bytes] = mapped_column(LargeBinary)
    sign_count: Mapped[int] = mapped_column(default=0)
    label: Mapped[str] = mapped_column(default="Passkey")

    user: Mapped["User"] = relationship(back_populates="credentials")

class AuditEvent(Base):
    __tablename__ = "audit_events"

    created_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(default=None)
    username: Mapped[str | None] = mapped_column(default=None)

    event: Mapped[str]
    success: Mapped[bool]

    ip: Mapped[str | None] = mapped_column(default=None)
    detail: Mapped[str | None] = mapped_column(default=None)

class RecoveryToken(Base):
    __tablename__ = "recovery_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime]
    used: Mapped[bool] = mapped_column(default=False)
    revoke_existing: Mapped[bool] = mapped_column(default=True)