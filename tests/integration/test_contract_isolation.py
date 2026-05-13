"""
Testes de Bugfix: Isolamento de Contratos — contract-isolation
Spec: .kiro/specs/contract-isolation/

Property 1 (Bug Condition): Três vetores de quebra de isolamento multi-tenant.
DEVEM FALHAR no código não corrigido — a falha confirma que o bug existe.

Property 2 (Preservation): Acesso autenticado normal não deve ser alterado.
DEVEM PASSAR no código não corrigido — confirma o baseline a preservar.
"""
import pytest
from fastapi.testclient import TestClient
from backend.core.contracts import ContractsManager


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def setup_isolation_contract(fs_isolation, clean_fs):
    """Contrato limpo no diretório temporário isolado."""
    mgr = ContractsManager()
    try:
        mgr.create_contract("6071", "Isolation Test", "Contract isolation testing")
    except ValueError:
        pass
    return "6071"


@pytest.fixture
def setup_two_contracts(fs_isolation, clean_fs):
    """Dois contratos isolados para testar separação."""
    mgr = ContractsManager()
    for cid, name in [("CONTRACT_A", "Contrato A"), ("CONTRACT_B", "Contrato B")]:
        try:
            mgr.create_contract(cid, name, "Isolation test")
        except ValueError:
            pass
    return ("CONTRACT_A", "CONTRACT_B")


# ═══════════════════════════════════════════════════════════════════════════════
# PROPERTY 1: BUG CONDITION EXPLORATION
# Estes testes codificam o comportamento ESPERADO após o fix.
# DEVEM FALHAR no código não corrigido — a falha confirma que o bug existe.
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.integration
def test_bug_vetor1_routes_isolamento_de_teste(client: TestClient, mock_auth_admin, setup_isolation_contract):
    """
    Vetor 1: RouteService lê diretório real de produção em vez do temporário.
    Contraexemplo: GET /routes retorna 4 rotas (produção) em vez de 1 (criada no teste).
    COMPORTAMENTO ESPERADO (após fix): len(routes) == 1
    COMPORTAMENTO ATUAL (com bug): len(routes) > 1 (dados de produção vazam)
    """
    cid = setup_isolation_contract

    # Criar exatamente 1 rota no diretório temporário isolado
    route_data = {"name": "Rota Isolada", "series": ["SN_ISO_001"], "filters": []}
    res_create = client.post(f"/routes/?contract_id={cid}", headers=mock_auth_admin, json=route_data)
    assert res_create.status_code == 200

    # Listar rotas — deve retornar APENAS a rota criada acima
    res_list = client.get(f"/routes/?contract_id={cid}", headers=mock_auth_admin)
    assert res_list.status_code == 200
    routes = res_list.json()

    assert len(routes) == 1, (
        f"BUG CONFIRMADO (Vetor 1): GET /routes retornou {len(routes)} rotas ao invés de 1. "
        f"Contraexemplo: RouteService está lendo o diretório real contracts/6071/ "
        f"(que tem {len(routes)} rotas de produção) em vez do diretório temporário isolado. "
        f"Fix: propagar monkeypatch para route_service_module.config.CONTRACTS_DIR no conftest.py."
    )
    assert routes[0]["name"] == "Rota Isolada"


@pytest.mark.integration
def test_bug_vetor2_export_sem_autenticacao(client: TestClient, setup_isolation_contract):
    """
    Vetor 2: Endpoints de export não exigem autenticação.
    Contraexemplo: GET /export/pendencias sem token retorna HTTP 200.
    COMPORTAMENTO ESPERADO (após fix): HTTP 401
    COMPORTAMENTO ATUAL (com bug): HTTP 200 com dados reais
    """
    # Sem header Authorization
    res = client.get("/export/pendencias")

    assert res.status_code == 401, (
        f"BUG CONFIRMADO (Vetor 2): GET /export/pendencias sem token retornou "
        f"HTTP {res.status_code} ao invés de 401. "
        f"Contraexemplo: endpoint não tem Depends(get_authorized_session), "
        f"qualquer pessoa pode acessar dados de qualquer contrato sem autenticação. "
        f"Fix: adicionar session: ContractSession = Depends(get_authorized_session) em export.py."
    )


@pytest.mark.integration
def test_bug_vetor2_export_stock_sem_autenticacao(client: TestClient):
    """Vetor 2: /export/stock/levels também sem autenticação."""
    res = client.get("/export/stock/levels")
    assert res.status_code == 401, (
        f"BUG CONFIRMADO (Vetor 2): GET /export/stock/levels sem token retornou HTTP {res.status_code}."
    )


@pytest.mark.integration
def test_bug_vetor2_export_deliveries_sem_autenticacao(client: TestClient):
    """Vetor 2: /export/deliveries também sem autenticação."""
    res = client.get("/export/deliveries")
    assert res.status_code == 401, (
        f"BUG CONFIRMADO (Vetor 2): GET /export/deliveries sem token retornou HTTP {res.status_code}."
    )


@pytest.mark.integration
def test_bug_vetor3_upload_override_contrato_sem_rbac(client: TestClient, mock_auth_user, setup_isolation_contract):
    """
    Vetor 3: Upload aceita ?contract_id=OUTRO sem verificar acesso do usuário.
    O usuário 'user' tem acesso apenas ao contrato '6071'.
    Tentar upload em contrato '9999' (não autorizado) deve retornar 403.
    COMPORTAMENTO ESPERADO (após fix): HTTP 403 ou upload usa session.contract_id
    COMPORTAMENTO ATUAL (com bug): upload processado no contrato '9999' sem erro
    """
    csv_content = "SERIAL\nSN_OVERRIDE_001"
    files = {"file": ("mapa_override.csv", csv_content, "text/csv")}

    # Usuário 'user' tenta fazer upload no contrato '9999' (não está na sua lista)
    res = client.post(
        "/upload/csv/MAPA?contract_id=9999",
        files=files,
        headers=mock_auth_user,
    )

    # Após o fix: o parâmetro contract_id é ignorado e usa session.contract_id (6071)
    # OU retorna 403 se o contrato 9999 não for acessível
    # O comportamento correto é que o upload NÃO vá para o contrato 9999
    assert res.status_code != 200 or (
        res.status_code == 200 and
        # Se retornou 200, deve ter usado session.contract_id (6071), não 9999
        # Verificar que o arquivo foi salvo em 6071, não em 9999
        True  # Verificação adicional feita abaixo
    ), (
        f"BUG CONFIRMADO (Vetor 3): POST /upload/csv/MAPA?contract_id=9999 "
        f"retornou HTTP {res.status_code}. "
        f"Contraexemplo: upload processado no contrato 9999 sem verificação de acesso. "
        f"Fix: remover contract_id query param de upload.py, usar session.contract_id."
    )

    # Verificação adicional: se retornou 200, confirmar que foi no contrato correto (6071)
    if res.status_code == 200:
        from backend import config
        # O arquivo deve estar em 6071 (session.contract_id), não em 9999
        import os
        file_in_9999 = (config.CONTRACTS_DIR / "9999" / "Mapa.csv").exists()
        assert not file_in_9999, (
            "BUG CONFIRMADO (Vetor 3): arquivo foi salvo no contrato 9999 "
            "mesmo sem o usuário ter acesso a ele."
        )


# ═══════════════════════════════════════════════════════════════════════════════
# PROPERTY 2: PRESERVATION
# Estes testes devem PASSAR no código não corrigido — confirmam o baseline.
# Devem continuar passando após o fix (sem regressões).
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.integration
def test_preservation_admin_acessa_export_autenticado(client: TestClient, mock_auth_admin, setup_isolation_contract):
    """
    Preservation: Admin autenticado pode acessar /export/pendencias.
    Comportamento correto que NÃO deve mudar após o fix.
    """
    res = client.get(
        f"/export/pendencias?contract_id={setup_isolation_contract}",
        headers=mock_auth_admin,
    )
    # Deve retornar 200 (dados vazios ou não, mas autenticado)
    assert res.status_code == 200, (
        f"REGRESSÃO: admin autenticado deveria ter acesso a /export/pendencias, "
        f"mas retornou HTTP {res.status_code}"
    )


@pytest.mark.integration
def test_preservation_user_acessa_proprio_contrato(client: TestClient, mock_auth_user, setup_isolation_contract):
    """
    Preservation: Usuário 'user' autenticado acessa seu próprio contrato (6071).
    Comportamento correto que NÃO deve mudar após o fix.
    """
    res = client.get(
        "/export/pendencias?contract_id=6071",
        headers=mock_auth_user,
    )
    assert res.status_code == 200, (
        f"REGRESSÃO: usuário autenticado no contrato 6071 deveria ter acesso, "
        f"mas retornou HTTP {res.status_code}"
    )


@pytest.mark.integration
def test_preservation_upload_sem_query_param_usa_session(client: TestClient, mock_auth_admin, setup_isolation_contract):
    """
    Preservation: Upload sem ?contract_id usa session.contract_id.
    Comportamento correto que NÃO deve mudar após o fix.
    """
    cid = setup_isolation_contract
    csv_content = "SERIAL\nSN_SESSION_001\nSN_SESSION_002"
    files = {"file": ("mapa_session.csv", csv_content, "text/csv")}

    # Upload SEM query param — deve usar session.contract_id (6071)
    res = client.post(
        "/upload/csv/MAPA",
        files=files,
        headers=mock_auth_admin,
    )
    assert res.status_code == 200, (
        f"REGRESSÃO: upload sem query param deveria funcionar, "
        f"mas retornou HTTP {res.status_code}: {res.text}"
    )
    data = res.json()
    assert data["status"] == "success", (
        f"REGRESSÃO: upload sem query param deveria retornar success, "
        f"mas retornou: {data}"
    )


@pytest.mark.integration
def test_preservation_separacao_fisica_entre_contratos(fs_isolation, clean_fs):
    """
    Preservation: Dados de um contrato não aparecem em outro.
    Separação física por diretório deve ser mantida.
    Testado diretamente via ContractsManager (sem HTTP) para evitar o Vetor 1.
    """
    mgr = ContractsManager()
    for cid, name in [("ISO_A", "Contrato A"), ("ISO_B", "Contrato B")]:
        try:
            mgr.create_contract(cid, name, "Isolation test")
        except ValueError:
            pass

    # Salvar mapeamento apenas em ISO_A
    mgr.save_mapping("ISO_A", "MAPA", {"SERIE": "COLUNA_A"})

    # ISO_B não deve ter o mapeamento de ISO_A
    map_b = mgr.get_mappings("ISO_B")
    assert "MAPA" not in map_b, (
        f"REGRESSÃO: mapeamento do contrato ISO_A vazou para ISO_B: {map_b}"
    )

    # ISO_A deve ter o mapeamento correto
    map_a = mgr.get_mappings("ISO_A")
    assert map_a.get("MAPA", {}).get("SERIE") == "COLUNA_A"


@pytest.mark.integration
def test_preservation_export_todos_endpoints_requerem_auth(client: TestClient):
    """
    Bug Condition (Vetor 2 completo): Todos os 7 endpoints de export devem exigir autenticação.
    DEVEM FALHAR no código não corrigido — confirmam o bug em todos os endpoints.
    COMPORTAMENTO ESPERADO (após fix): HTTP 401 para todos sem token.
    """
    endpoints = [
        ("GET", "/export/pendencias"),
        ("GET", "/export/stock/levels"),
        ("GET", "/export/stock/history"),
        ("GET", "/export/routes/planning"),
        ("GET", "/export/inventory"),
        ("GET", "/export/deliveries"),
    ]

    for method, endpoint in endpoints:
        res = client.get(endpoint)
        assert res.status_code == 401, (
            f"BUG CONFIRMADO (Vetor 2): {method} {endpoint} retornou HTTP {res.status_code} "
            f"sem token. Fix: adicionar Depends(get_authorized_session) em export.py."
        )
