"""
Comprehensive Test Suite — Admin Operations
Tests all CRUD operations for Contracts and Users following CI/CD best practices.
Pyramid: Unit → Integration → E2E (edge cases)
"""
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend import auth, users
from backend.core.contracts import ContractsManager

client = TestClient(app)

# ─── Fixtures ─────────────────────────────────────────────────────────────────

TEST_CONTRACTS = ["TEST_CREATE", "TEST_DELETE", "TEST_UPDATE", "TEST_STATUS", "TEST_WIZARD", "TEST-WITH-DASH"]
TEST_USERS = ["test_admin_suite", "test_user_suite", "test_delete_user"]

@pytest.fixture(autouse=True)
def cleanup():
    """Clean up test contracts and users before and after each test."""
    mgr = ContractsManager()
    for cid in TEST_CONTRACTS:
        try:
            mgr.delete_contract(cid)
        except Exception:
            pass
    for u in TEST_USERS:
        try:
            users.delete_user(u)
        except Exception:
            pass
    yield
    for cid in TEST_CONTRACTS:
        try:
            mgr.delete_contract(cid)
        except Exception:
            pass
    for u in TEST_USERS:
        try:
            users.delete_user(u)
        except Exception:
            pass

@pytest.fixture
def admin_token():
    """Create a test admin user and return a valid JWT token."""
    username = "test_admin_suite"
    pw_hash = auth.get_password_hash("testpass")
    try:
        users.delete_user(username)
    except Exception:
        pass
    users.create_user(username, pw_hash, role="admin", contracts=[])
    token = auth.create_access_token({"sub": username, "role": "admin", "contracts": []})
    return token

@pytest.fixture
def superadmin_token():
    """Create a test superadmin user and return a valid JWT token."""
    username = "test_admin_suite"
    pw_hash = auth.get_password_hash("testpass")
    try:
        users.delete_user(username)
    except Exception:
        pass
    users.create_user(username, pw_hash, role="superadmin", contracts=[])
    token = auth.create_access_token({"sub": username, "role": "superadmin", "contracts": []})
    return token

def _headers(token):
    return {"Authorization": f"Bearer {token}"}


# ═══════════════════════════════════════════════════════════════════════════════
# CONTRACT CRUD TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestContractCreate:
    """Tests for POST /admin/contracts"""

    def test_create_contract_success(self, admin_token):
        r = client.post("/admin/contracts", json={
            "id": "TEST_CREATE", "name": "Test Contract", "description": "Unit test"
        }, headers=_headers(admin_token))
        assert r.status_code == 200
        assert r.json()["contract_id"] == "TEST_CREATE"

    def test_create_contract_auto_association(self, admin_token):
        """Contract creator should be auto-associated with the new contract."""
        client.post("/admin/contracts", json={
            "id": "TEST_CREATE", "name": "Test", "description": ""
        }, headers=_headers(admin_token))
        r = client.get("/auth/me", headers=_headers(admin_token))
        assert r.status_code == 200
        assert "TEST_CREATE" in r.json()["contracts"]

    def test_create_contract_empty_id(self, admin_token):
        r = client.post("/admin/contracts", json={
            "id": "  ", "name": "Bad", "description": ""
        }, headers=_headers(admin_token))
        assert r.status_code == 400

    def test_create_contract_duplicate(self, admin_token):
        client.post("/admin/contracts", json={
            "id": "TEST_CREATE", "name": "First", "description": ""
        }, headers=_headers(admin_token))
        r = client.post("/admin/contracts", json={
            "id": "TEST_CREATE", "name": "Duplicate", "description": ""
        }, headers=_headers(admin_token))
        assert r.status_code == 400

    def test_create_contract_no_auth(self):
        r = client.post("/admin/contracts", json={
            "id": "TEST_CREATE", "name": "No Auth", "description": ""
        })
        assert r.status_code in [401, 403]


class TestContractDelete:
    """Tests for DELETE /admin/contracts/{contract_id}"""

    def test_delete_contract_success(self, admin_token):
        # Create first
        client.post("/admin/contracts", json={
            "id": "TEST_DELETE", "name": "To Delete", "description": ""
        }, headers=_headers(admin_token))
        # Inactivate first (Required by safety rule)
        rp = client.put("/admin/contracts/TEST_DELETE", json={"status": "inactive"}, headers=_headers(admin_token))
        assert rp.status_code == 200, f"Failed to inactivate contract before delete: {rp.json()}"
        # Delete
        r = client.delete("/admin/contracts/TEST_DELETE", headers=_headers(admin_token))
        assert r.status_code == 200
        assert r.json()["status"] == "success"

    def test_delete_contract_not_found(self, admin_token):
        r = client.delete("/admin/contracts/NONEXISTENT_XYZ_999", headers=_headers(admin_token))
        assert r.status_code == 404

    def test_delete_contract_no_auth(self):
        r = client.delete("/admin/contracts/TEST_DELETE")
        assert r.status_code in [401, 403]

    def test_delete_contract_idempotent(self, admin_token):
        """Deleting the same contract twice should fail the second time."""
        client.post("/admin/contracts", json={
            "id": "TEST_DELETE", "name": "Idempotent", "description": ""
        }, headers=_headers(admin_token))
        # Inactivate first (Required by safety rule)
        rp = client.put("/admin/contracts/TEST_DELETE", json={"status": "inactive"}, headers=_headers(admin_token))
        assert rp.status_code == 200, f"Failed to inactivate contract before idempotent delete: {rp.json()}"
        r1 = client.delete("/admin/contracts/TEST_DELETE", headers=_headers(admin_token))
        assert r1.status_code == 200
        r2 = client.delete("/admin/contracts/TEST_DELETE", headers=_headers(admin_token))
        assert r2.status_code == 404


class TestContractUpdate:
    """Tests for PUT /admin/contracts/{contract_id}"""

    def test_update_contract_name(self, admin_token):
        client.post("/admin/contracts", json={
            "id": "TEST_UPDATE", "name": "Original", "description": ""
        }, headers=_headers(admin_token))
        r = client.put("/admin/contracts/TEST_UPDATE", json={
            "name": "Updated Name", "description": "Updated desc", "status": "inactive"
        }, headers=_headers(admin_token))
        assert r.status_code == 200
        data = r.json()["contract"]
        assert data["name"] == "Updated Name"
        assert data["status"] == "inactive"

    def test_update_contract_not_found(self, admin_token):
        r = client.put("/admin/contracts/NONEXISTENT", json={
            "name": "Ghost"
        }, headers=_headers(admin_token))
        assert r.status_code == 404


class TestContractList:
    """Tests for GET /admin/contracts"""

    def test_list_contracts(self, admin_token):
        r = client.get("/admin/contracts", headers=_headers(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_contracts_includes_created(self, admin_token):
        client.post("/admin/contracts", json={
            "id": "TEST_CREATE", "name": "Listed", "description": ""
        }, headers=_headers(admin_token))
        r = client.get("/admin/contracts", headers=_headers(admin_token))
        ids = [c["id"] for c in r.json()]
        assert "TEST_CREATE" in ids


class TestContractStatus:
    """Tests for GET /admin/contracts/{contract_id}/status"""

    def test_contract_status_fresh(self, admin_token):
        client.post("/admin/contracts", json={
            "id": "TEST_STATUS", "name": "Fresh", "description": ""
        }, headers=_headers(admin_token))
        r = client.get("/admin/contracts/TEST_STATUS/status", headers=_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert data["has_mapa"] is False
        assert data["has_contadores"] is False
        assert data["has_papel"] is False

    def test_contract_status_not_found(self, admin_token):
        r = client.get("/admin/contracts/NONEXISTENT/status", headers=_headers(admin_token))
        assert r.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# USER CRUD TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestUserCreate:
    """Tests for POST /admin/users"""

    def test_create_user_success(self, admin_token):
        r = client.post("/admin/users", json={
            "username": "test_user_suite", "password": "pw123",
            "role": "user", "contracts": [], "initial_route": "/"
        }, headers=_headers(admin_token))
        assert r.status_code == 200
        assert r.json()["username"] == "test_user_suite"
        assert "recovery_key" in r.json()  # Must return recovery key

    def test_create_user_duplicate(self, admin_token):
        client.post("/admin/users", json={
            "username": "test_user_suite", "password": "pw123",
            "role": "user", "contracts": [], "initial_route": "/"
        }, headers=_headers(admin_token))
        r = client.post("/admin/users", json={
            "username": "test_user_suite", "password": "pw456",
            "role": "user", "contracts": [], "initial_route": "/"
        }, headers=_headers(admin_token))
        assert r.status_code == 400

    def test_admin_cannot_create_superadmin(self, admin_token):
        r = client.post("/admin/users", json={
            "username": "test_user_suite", "password": "pw123",
            "role": "superadmin", "contracts": [], "initial_route": "/"
        }, headers=_headers(admin_token))
        assert r.status_code == 403


class TestUserDelete:
    """Tests for DELETE /admin/users/{username}"""

    def test_delete_user_success(self, admin_token):
        client.post("/admin/users", json={
            "username": "test_delete_user", "password": "pw",
            "role": "user", "contracts": [], "initial_route": "/"
        }, headers=_headers(admin_token))
        r = client.delete("/admin/users/test_delete_user", headers=_headers(admin_token))
        assert r.status_code == 200

    def test_delete_self_forbidden(self, admin_token):
        r = client.delete("/admin/users/test_admin_suite", headers=_headers(admin_token))
        assert r.status_code == 400

    def test_delete_nonexistent_user(self, admin_token):
        r = client.delete("/admin/users/ghost_user_xyz", headers=_headers(admin_token))
        assert r.status_code == 404


class TestUserList:
    """Tests for GET /admin/users"""

    def test_list_users(self, admin_token):
        r = client.get("/admin/users", headers=_headers(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        # Passwords should NOT be exposed
        for u in r.json():
            assert "password" not in u


class TestUserUpdate:
    """Tests for PUT /admin/users/{username}"""

    def test_update_user_contracts(self, admin_token):
        client.post("/admin/users", json={
            "username": "test_user_suite", "password": "pw",
            "role": "user", "contracts": [], "initial_route": "/"
        }, headers=_headers(admin_token))
        r = client.put("/admin/users/test_user_suite", json={
            "contracts": ["6070"], "initial_route": "/stock"
        }, headers=_headers(admin_token))
        assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════════
# AUTH ENDPOINT TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestAuth:
    """Tests for /auth/* endpoints"""

    def test_login_success(self):
        # Use a known test user
        username = "test_admin_suite"
        pw = "testlogin"
        pw_hash = auth.get_password_hash(pw)
        try:
            users.delete_user(username)
        except Exception:
            pass
        users.create_user(username, pw_hash, role="admin", contracts=["6070"])
        
        r = client.post("/auth/token", data={
            "username": username, "password": pw
        })
        assert r.status_code == 200
        assert "access_token" in r.json()
        assert r.json()["role"] == "admin"
        assert "6070" in r.json()["contracts"]

    def test_login_wrong_password(self):
        username = "test_admin_suite"
        pw_hash = auth.get_password_hash("correct")
        try:
            users.delete_user(username)
        except Exception:
            pass
        users.create_user(username, pw_hash, role="admin", contracts=[])
        
        r = client.post("/auth/token", data={
            "username": username, "password": "wrong"
        })
        assert r.status_code == 401

    def test_auth_me(self, admin_token):
        r = client.get("/auth/me", headers=_headers(admin_token))
        assert r.status_code == 200
        assert "username" in r.json()
        assert "contracts" in r.json()
        assert "role" in r.json()


# ═══════════════════════════════════════════════════════════════════════════════
# EDGE CASES
# ═══════════════════════════════════════════════════════════════════════════════

class TestEdgeCases:
    """Edge cases and boundary conditions"""

    def test_special_characters_in_contract_id(self, admin_token):
        """Contract IDs with special chars should work or fail gracefully."""
        r = client.post("/admin/contracts", json={
            "id": "TEST-WITH-DASH", "name": "Dash Test", "description": ""
        }, headers=_headers(admin_token))
        # Should succeed — dashes are valid
        assert r.status_code == 200
        # Cleanup - Inactivate first (Required by safety rule)
        cp = client.put("/admin/contracts/TEST-WITH-DASH", json={"status": "inactive"}, headers=_headers(admin_token))
        assert cp.status_code == 200
        client.delete("/admin/contracts/TEST-WITH-DASH", headers=_headers(admin_token))

    def test_whitespace_only_contract_id(self, admin_token):
        r = client.post("/admin/contracts", json={
            "id": "   ", "name": "Whitespace", "description": ""
        }, headers=_headers(admin_token))
        assert r.status_code == 400

    def test_expired_token(self):
        """Expired tokens should return 401."""
        from datetime import timedelta
        token = auth.create_access_token(
            {"sub": "nobody", "role": "admin"}, 
            expires_delta=timedelta(seconds=-1)
        )
        r = client.get("/admin/contracts", headers=_headers(token))
        assert r.status_code == 401

    def test_contract_full_lifecycle(self, admin_token):
        """Create → List → Status → Update → Delete full lifecycle."""
        h = _headers(admin_token)
        # Create
        r = client.post("/admin/contracts", json={
            "id": "TEST_WIZARD", "name": "Lifecycle", "description": "Full test"
        }, headers=h)
        assert r.status_code == 200
        
        # List — should include it
        r = client.get("/admin/contracts", headers=h)
        assert "TEST_WIZARD" in [c["id"] for c in r.json()]
        
        # Status — should show empty files
        r = client.get("/admin/contracts/TEST_WIZARD/status", headers=h)
        assert r.status_code == 200
        assert r.json()["has_mapa"] is False
        
        # Update
        r = client.put("/admin/contracts/TEST_WIZARD", json={
            "name": "Updated Lifecycle", "status": "inactive"
        }, headers=h)
        assert r.status_code == 200
        assert r.json()["contract"]["status"] == "inactive"
        
        # Delete
        r = client.delete("/admin/contracts/TEST_WIZARD", headers=h)
        assert r.status_code == 200
        
        # Verify gone
        r = client.get("/admin/contracts", headers=h)
        assert "TEST_WIZARD" not in [c["id"] for c in r.json()]
