"""
Integration tests for Stock Management module.
Covers adjustments, history, and item level management.
"""
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend import auth, users
from backend.core.contracts import ContractsManager

client = TestClient(app)

# ─── Fixtures ─────────────────────────────────────────────────────────────────

TEST_CONTRACT = "STOCK_FIX_V2"
TEST_USER = "stock_fix_user"

@pytest.fixture(autouse=True)
def setup_stock_test():
    mgr = ContractsManager()
    try:
        mgr.delete_contract(TEST_CONTRACT)
    except Exception:
        pass
    mgr.create_contract(TEST_CONTRACT, "Stock Fix", "Testing inventory")
    
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
# STOCK LEVELS & HISTORY
# ═══════════════════════════════════════════════════════════════════════════════

def test_stock_adjust_and_history(auth_headers):
    h = auth_headers
    cid = TEST_CONTRACT
    
    # 1. Adjust Stock (ENTRADA)
    # Ensure item is a clear string to avoid pandas inference issues
    payload = {
        "item": "ITEM_TONER_X1",
        "qty": 10,
        "tipo": "ENTRADA",
        "reason": "Test",
        "empresa": "Simpress",
        "code": "CODE123"
    }
    r = client.post(f"/stock/adjust?contract_id={cid}", json=payload, headers=h)
    assert r.status_code == 200
    
    # 2. Verify Levels
    r = client.get(f"/stock/?contract_id={cid}", headers=h)
    levels = r.json()
    assert any(str(level.get("TipoModelo")) == "ITEM_TONER_X1" for level in levels)
    
    # 3. Update item name (This was failing with TypeError)
    update_payload = {
        "original_item": "ITEM_TONER_X1",
        "new_item": "ITEM_TONER_X1_RENAMED",
        "code": "CODE456",
        "empresa": "Simpress"
    }
    # Using loc for updates in the service should be safer than at[] if types mismatch
    r = client.put(f"/stock/item?contract_id={cid}", json=update_payload, headers=h)
    assert r.status_code == 200
    
    # 4. Check Final Name
    r = client.get(f"/stock/?contract_id={cid}", headers=h)
    assert any("RENAMED" in str(level.get("TipoModelo")) for level in r.json())

def test_delete_stock_item(auth_headers):
    h = auth_headers
    cid = TEST_CONTRACT
    client.post(f"/stock/adjust?contract_id={cid}", json={
        "item": "DELETE_ME", "qty": 1, "tipo": "ENTRADA", "empresa": "S"
    }, headers=h)
    
    r = client.delete(f"/stock/item?item=DELETE_ME&contract_id={cid}", headers=h)
    assert r.status_code == 200
    
    r = client.get(f"/stock/?contract_id={cid}", headers=h)
    assert not any("DELETE_ME" in str(level.get("TipoModelo")) for level in r.json())
