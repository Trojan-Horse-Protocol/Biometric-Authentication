from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

engine = create_engine('sqlite:///app.db', connect_args={"check_same_thread": False})
Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

class Base(DeclarativeBase):
    pass


def get_db():
    db = Session()
    try:
        yield db
    finally:
        db.close()
        