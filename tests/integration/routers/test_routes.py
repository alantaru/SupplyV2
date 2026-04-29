"""
Módulo de Testes: Routes Router (backend.routers.routes)
Descrição: Testes de integração para gerenciamento de rotas e configurações.
Cobertura: /routes/, /routes/settings, /routes/generate
Idioma: PT-BR
"""
import pytest
from fastapi.testclient import TestClient
from backend.core.contracts import ContractsManager

@pytest.fixture
def setup_contract_routes(fs_isolation, clean_fs):
    """Setup contract with some data for routes"""
    mgr = ContractsManager()
    try:
        mgr.create_contract("6071", "Routes Contract", "Desc")
    except: pass
    return "6071"

@pytest.mark.integration
def test_get_settings_defaults(client: TestClient, mock_auth_admin, setup_contract_routes):
    """
    Cenário: Obter configurações de rota (padrão).
    Ação: GET /routes/settings.
    Resultado: JSON com cycle_days_threshold e alert_enabled.
    """
    # Need to target a contract session. Admin can override or use active.
    # Admin mock has active_contract="6071" in fs_isolation
    res = client.get("/routes/settings?contract_id=6071", headers=mock_auth_admin)
    assert res.status_code == 200
    data = res.json()
    assert "cycle_days_threshold" in data
    assert "alert_enabled" in data

@pytest.mark.integration
def test_update_settings(client: TestClient, mock_auth_admin, setup_contract_routes):
    payload = {"cycle_days_threshold": 45, "alert_enabled": True}
    res = client.post("/routes/settings?contract_id=6071", headers=mock_auth_admin, json=payload)
    assert res.status_code == 200
    assert res.json()["cycle_days_threshold"] == 45
    
    # Verify persistence
    res2 = client.get("/routes/settings?contract_id=6071", headers=mock_auth_admin)
    assert res2.json()["cycle_days_threshold"] == 45

@pytest.mark.integration
def test_save_and_list_route(client: TestClient, mock_auth_admin, setup_contract_routes):
    # Save
    route_data = {
        "name": "Rota 1",
        "series": ["SN1", "SN2"],
        "filters": []
    }
    res = client.post("/routes/?contract_id=6071", headers=mock_auth_admin, json=route_data)
    assert res.status_code == 200
    
    # List
    res_list = client.get("/routes/?contract_id=6071", headers=mock_auth_admin)
    assert res_list.status_code == 200
    routes = res_list.json()
    assert len(routes) == 1
    assert routes[0]["name"] == "Rota 1"

@pytest.mark.integration
def test_delete_route(client: TestClient, mock_auth_admin, setup_contract_routes):
    # Create first
    client.post("/routes/?contract_id=6071", headers=mock_auth_admin, json={"name": "Rota Delete", "series": [], "filters": []})
    
    # Delete
    res = client.delete("/routes/Rota Delete?contract_id=6071", headers=mock_auth_admin)
    assert res.status_code == 200
    
    # Verify
    res_list = client.get("/routes/?contract_id=6071", headers=mock_auth_admin)
    names = [r["name"] for r in res_list.json()]
    assert "Rota Delete" not in names
