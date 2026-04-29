import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend import users, auth

client = TestClient(app)

TEST_USER = "test_audit_user"
TEST_PASS = "test_audit_pass"

@pytest.fixture(autouse=True)
def setup_user():
    # Cleanup
    try:
        users.delete_user(TEST_USER)
    except Exception:
        pass
    
    # Create
    pwd_hash = auth.get_password_hash(TEST_PASS)
    users.create_user(TEST_USER, pwd_hash, role="user")
    
    yield TEST_USER
    
    # Cleanup
    try:
        users.delete_user(TEST_USER)
    except Exception:
        pass

def test_login_token(setup_user):
    response = client.post(
        "/auth/token",
        data={"username": TEST_USER, "password": TEST_PASS}
    )
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_login_invalid_password(setup_user):
    response = client.post(
        "/auth/token",
        data={"username": TEST_USER, "password": "wrongpassword"}
    )
    assert response.status_code == 401

def test_get_me(setup_user):
    # Login
    login_res = client.post(
        "/auth/token",
        data={"username": TEST_USER, "password": TEST_PASS}
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    response = client.get("/auth/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["username"] == TEST_USER

def test_change_password(setup_user):
    # Login
    login_res = client.post(
        "/auth/token",
        data={"username": TEST_USER, "password": TEST_PASS}
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Change
    new_pass = "new_rigorous_pass"
    response = client.put(
        "/auth/change-password",
        json={"old_password": TEST_PASS, "new_password": new_pass},
        headers=headers
    )
    assert response.status_code == 200
    
    # Verify login with new pass
    login_res = client.post(
        "/auth/token",
        data={"username": TEST_USER, "password": new_pass}
    )
    assert login_res.status_code == 200
