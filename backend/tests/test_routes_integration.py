"""
Integration tests for Route Planning module.
Covers analysis, preview, and protocol generation from routes.
"""
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend import auth, users
from backend.core.contracts import ContractsManager

client = TestClient(app)

# ─── Fixtures ─────────────────────────────────────────────────────────────────

TEST_CONTRACT = "ROUTES_FIX_V2"
TEST_USER = "routes_fix_user"

@pytest.fixture(autouse=True)
def setup_routes_test():
    mgr = ContractsManager()
    try:
        mgr.delete_contract(TEST_CONTRACT)
    except Exception:
        pass
    mgr.create_contract(TEST_CONTRACT, "Routes Fix", "Testing navigation")
    
    pw_hash = auth.get_password_hash("testpass")
    try:
        users.delete_user(TEST_USER)
    except Exception:
        pass
    users.create_user(TEST_USER, pw_hash, role="admin", contracts=[TEST_CONTRACT])
    
    yield
    
    try:
        mgr.delete_contract(TEST_CONTRACT)
    except Exception:
        pass
    try:
        users.delete_user(TEST_USER)
    except Exception:
        pass

@pytest.fixture
def auth_headers():
    token = auth.create_access_token({"sub": TEST_USER, "role": "admin"})
    return {"Authorization": f"Bearer {token}"}

# ═══════════════════════════════════════════════════════════════════════════════
# SETTINGS & METADATA
# ═══════════════════════════════════════════════════════════════════════════════

def test_route_settings(auth_headers):
    h = auth_headers
    cid = TEST_CONTRACT
    
    # 2. Update settings
    payload = {"cycle_days_threshold": 45, "alert_enabled": True}
    r = client.post(f"/routes/settings?contract_id={cid}", json=payload, headers=h)
    assert r.status_code == 200
    
    # 3. Verify update
    r = client.get(f"/routes/settings?contract_id={cid}", headers=h)
    assert r.json()["cycle_days_threshold"] == 45

# ═══════════════════════════════════════════════════════════════════════════════
# ROUTE OPERATIONS
# ═══════════════════════════════════════════════════════════════════════════════

def test_route_lifecycle(auth_headers):
    h = auth_headers
    cid = TEST_CONTRACT
    
    # 1. Save a new route
    payload = {
        "name": "TEST_ROTA_FRANCA",
        "series": ["SN_001", "SN_002"],
        "filters": [{"field": "Cidade", "value": "Franca"}]
    }
    r = client.post(f"/routes/?contract_id={cid}", json=payload, headers=h)
    assert r.status_code == 200
    
    # 2. List routes
    r = client.get(f"/routes/?contract_id={cid}", headers=h)
    assert any(route["name"] == "TEST_ROTA_FRANCA" for route in r.json())
    
    # 3. Update metadata
    meta = {"scheduled_date": "20/04/2024", "notes": "Test Route"}
    r = client.post(f"/routes/TEST_ROTA_FRANCA/metadata?contract_id={cid}", json=meta, headers=h)
    assert r.status_code == 200
    
    # 4. Delete route
    r = client.delete(f"/routes/TEST_ROTA_FRANCA?contract_id={cid}", headers=h)
    assert r.status_code == 200

def test_analyze_route_results(auth_headers):
    h = auth_headers
    cid = TEST_CONTRACT
    # Even if empty, it should return a list
    payload = {"series": ["SN_NOT_EXIST"]}
    r = client.post(f"/routes/analyze?contract_id={cid}", json=payload, headers=h)
    assert r.status_code == 200
    assert isinstance(r.json(), list)

def test_get_planning_summary_empty(auth_headers):
    r = client.get(f"/routes/planning?contract_id={TEST_CONTRACT}", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
