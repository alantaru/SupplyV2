"""
Testes de Bugfix: Ciclo de Upload — settings-upload-cycle-fix
Spec: .kiro/specs/settings-upload-cycle-fix/

Property 1 (Bug Condition): Upload de arquivo crítico sem saved_map com missing_required
vazio retorna mapping_required indevidamente.
DEVEM FALHAR no código não corrigido — a falha confirma que o bug existe.

Property 2 (Preservation): Comportamentos fora da bug condition não devem mudar.
DEVEM PASSAR no código não corrigido — confirma o baseline a preservar.
"""
import json
import pytest
from fastapi.testclient import TestClient
from backend.core.contracts import ContractsManager

# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def contract_fresh(fs_isolation, clean_fs):
    """
    Contrato novo sem nenhum saved_map — simula o primeiro upload de um contrato.
    Garante que mappings.json NÃO existe para este contrato.
    """
    mgr = ContractsManager()
    cid = "BUG_FIX_TEST"
    try:
        mgr.create_contract(cid, "Bug Fix Test", "Upload cycle fix testing")
    except ValueError:
        pass
    # Garantir que não há saved_map para nenhum arquivo
    from backend import config
    mappings_path = config.CONTRACTS_DIR / cid / "mappings.json"
    if mappings_path.exists():
        mappings_path.unlink()
    return cid


@pytest.fixture
def contract_with_saved_map(fs_isolation, clean_fs):
    """
    Contrato com saved_map já persistido para MAPA — simula segundo upload.
    """
    mgr = ContractsManager()
    cid = "BUG_FIX_SAVED"
    try:
        mgr.create_contract(cid, "Bug Fix Saved", "Upload cycle fix testing with saved map")
    except ValueError:
        pass
    # Persistir mapeamento para MAPA
    mgr.save_mapping(cid, "MAPA", {"SERIE": "SERIAL", "FILA": "FILA", "CIDADE": "CIDADE"})
    return cid


# ═══════════════════════════════════════════════════════════════════════════════
# PROPERTY 1: BUG CONDITION EXPLORATION
# Estes testes codificam o comportamento ESPERADO após o fix.
# DEVEM FALHAR no código não corrigido — a falha confirma que o bug existe.
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.integration
def test_bug_condition_mapa_sem_saved_map_serie_resolvida(client: TestClient, mock_auth_admin, contract_fresh):
    """
    Bug Condition: Upload de MAPA sem saved_map, SERIE resolvida pelo alias 'SERIAL'.
    REQUIRED_HEADERS["MAPA"] = ["SERIE"]
    Após o fix: force_review_val = (True AND True AND bool([])) OR False = False → success
    Com o bug:  force_review_val = (True AND True) OR False = True → mapping_required

    Contraexemplo documentado:
      file_key=MAPA, saved_map={}, missing_required=[], force_review=False
      → retorna mapping_required (ERRADO, deveria ser success)
    """
    cid = contract_fresh
    # 'SERIAL' é alias direto de 'SERIE' no RefineryMapper.CANONICAL_SCHEMA["MAPA"]
    csv_content = "SERIAL;FILA;CIDADE\nSN_BUG_001;FILA_TESTE;SAO_PAULO\nSN_BUG_002;FILA_B;RIO"
    files = {"file": ("mapa_bug.csv", csv_content, "text/csv")}

    response = client.post(
        f"/upload/csv/MAPA?contract_id={cid}&force_review=false",
        files=files,
        headers=mock_auth_admin,
    )
    assert response.status_code == 200
    data = response.json()

    # COMPORTAMENTO ESPERADO após fix
    assert data["status"] == "success", (
        f"BUG CONFIRMADO: retornou '{data['status']}' ao invés de 'success'. "
        f"Contraexemplo: SERIAL→SERIE resolvido (missing_required=[]), "
        f"mas force_review_val=True por 'not saved_map'. "
        f"Fix: adicionar 'and bool(missing_required)' à expressão force_review_val."
    )
    assert data["lines"] > 0


@pytest.mark.integration
def test_bug_condition_contadores_sem_saved_map_colunas_resolvidas(client: TestClient, mock_auth_admin, contract_fresh):
    """
    Bug Condition: Upload de CONTADORES sem saved_map, SERIE+TOTAL+DATA resolvidas.
    REQUIRED_HEADERS["CONTADORES"] = ["SERIE", "TOTAL", "DATA"]
    Aliases: SERIAL→SERIE, CONTADOR→TOTAL, DATE→DATA

    Contraexemplo documentado:
      file_key=CONTADORES, saved_map={}, missing_required=[], force_review=False
      → retorna mapping_required (ERRADO)
    """
    cid = contract_fresh
    csv_content = "SERIAL;CONTADOR;DATE\nSN_CNT_001;12345;01/01/2026\nSN_CNT_002;67890;02/01/2026"
    files = {"file": ("contadores_bug.csv", csv_content, "text/csv")}

    response = client.post(
        f"/upload/csv/CONTADORES?contract_id={cid}&force_review=false",
        files=files,
        headers=mock_auth_admin,
    )
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "success", (
        f"BUG CONFIRMADO em CONTADORES: retornou '{data['status']}' ao invés de 'success'. "
        f"Contraexemplo: SERIAL/CONTADOR/DATE resolvidos, missing_required=[], "
        f"mas force_review_val=True por 'not saved_map'."
    )
    assert data["lines"] > 0


@pytest.mark.integration
def test_bug_condition_papel_sem_saved_map_serie_resolvida(client: TestClient, mock_auth_admin, contract_fresh):
    """
    Bug Condition: Upload de PAPEL sem saved_map, SERIE resolvida.
    REQUIRED_HEADERS["PAPEL"] = ["SERIE"]

    Contraexemplo documentado:
      file_key=PAPEL, saved_map={}, missing_required=[], force_review=False
      → retorna mapping_required (ERRADO)
    """
    cid = contract_fresh
    csv_content = "SERIAL;A4RESMA;MEDIA\nSN_PAP_001;5;2500\nSN_PAP_002;3;1500"
    files = {"file": ("papel_bug.csv", csv_content, "text/csv")}

    response = client.post(
        f"/upload/csv/PAPEL?contract_id={cid}&force_review=false",
        files=files,
        headers=mock_auth_admin,
    )
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "success", (
        f"BUG CONFIRMADO em PAPEL: retornou '{data['status']}' ao invés de 'success'. "
        f"Contraexemplo: SERIAL→SERIE resolvido, missing_required=[], "
        f"mas force_review_val=True por 'not saved_map'."
    )
    assert data["lines"] > 0


# ═══════════════════════════════════════════════════════════════════════════════
# PROPERTY 2: PRESERVATION
# Estes testes devem PASSAR no código não corrigido — confirmam o baseline.
# Devem continuar passando após o fix (sem regressões).
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.integration
def test_preservation_missing_required_sempre_retorna_mapping_required_mapa(client: TestClient, mock_auth_admin, contract_fresh):
    """
    Preservation: CSV sem coluna SERIE (nem aliases) → sempre mapping_required.
    Comportamento correto que NÃO deve mudar após o fix.
    """
    cid = contract_fresh
    # Header completamente desconhecido — não resolve SERIE
    csv_content = "NOME_COLUNA_DESCONHECIDA;OUTRA_COLUNA\nVALOR1;VALOR2"
    files = {"file": ("mapa_sem_serie.csv", csv_content, "text/csv")}

    response = client.post(
        f"/upload/csv/MAPA?contract_id={cid}&force_review=false",
        files=files,
        headers=mock_auth_admin,
    )
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "mapping_required", (
        f"REGRESSÃO: deveria retornar mapping_required quando SERIE não resolvida, "
        f"mas retornou '{data['status']}'"
    )
    assert "SERIE" in data.get("missing_after_mapping", []), (
        f"SERIE deveria estar em missing_after_mapping, mas got: {data.get('missing_after_mapping')}"
    )


@pytest.mark.integration
def test_preservation_missing_required_sempre_retorna_mapping_required_contadores(client: TestClient, mock_auth_admin, contract_fresh):
    """
    Preservation: CONTADORES sem TOTAL → sempre mapping_required.
    """
    cid = contract_fresh
    # Tem SERIE mas não tem TOTAL nem DATA
    csv_content = "SERIAL;OUTRA_COLUNA\nSN001;VALOR"
    files = {"file": ("contadores_sem_total.csv", csv_content, "text/csv")}

    response = client.post(
        f"/upload/csv/CONTADORES?contract_id={cid}&force_review=false",
        files=files,
        headers=mock_auth_admin,
    )
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "mapping_required"
    missing = data.get("missing_after_mapping", [])
    # TOTAL ou DATA devem estar faltando
    assert len(missing) > 0, f"Esperava colunas faltantes, mas missing_after_mapping={missing}"


@pytest.mark.integration
def test_preservation_force_review_true_sempre_forca_modal(client: TestClient, mock_auth_admin, contract_fresh):
    """
    Preservation: force_review=True explícito sempre retorna mapping_required,
    mesmo quando missing_required está vazio.
    """
    cid = contract_fresh
    # CSV com SERIE resolvida — sem o bug, retornaria success
    csv_content = "SERIAL;FILA\nSN_FORCE_001;FILA_A"
    files = {"file": ("mapa_force.csv", csv_content, "text/csv")}

    response = client.post(
        f"/upload/csv/MAPA?contract_id={cid}&force_review=true",
        files=files,
        headers=mock_auth_admin,
    )
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "mapping_required", (
        f"REGRESSÃO: force_review=True deve sempre retornar mapping_required, "
        f"mas retornou '{data['status']}'"
    )
    assert "temp_token" in data
    assert "detected_columns" in data


@pytest.mark.integration
def test_preservation_saved_map_presente_retorna_success(client: TestClient, mock_auth_admin, contract_with_saved_map):
    """
    Preservation: Quando saved_map já existe, upload retorna success diretamente.
    Comportamento já correto que não deve regredir.
    """
    cid = contract_with_saved_map
    # CSV com header SERIAL — saved_map já mapeia SERIAL→SERIE
    csv_content = "SERIAL;FILA;CIDADE\nSN_SAVED_001;FILA_X;BH\nSN_SAVED_002;FILA_Y;SP"
    files = {"file": ("mapa_saved.csv", csv_content, "text/csv")}

    response = client.post(
        f"/upload/csv/MAPA?contract_id={cid}&force_review=false",
        files=files,
        headers=mock_auth_admin,
    )
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "success", (
        f"REGRESSÃO: com saved_map presente deveria retornar success, "
        f"mas retornou '{data['status']}'"
    )
    assert data["lines"] > 0


@pytest.mark.integration
def test_preservation_confirm_mapping_persiste_no_contrato_correto(client: TestClient, mock_auth_admin, contract_fresh):
    """
    Preservation: confirm-mapping com save_for_future=True persiste o mapeamento
    em mappings.json do contrato correto.
    """
    cid = contract_fresh
    csv_content = "NOME_COLUNA_DESCONHECIDA;OUTRA\nSN_CONF_001;VAL"
    files = {"file": ("mapa_confirm.csv", csv_content, "text/csv")}

    # 1. Upload → mapping_required
    r1 = client.post(
        f"/upload/csv/MAPA?contract_id={cid}",
        files=files,
        headers=mock_auth_admin,
    )
    assert r1.status_code == 200
    data1 = r1.json()
    assert data1["status"] == "mapping_required"
    temp_token = data1["temp_token"]

    # 2. Confirmar mapeamento com save_for_future=True
    payload = {
        "temp_token": temp_token,
        "file_key": "MAPA",
        "mapping": {"SERIE": "NOME_COLUNA_DESCONHECIDA"},
        "save_for_future": True,
    }
    r2 = client.post(
        f"/upload/confirm-mapping?contract_id={cid}",
        json=payload,
        headers=mock_auth_admin,
    )
    assert r2.status_code == 200
    assert r2.json()["status"] == "success"
    assert r2.json()["lines"] > 0

    # 3. Verificar que mappings.json foi salvo no contrato correto
    from backend import config
    mappings_path = config.CONTRACTS_DIR / cid / "mappings.json"
    assert mappings_path.exists(), f"mappings.json não encontrado em {mappings_path}"

    with open(mappings_path, "r", encoding="utf-8") as f:
        saved = json.load(f)

    assert "MAPA" in saved, f"Chave MAPA não encontrada em mappings.json: {saved}"
    assert saved["MAPA"].get("SERIE") == "NOME_COLUNA_DESCONHECIDA", (
        f"Mapeamento incorreto: {saved['MAPA']}"
    )


@pytest.mark.integration
def test_preservation_mapeamento_encapsulado_por_contrato(client: TestClient, mock_auth_admin, fs_isolation, clean_fs):
    """
    Preservation: O mapeamento salvo em um contrato NÃO vaza para outro contrato.
    Garante isolamento multi-tenant.
    """
    mgr = ContractsManager()
    cid_a = "TENANT_A"
    cid_b = "TENANT_B"

    for cid in [cid_a, cid_b]:
        try:
            mgr.create_contract(cid, f"Tenant {cid}", "Isolation test")
        except ValueError:
            pass

    # Salvar mapeamento apenas no contrato A
    mgr.save_mapping(cid_a, "MAPA", {"SERIE": "COLUNA_A"})

    # Verificar que contrato B não tem o mapeamento
    map_b = mgr.get_mappings(cid_b)
    assert "MAPA" not in map_b, (
        f"VAZAMENTO: mapeamento do contrato A apareceu no contrato B: {map_b}"
    )

    # Verificar que contrato A tem o mapeamento correto
    map_a = mgr.get_mappings(cid_a)
    assert map_a.get("MAPA", {}).get("SERIE") == "COLUNA_A"
