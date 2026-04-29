"""
Integration tests for Data and Export modules.
Covers equipment search, protocol management, and all system exports.
"""
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend import auth, users
from backend.core.contracts import ContractsManager

client = TestClient(app)

# ─── Fixtures ─────────────────────────────────────────────────────────────────

TEST_CONTRACT = "DATA_FIX_V2"
TEST_USER = "data_fix_user"

@pytest.fixture(autouse=True)
def setup_data_test():
    mgr = ContractsManager()
    try:
        mgr.delete_contract(TEST_CONTRACT)
    except Exception:
        pass
    mgr.create_contract(TEST_CONTRACT, "Data Fix", "Testing endpoints")
    
    # Associate user
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
# EQUIPMENT & SEARCH
# ═══════════════════════════════════════════════════════════════════════════════

def test_search_equipment_empty(auth_headers):
    # Search for something non-existent
    r = client.get(f"/data/assist/search?q=XYZ_NOT_FOUND&contract_id={TEST_CONTRACT}", headers=auth_headers)
    assert r.status_code == 200
    assert "results" in r.json()

def test_get_filter_options(auth_headers):
    r = client.get(f"/data/entregas/filter-options?contract_id={TEST_CONTRACT}", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "cidades" in data
    assert "filas" in data

# ═══════════════════════════════════════════════════════════════════════════════
# PROTOCOL OPERATIONS
# ═══════════════════════════════════════════════════════════════════════════════

def test_protocol_lifecycle(auth_headers):
    h = auth_headers
    cid = TEST_CONTRACT
    
    # 1. Create Protocol
    payload = {
        "serie": "SN_LIFECYCLE_001",
        "modelo": "TEST_MODEL",
        "cidade": "SPS",
        "empresa": "TEST_CORP",
        "solicitacao": "Telefone",
        "solicitante": "Test User",
        "a4": 1
    }
    r = client.post(f"/data/entregas?contract_id={cid}", json=payload, headers=h)
    assert r.status_code == 200
    res_data = r.json()
    # Server generates the ID, we must use it
    protocol_id = res_data["protocol_id"]
    
    # 2. Get Pending List and verify presence
    r = client.get(f"/data/entregas?status=pending&contract_id={cid}", headers=h)
    assert r.status_code == 200
    protocols = r.json()
    assert any(str(p.get("Protocolo")) == str(protocol_id) for p in protocols)
    
    # 3. Update Protocol
    r = client.put(f"/data/entregas/{protocol_id}?contract_id={cid}", json={"obs": "Updated via Test"}, headers=h)
    assert r.status_code == 200
    
    # 4. Deliver Protocol
    delivery_data = {"recebedor": "John Doe", "user": TEST_USER, "Items": {"A4": 1}}
    r = client.post(f"/data/entregas/{protocol_id}/deliver?contract_id={cid}", json=delivery_data, headers=h)
    assert r.status_code == 200
    
    # 5. Verify delivered (should not be in pending)
    r = client.get(f"/data/entregas?status=pending&contract_id={cid}", headers=h)
    assert not any(str(p.get("Protocolo")) == str(protocol_id) for p in r.json())

def test_cancel_protocol(auth_headers):
    h = auth_headers
    cid = TEST_CONTRACT
    
    # 1. Create
    r = client.post(f"/data/entregas?contract_id={cid}", json={"serie": "SN_CANCEL"}, headers=h)
    pid = r.json()["protocol_id"]
    
    # 2. Cancel
    r = client.post(f"/data/entregas/{pid}/cancel?contract_id={cid}", json={"reason": "Test Cancellation"}, headers=h)
    assert r.status_code == 200
    
    # 3. Verify gone from pending
    r = client.get(f"/data/entregas?status=pending&contract_id={cid}", headers=h)
    assert not any(str(p.get("Protocolo")) == str(pid) for p in r.json())

# ═══════════════════════════════════════════════════════════════════════════════
# EXPORTS
# ═══════════════════════════════════════════════════════════════════════════════

def test_export_pendencias_csv(auth_headers):
    r = client.get(f"/export/pendencias?contract_id={TEST_CONTRACT}", headers=auth_headers)
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]

def test_export_deliveries_history(auth_headers):
    r = client.get(f"/export/deliveries?contract_id={TEST_CONTRACT}&status=all", headers=auth_headers)
    assert r.status_code == 200
    assert "historico_entregas.csv" in r.headers["content-disposition"]
