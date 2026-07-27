import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Mock environment variables before importing app
os.environ["DB_HOST"] = "localhost"
os.environ["DB_PORT"] = "3306"
os.environ["DB_USER"] = "root"
os.environ["DB_PASSWORD"] = "root"
os.environ["DB_NAME"] = "lumino_test"
os.environ["JWT_SECRET"] = "78b4081c3e34b9d5c3fa910f279d0315ef2f5342a8bdfebcbe2983c2718797f1"
os.environ["ROOT_EMAIL"] = "root@example.com"
os.environ["INVITE_REQUEST_ADMIN_EMAIL"] = "root@example.com"
os.environ["FRONTEND_BASE_URL"] = "http://testserver"
os.environ["INVITE_REQUEST_WORKER_ENABLED"] = "false"

from app.database import Base, get_db
from app.main import app
from app.models.invite_code import InviteCode
from app.models.user import User
from app.services.auth import hash_password

# SQLite in-memory database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def create_test_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def patch_chat_session_local(monkeypatch):
    import app.routers.chat
    monkeypatch.setattr(app.routers.chat, "SessionLocal", TestingSessionLocal)


@pytest.fixture
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def invite_code_factory(db):
    """Create explicit one-time invite codes for fixtures that need registration."""
    issuer = User(
        username="fixtureissuer",
        email="fixtureissuer@example.com",
        password=hash_password("password123"),
        display_name="Fixture Issuer",
        is_root=True,
        is_active=True,
    )
    db.add(issuer)
    db.flush()

    def create_code() -> str:
        code = f"test-invite-{uuid4().hex[:16]}"
        db.add(InviteCode(code=code, created_by=issuer.id))
        db.commit()
        return code

    return create_code


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
