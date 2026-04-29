"""
Módulo de Testes: E2E Lifecycle (Full Flow)
Descrição: Simula ciclo completo de uso: Login -> Upload -> Análise -> Protocolos.
Cobertura: Integrada (Auth + Upload + Routes + Protocols)
Idioma: PT-BR
"""
import pytest
from fastapi.testclient import TestClient
from backend.core.contracts import ContractsManager

@pytest.fixture
def setup_e2e_contract(fs_isolation, clean_fs):
    mgr = ContractsManager()
    try:
        mgr.create_contract("6071", "E2E Contract", "Full Cycle")
        # Pre-seed mappings
        mgr.save_mapping("6071", "PAPEL", {"SERIE": "SERIE", "A4RESMA": "A4RESMA"})
        mgr.save_mapping("6071", "MAPA", {"SERIE": "SERIE", "MODELO": "MODELO", "LOCAL": "LOCAL"})
    except: pass
    return "6071"

@pytest.mark.e2e
def test_full_lifecycle_generation(client: TestClient, setup_e2e_contract):
    # 1. Login (Get Token)
    # Using 'admin' created in conftest
    login_res = client.post("/auth/token", data={"username": "admin", "password": "admin"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Upload Data (MAPA & PAPEL)
    # MAPA
    mapa_csv = "SERIE;MODELO;LOCAL\nSN001;PrinterX;Andar1\nSN002;PrinterY;Andar2"
    client.post(
        "/upload/csv/MAPA?contract_id=6071",
        headers=headers,
        files={"file": ("mapa.csv", mapa_csv, "text/csv")}
    )
    
    # PAPEL
    papel_csv = "SERIE;A4RESMA\nSN001;5\nSN002;0"
    client.post(
        "/upload/csv/PAPEL?contract_id=6071",
        headers=headers,
        files={"file": ("papel.csv", papel_csv, "text/csv")}
    )
    
    # 3. Analyze Routes
    # We want to analyze for SN001 and SN002
    analyze_payload = {"series": ["SN001", "SN002"]}
    analyze_res = client.post("/routes/analyze?contract_id=6071", headers=headers, json=analyze_payload)
    assert analyze_res.status_code == 200
    analysis = analyze_res.json()
    assert len(analysis) == 2
    
    # Verify logic (SN001 has suggestion because A4RESMA=5, override logic)
    sn001 = next(i for i in analysis if i["Serie"] == "SN001")
    assert sn001["Sugestao_A4"] == 5
    
    # 4. Generate Protocols
    # Select SN001 for generation
    gen_payload = {
        "selection": [
            {
                "Serie": "SN001",
                "A4": sn001["Sugestao_A4"],
                "TonerBk": 0
            }
        ]
    }
    gen_res = client.post("/routes/generate?contract_id=6071", headers=headers, json=gen_payload)
    assert gen_res.status_code == 200
    gen_data = gen_res.json()
    assert "created_ids" in gen_data
    assert len(gen_data["created_ids"]) == 1
    
    # Optional: Verify Protocol Existence (if endpoint existed)
    # For now, we trust the ID return.
