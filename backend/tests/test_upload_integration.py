"""
Integration tests for Upload and Refinery modules.
Covers CSV processing, smart mapping (Refinery), backups, and Cortex learning.
"""
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend import auth, users
from backend.core.contracts import ContractsManager

client = TestClient(app)

# ─── Fixtures ─────────────────────────────────────────────────────────────────

TEST_CONTRACT = "UPLOAD_FIX_V2"
TEST_USER = "upload_fix_user"

@pytest.fixture(autouse=True)
def setup_upload_test():
    mgr = ContractsManager()
    try:
        mgr.delete_contract(TEST_CONTRACT)
    except Exception:
        pass
    mgr.create_contract(TEST_CONTRACT, "Upload Fix", "Testing refinery")
    
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
# FILE UPLOAD & REFINERY FLOW
# ═══════════════════════════════════════════════════════════════════════════════

def test_upload_and_confirm_mapping_flow(auth_headers):
    h = auth_headers
    cid = TEST_CONTRACT
    
    # 1. Upload CSV with aliased header 'SERIAL' — after Bug 1 fix, auto-mapping resolves SERIE
    # and returns success directly (no modal needed when missing_required is empty)
    csv_content = "SERIAL;EQUIPAMENTO;LOCALIZACAO\nSN_UPLOAD_001;Printer A;Floor 1"
    files = {'file': ('mapa.csv', csv_content, 'text/csv')}
    
    r = client.post(f"/upload/csv/MAPA?contract_id={cid}", files=files, headers=h)
    assert r.status_code == 200
    data = r.json()
    
    # After Bug 1 fix: SERIAL resolves to SERIE (missing_required=[]) → success directly
    assert data["status"] == "success"
    assert data["lines"] > 0
    
    # 2. Verify file exists in preview
    r = client.get(f"/preview/MAPA?contract_id={cid}", headers=h)
    assert r.status_code == 200
    assert r.json()["exists"] is True
    assert "SN_UPLOAD_001" in str(r.json()["rows"])

# ═══════════════════════════════════════════════════════════════════════════════
# BACKUPS
# ═══════════════════════════════════════════════════════════════════════════════

def test_backups_lifecycle(auth_headers):
    h = auth_headers
    cid = TEST_CONTRACT
    
    # 1. Create several versions via direct upload (bypass refinery if possible or just use common headers)
    # Using 'SERIE' directly might bypass mapping if already saved, but let's just do the full flow once to save mapping
    csv_v1 = "SERIE\nB1"
    r = client.post(f"/upload/csv/MAPA?contract_id={cid}", files={'file': ('v1.csv', csv_v1, 'text/csv')}, headers=h)
    
    # If it asks for mapping (first time), confirm it
    if r.json()["status"] == "mapping_required":
        client.post(f"/upload/confirm-mapping?contract_id={cid}", json={
            "file_key": "MAPA", "temp_token": r.json()["temp_token"], 
            "mapping": r.json()["current_mapping"], "save_for_future": True
        }, headers=h)

    # 2. Subsequent upload should be 'success' directly and create a backup of V1
    csv_v2 = "SERIE\nB2"
    r = client.post(f"/upload/csv/MAPA?contract_id={cid}", files={'file': ('v2.csv', csv_v2, 'text/csv')}, headers=h)
    assert r.json()["status"] == "success"
    
    # 3. List backups
    r = client.get(f"/backups/MAPA?contract_id={cid}", headers=h)
    assert r.status_code == 200
    backups = r.json()
    assert len(backups) >= 1
    
    # 4. Restore and Delete
    fname = backups[0]["filename"]
    assert client.post(f"/restore/{fname}?contract_id={cid}", headers=h).status_code == 200
    assert client.delete(f"/backups/{fname}?contract_id={cid}", headers=h).status_code == 200

# ═══════════════════════════════════════════════════════════════════════════════
# REFINERY DIRECT
# ═══════════════════════════════════════════════════════════════════════════════

def test_refinery_learn_and_process(auth_headers):
    h = auth_headers
    # Teach Cortex that 'ABC' means 'SERIE'
    client.post("/refinery/learn", json={"input_column": "ABC", "canonical_column": "SERIE"}, headers=h)
    
    csv = "ABC\nSN_LEARNED"
    files = {'file': ('t.csv', csv, 'text/csv')}
    r = client.post("/refinery/process/MAPA", files=files, headers=h)
    assert r.status_code == 200
    assert r.json()["mapping"]["used"]["serie"] == "ABC"


# ═══════════════════════════════════════════════════════════════════════════════
# BUG CONDITION EXPLORATION (Property 1)
# Estes testes codificam o comportamento ESPERADO após o fix.
# DEVEM FALHAR no código não corrigido — a falha confirma que o bug existe.
# Contraexemplo: "SERIAL" resolvido para SERIE, missing_required=[], mas retorna mapping_required
# ═══════════════════════════════════════════════════════════════════════════════

def test_bug_condition_mapa_sem_saved_map_serie_resolvida(auth_headers):
    """
    Bug Condition: Upload de MAPA sem saved_map, mas com SERIE resolvida pelo fuzzy/alias.
    O sistema NÃO deve exigir revisão manual quando missing_required está vazio.
    COMPORTAMENTO ESPERADO (após fix): status == "success"
    COMPORTAMENTO ATUAL (com bug): status == "mapping_required" — este teste FALHA, confirmando o bug.
    Contraexemplo: file_key=MAPA, saved_map={}, missing_required=[], force_review=False → mapping_required
    """
    h = auth_headers
    cid = TEST_CONTRACT
    # Contrato novo sem saved_map (garantido pelo fixture autouse que recria o contrato)
    # CSV com header 'SERIAL' — alias direto de SERIE reconhecido pelo RefineryMapper
    csv_content = "SERIAL;FILA;CIDADE\nSN_BUG_001;FILA_TESTE;SAO_PAULO\nSN_BUG_002;FILA_B;RIO"
    files = {'file': ('mapa_bug.csv', csv_content, 'text/csv')}

    r = client.post(
        f"/upload/csv/MAPA?contract_id={cid}&force_review=false",
        files=files,
        headers=h
    )
    assert r.status_code == 200
    data = r.json()

    # COMPORTAMENTO ESPERADO após fix: success direto, sem modal
    assert data["status"] == "success", (
        f"BUG CONFIRMADO: O sistema retornou '{data['status']}' ao invés de 'success'. "
        f"Contraexemplo: SERIAL resolvido para SERIE (missing_required=[]), "
        f"mas force_review_val=True por causa de 'not saved_map'. "
        f"Fix necessário: adicionar 'and bool(missing_required)' à expressão force_review_val."
    )
    assert data["lines"] > 0


def test_bug_condition_contadores_sem_saved_map_colunas_resolvidas(auth_headers):
    """
    Bug Condition: Upload de CONTADORES sem saved_map, com SERIE+TOTAL+DATA resolvidas.
    O bug também afeta CONTADORES no primeiro upload de um contrato novo.
    COMPORTAMENTO ESPERADO (após fix): status == "success"
    COMPORTAMENTO ATUAL (com bug): status == "mapping_required"
    """
    h = auth_headers
    cid = TEST_CONTRACT
    # CSV com headers que são aliases diretos das colunas obrigatórias de CONTADORES
    # REQUIRED_HEADERS["CONTADORES"] = ["SERIE", "TOTAL", "DATA"]
    # Aliases: SERIAL→SERIE, CONTADOR→TOTAL, DATE→DATA
    csv_content = "SERIAL;CONTADOR;DATE\nSN_CNT_001;12345;01/01/2026\nSN_CNT_002;67890;02/01/2026"
    files = {'file': ('contadores_bug.csv', csv_content, 'text/csv')}

    r = client.post(
        f"/upload/csv/CONTADORES?contract_id={cid}&force_review=false",
        files=files,
        headers=h
    )
    assert r.status_code == 200
    data = r.json()

    assert data["status"] == "success", (
        f"BUG CONFIRMADO em CONTADORES: retornou '{data['status']}' ao invés de 'success'. "
        f"Contraexemplo: SERIAL/CONTADOR/DATE resolvidos, missing_required=[], "
        f"mas force_review_val=True por 'not saved_map'."
    )
    assert data["lines"] > 0


def test_bug_condition_papel_sem_saved_map_serie_resolvida(auth_headers):
    """
    Bug Condition: Upload de PAPEL sem saved_map, com SERIE resolvida.
    REQUIRED_HEADERS["PAPEL"] = ["SERIE"]
    COMPORTAMENTO ESPERADO (após fix): status == "success"
    """
    h = auth_headers
    cid = TEST_CONTRACT
    csv_content = "SERIAL;A4RESMA;MEDIA\nSN_PAP_001;5;2500\nSN_PAP_002;3;1500"
    files = {'file': ('papel_bug.csv', csv_content, 'text/csv')}

    r = client.post(
        f"/upload/csv/PAPEL?contract_id={cid}&force_review=false",
        files=files,
        headers=h
    )
    assert r.status_code == 200
    data = r.json()

    assert data["status"] == "success", (
        f"BUG CONFIRMADO em PAPEL: retornou '{data['status']}' ao invés de 'success'. "
        f"Contraexemplo: SERIAL resolvido para SERIE, missing_required=[], "
        f"mas force_review_val=True por 'not saved_map'."
    )
    assert data["lines"] > 0
