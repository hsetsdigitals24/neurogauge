import os
import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("ANALYTICS_SHARED_SECRET", "test-secret")

from app.main import app  # noqa: E402


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers():
    return {"X-Analytics-Key": "test-secret"}
