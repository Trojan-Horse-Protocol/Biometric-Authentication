from database import Base

from sqlalchemy import ForeignKey
from sqlalchemy import String
from sqlalchemy import LargeBinary

from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

#Referenced https://docs.sqlalchemy.org/en/21/orm/quickstart.html#declare-models
#           https://blog.miguelgrinberg.com/post/sqlalchemy-2-in-practice---chapter-8-sqlalchemy-and-the-web

class Users(Base):
    __tablename__ = 'users'

    id: Mapped[int]= mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)

    role: Mapped[str] = mapped_column(default="member")
    webauthn_user_id: Mapped[bytes] = mapped_column(LargeBinary(32), unique=True)

    credentials: Mapped[list["Credential"]] = relationship(back_populates="user", cascade="all, delete-orphan")

class Credential(Base):
    __tablename__ = 'credentials'

    id: Mapped[int]= mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    credential_id: Mapped[bytes] = mapped_column(LargeBinary, unique=True, index=True)

    public_key: Mapped[str] = mapped_column(LargeBinary)
    signature: Mapped[int] = mapped_column(default=0)
    label: Mapped[str] = mapped_column(default="Passkey")

    user: Mapped[Users] = relationship(back_populates="credentials")