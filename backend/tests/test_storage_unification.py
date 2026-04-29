"""
Bug Condition Exploration Tests — Storage Unification Bugfix Spec

Property 1: Bug Condition — Metadados de Contrato e Rotas Gravados no Filesystem Local

CRITICAL: Estes testes DEVEM FALHAR no código não corrigido.
A falha confirma que o bug existe: ContractsManager e RouteService usam o filesystem
local em vez de database.get_storage() para arquivos de metadados.

Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.8
"""
import json
import pytest
from pathlib import Path

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

import backend.config as config
from backend.core.storage.local import LocalStorage
from backend.core.contracts import ContractsManager
from backend.core.services.route import RouteService
import backend.database as database


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def isolated_storage(tmp_path, monkeypatch):
    """
    Cria um storage local isolado em tmp_path/storage para não poluir o ambiente real.
    O contracts_dir do ContractsManager aponta para tmp_path/contracts (diretório DIFERENTE).
    Isso permite verificar se as operações usam o storage ou o filesystem local.
    """
    # Storage base: diretório SEPARADO do contracts_dir
    storage_base = tmp_path / "storage"
    storage_base.mkdir()

    # Contracts dir: diretório LOCAL usado pelo ContractsManager (filesystem local)
    contracts_dir = tmp_path / "contracts"
    contracts_dir.mkdir()

    # Patch config.CONTRACTS_DIR para o contracts_dir local
    monkeypatch.setattr(config, "CONTRACTS_DIR", contracts_dir)

    # Patch storage singleton para apontar para storage_base (diretório DIFERENTE)
    import backend.core.storage as storage_module
    local_storage = LocalStorage(base_path=storage_base)
    monkeypatch.setattr(storage_module, "_BACKEND_INSTANCE", local_storage)

    return local_storage, contracts_dir, storage_base


# ═══════════════════════════════════════════════════════════════════════════════
# CASE 1 — create_contract grava localmente, não no storage
# ═══════════════════════════════════════════════════════════════════════════════

def test_bug_create_contract_writes_to_local_not_storage(isolated_storage, tmp_path):
    """
    **Validates: Requirements 1.1**

    Bug Condition: create_contract grava config.json no filesystem local,
    não no storage configurado.

    CENÁRIO:
    - ContractsManager usa contracts_dir = tmp_path/contracts (filesystem local)
    - Storage mockado aponta para tmp_path/storage (diretório SEPARADO)
    - create_contract é chamado

    COMPORTAMENTO ESPERADO (após fix):
    - storage.exists(f"{contract_id}/config.json") retorna True
    - O config.json deve estar no storage, não apenas no filesystem local

    COMPORTAMENTO ATUAL (com bug — este teste FALHA):
    - storage.exists(f"{contract_id}/config.json") retorna False
    - O config.json foi gravado no filesystem local (contracts_dir), não no storage

    CONTRAEXEMPLO DOCUMENTADO:
    - create_contract("TEST_CREATE_BUG", ...) cria contracts_dir/TEST_CREATE_BUG/config.json
    - storage.exists("TEST_CREATE_BUG/config.json") retorna False
    - Causa: create_contract usa open(target_dir / "config.json", "w") em vez de
      fsspec.open(storage.get_uri(key), "w")
    """
    storage, contracts_dir, storage_base = isolated_storage
    contract_id = "TEST_CREATE_BUG"

    mgr = ContractsManager(contracts_dir=contracts_dir)
    mgr.create_contract(contract_id, "Test Contract", "Bug exploration")

    # ASSERTION PRINCIPAL: config.json deve estar no storage (não apenas no filesystem local)
    # No código com bug, esta assertion FALHA porque create_contract gravou localmente
    assert storage.exists(f"{contract_id}/config.json"), (
        f"BUG CONFIRMADO (Case 1 — create_contract):\n"
        f"  storage.exists('{contract_id}/config.json') retornou False.\n"
        f"  Contraexemplo: create_contract gravou config.json no filesystem local "
        f"({contracts_dir / contract_id / 'config.json'}) em vez de usar o storage "
        f"configurado ({storage_base / contract_id / 'config.json'}).\n"
        f"  Causa raiz: create_contract usa open(target_dir / 'config.json', 'w') "
        f"em vez de fsspec.open(storage.get_uri(key), 'w')."
    )


# ═══════════════════════════════════════════════════════════════════════════════
# CASE 2 — get_contract não lê do storage
# ═══════════════════════════════════════════════════════════════════════════════

def test_bug_get_contract_does_not_read_from_storage(isolated_storage):
    """
    **Validates: Requirements 1.3**

    Bug Condition: get_contract não lê config.json do storage configurado.
    Retorna None para contratos cujos metadados existem apenas no storage.

    CENÁRIO:
    - config.json é escrito DIRETAMENTE no storage mockado (storage_base)
    - ContractsManager usa contracts_dir DIFERENTE (sem o config.json)
    - get_contract é chamado

    COMPORTAMENTO ESPERADO (após fix):
    - get_contract retorna os metadados do contrato lendo do storage

    COMPORTAMENTO ATUAL (com bug — este teste FALHA):
    - get_contract retorna None porque lê apenas do filesystem local (contracts_dir)
    - O config.json no storage é ignorado

    CONTRAEXEMPLO DOCUMENTADO:
    - config.json existe em storage_base/TEST_GET_BUG/config.json
    - contracts_dir/TEST_GET_BUG/config.json NÃO existe
    - get_contract("TEST_GET_BUG") retorna None
    - Causa: get_contract usa open(self.base_dir / contract_id / "config.json", "r")
      em vez de fsspec.open(storage.get_uri(key), "r")
    """
    storage, contracts_dir, storage_base = isolated_storage
    contract_id = "TEST_GET_BUG"

    # Escrever config.json DIRETAMENTE no storage (não no contracts_dir local)
    config_data = {
        "id": contract_id,
        "name": "Storage Contract",
        "description": "Exists only in storage",
        "created_at": "2026-01-01T00:00:00",
        "status": "active",
        "admin_id": "admin2"
    }
    storage.ensure_dir(f"{contract_id}/config.json")
    config_path = storage_base / contract_id / "config.json"
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config_data, f)

    # Confirmar que o config.json está no storage mas NÃO no contracts_dir local
    assert storage.exists(f"{contract_id}/config.json"), "Pré-condição: config.json deve existir no storage."
    assert not (contracts_dir / contract_id / "config.json").exists(), (
        "Pré-condição: config.json NÃO deve existir no contracts_dir local."
    )

    # Instanciar ContractsManager com contracts_dir DIFERENTE do storage
    mgr = ContractsManager(contracts_dir=contracts_dir)
    result = mgr.get_contract(contract_id)

    # ASSERTION PRINCIPAL: get_contract deve retornar os metadados do storage
    # No código com bug, esta assertion FALHA porque get_contract retorna None
    assert result is not None, (
        f"BUG CONFIRMADO (Case 2 — get_contract):\n"
        f"  get_contract('{contract_id}') retornou None.\n"
        f"  Contraexemplo: config.json existe no storage ({storage_base / contract_id / 'config.json'}) "
        f"mas get_contract retornou None porque lê apenas do filesystem local "
        f"({contracts_dir / contract_id / 'config.json'}).\n"
        f"  Causa raiz: get_contract usa open(self.base_dir / contract_id / 'config.json', 'r') "
        f"em vez de fsspec.open(storage.get_uri(key), 'r')."
    )
    assert result["id"] == contract_id, (
        f"get_contract retornou dados incorretos: {result}"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# CASE 3 — list_contracts retorna vazio sem filesystem
# ═══════════════════════════════════════════════════════════════════════════════

def test_bug_list_contracts_returns_empty_without_filesystem(isolated_storage):
    """
    **Validates: Requirements 1.2**

    Bug Condition: list_contracts depende do filesystem local.
    Retorna [] quando contracts_dir está vazio, mesmo que contratos existam no storage.

    CENÁRIO:
    - Contratos existem no storage (config.json em storage_base)
    - contracts_dir está vazio (sem subdiretórios de contratos)
    - list_contracts é chamado

    COMPORTAMENTO ESPERADO (após fix):
    - list_contracts retorna os contratos lendo do storage

    COMPORTAMENTO ATUAL (com bug — este teste FALHA):
    - list_contracts retorna [] porque itera sobre contracts_dir (vazio)
    - Os contratos no storage são ignorados

    CONTRAEXEMPLO DOCUMENTADO:
    - storage contém TEST_LIST_BUG_1/config.json e TEST_LIST_BUG_2/config.json
    - contracts_dir está vazio (sem subdiretórios)
    - list_contracts() retorna []
    - Causa: list_contracts usa self.base_dir.iterdir() em vez de storage.list_prefixes()
    """
    storage, contracts_dir, storage_base = isolated_storage

    # Escrever config.json de dois contratos DIRETAMENTE no storage
    for contract_id in ["TEST_LIST_BUG_1", "TEST_LIST_BUG_2"]:
        config_data = {
            "id": contract_id,
            "name": f"Contract {contract_id}",
            "description": "Exists only in storage",
            "created_at": "2026-01-01T00:00:00",
            "status": "active",
            "admin_id": "admin2"
        }
        storage.ensure_dir(f"{contract_id}/config.json")
        config_path = storage_base / contract_id / "config.json"
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config_data, f)

    # Confirmar que contracts_dir está vazio (sem subdiretórios de contratos)
    local_subdirs = [d for d in contracts_dir.iterdir() if d.is_dir()]
    assert len(local_subdirs) == 0, (
        f"Pré-condição: contracts_dir deve estar vazio, mas contém: {local_subdirs}"
    )

    # Instanciar ContractsManager com contracts_dir vazio
    mgr = ContractsManager(contracts_dir=contracts_dir)
    result = mgr.list_contracts()

    # ASSERTION PRINCIPAL: list_contracts deve retornar os contratos do storage
    # No código com bug, esta assertion FALHA porque list_contracts retorna []
    assert len(result) >= 2, (
        f"BUG CONFIRMADO (Case 3 — list_contracts):\n"
        f"  list_contracts() retornou {result} (esperado: lista com >= 2 contratos).\n"
        f"  Contraexemplo: contratos TEST_LIST_BUG_1 e TEST_LIST_BUG_2 existem no storage "
        f"({storage_base}) mas list_contracts retornou lista vazia porque itera sobre "
        f"contracts_dir ({contracts_dir}) que está vazio.\n"
        f"  Causa raiz: list_contracts usa self.base_dir.iterdir() em vez de "
        f"storage.list_prefixes() para enumerar contratos."
    )
    contract_ids = [c["id"] for c in result]
    assert "TEST_LIST_BUG_1" in contract_ids, (
        f"TEST_LIST_BUG_1 não encontrado em list_contracts: {result}"
    )
    assert "TEST_LIST_BUG_2" in contract_ids, (
        f"TEST_LIST_BUG_2 não encontrado em list_contracts: {result}"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# CASE 4 — RouteService.save_route grava localmente
# ═══════════════════════════════════════════════════════════════════════════════

def test_bug_route_service_save_route_writes_to_local_not_storage(isolated_storage):
    """
    **Validates: Requirements 1.4**

    Bug Condition: RouteService.save_route grava routes.json no filesystem local,
    não no storage configurado.

    CENÁRIO:
    - config.CONTRACTS_DIR aponta para contracts_dir (filesystem local)
    - Storage mockado aponta para storage_base (diretório SEPARADO)
    - RouteService(contract_id).save_route(...) é chamado

    COMPORTAMENTO ESPERADO (após fix):
    - storage.exists(f"{contract_id}/routes.json") retorna True
    - routes.json deve estar no storage, não apenas no filesystem local

    COMPORTAMENTO ATUAL (com bug — este teste FALHA):
    - storage.exists(f"{contract_id}/routes.json") retorna False
    - routes.json foi gravado no filesystem local (contracts_dir), não no storage

    CONTRAEXEMPLO DOCUMENTADO:
    - RouteService("TEST_ROUTE_BUG").save_route("TestRoute", ["SN001"]) cria
      contracts_dir/TEST_ROUTE_BUG/routes.json
    - storage.exists("TEST_ROUTE_BUG/routes.json") retorna False
    - Causa: RouteService usa open(self._get_routes_file(), 'w') onde _get_routes_file()
      retorna config.CONTRACTS_DIR / contract_id / "routes.json" (Path local)
      em vez de fsspec.open(storage.get_uri(key), 'w')
    """
    storage, contracts_dir, storage_base = isolated_storage
    contract_id = "TEST_ROUTE_BUG"

    # Criar o diretório do contrato no filesystem local para que save_route não falhe
    # por ausência do diretório pai (o bug é que ele grava localmente, não no storage)
    contract_local_dir = contracts_dir / contract_id
    contract_local_dir.mkdir(parents=True, exist_ok=True)

    # Chamar save_route
    svc = RouteService(contract_id)
    svc.save_route("TestRoute", ["SN001"])

    # ASSERTION PRINCIPAL: routes.json deve estar no storage
    # No código com bug, esta assertion FALHA porque save_route gravou localmente
    assert storage.exists(f"{contract_id}/routes.json"), (
        f"BUG CONFIRMADO (Case 4 — RouteService.save_route):\n"
        f"  storage.exists('{contract_id}/routes.json') retornou False.\n"
        f"  Contraexemplo: save_route gravou routes.json no filesystem local "
        f"({contracts_dir / contract_id / 'routes.json'}) em vez de usar o storage "
        f"configurado ({storage_base / contract_id / 'routes.json'}).\n"
        f"  Causa raiz: RouteService._get_routes_file() retorna "
        f"config.CONTRACTS_DIR / contract_id / 'routes.json' (Path local) "
        f"em vez de usar storage.get_uri(f'{contract_id}/routes.json')."
    )


# ═══════════════════════════════════════════════════════════════════════════════
# PRESERVATION TESTS — Task 2
# These tests MUST PASS on unfixed code — they establish baseline behavior.
# Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def same_dir_storage(tmp_path, monkeypatch):
    """
    Fixture where both contracts_dir and storage base point to the SAME directory.
    This simulates STORAGE_TYPE=local where LocalStorage base == CONTRACTS_DIR.
    """
    shared_dir = tmp_path / "contracts"
    shared_dir.mkdir()

    monkeypatch.setattr(config, "CONTRACTS_DIR", shared_dir)

    import backend.core.storage as storage_module
    local_storage = LocalStorage(base_path=shared_dir)
    monkeypatch.setattr(storage_module, "_BACKEND_INSTANCE", local_storage)

    return local_storage, shared_dir


# ═══════════════════════════════════════════════════════════════════════════════
# PRESERVATION TEST 1 — get_mappings reads from storage (already works)
# ═══════════════════════════════════════════════════════════════════════════════

def test_preservation_get_mappings_via_storage(isolated_storage):
    """
    **Validates: Requirements 3.1**

    Preservation: get_mappings already reads from storage correctly.
    This behavior must not regress after the fix.

    SCENARIO:
    - Write mappings.json directly into mock storage
    - Call ContractsManager.get_mappings(contract_id)
    - Assert it returns the correct mappings
    """
    storage, contracts_dir, storage_base = isolated_storage
    contract_id = "TEST_PRES_MAPPINGS"

    mappings_data = {
        "MAPA": {"SERIE": "Número de Série", "MODELO": "Modelo"}
    }

    # Write mappings.json directly into storage
    storage.ensure_dir(f"{contract_id}/mappings.json")
    mappings_path = storage_base / contract_id / "mappings.json"
    with open(mappings_path, "w", encoding="utf-8") as f:
        json.dump(mappings_data, f)

    # Confirm it exists in storage
    assert storage.exists(f"{contract_id}/mappings.json"), (
        "Pré-condição: mappings.json deve existir no storage."
    )

    mgr = ContractsManager(contracts_dir=contracts_dir)
    result = mgr.get_mappings(contract_id)

    assert result == mappings_data, (
        f"REGRESSÃO DETECTADA: get_mappings retornou {result}, esperado {mappings_data}."
    )


# ═══════════════════════════════════════════════════════════════════════════════
# PRESERVATION TEST 2 — save_mapping writes to storage (already works)
# ═══════════════════════════════════════════════════════════════════════════════

def test_preservation_save_mapping_via_storage(isolated_storage):
    """
    **Validates: Requirements 3.1**

    Preservation: save_mapping already writes to storage correctly.
    This behavior must not regress after the fix.

    SCENARIO:
    - Call ContractsManager.save_mapping(contract_id, "MAPA", {...})
    - Assert storage.exists(f"{contract_id}/mappings.json") is True
    """
    storage, contracts_dir, storage_base = isolated_storage
    contract_id = "TEST_PRES_SAVE_MAPPING"

    mgr = ContractsManager(contracts_dir=contracts_dir)
    mgr.save_mapping(contract_id, "MAPA", {"SERIE": "Número de Série"})

    assert storage.exists(f"{contract_id}/mappings.json"), (
        f"REGRESSÃO DETECTADA: save_mapping não gravou mappings.json no storage. "
        f"storage.exists('{contract_id}/mappings.json') retornou False."
    )

    # Also verify the content is correct
    import fsspec
    uri = storage.get_uri(f"{contract_id}/mappings.json")
    with fsspec.open(uri, "r", encoding="utf-8") as f:
        saved = json.load(f)

    assert "MAPA" in saved, f"REGRESSÃO: chave 'MAPA' não encontrada em {saved}"
    assert saved["MAPA"] == {"SERIE": "Número de Série"}, (
        f"REGRESSÃO: conteúdo incorreto: {saved['MAPA']}"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# PRESERVATION TEST 3 — get_current_file_headers reads from storage (already works)
# ═══════════════════════════════════════════════════════════════════════════════

def test_preservation_get_current_file_headers(isolated_storage):
    """
    **Validates: Requirements 3.4**

    Preservation: get_current_file_headers already reads from storage correctly.
    This behavior must not regress after the fix.

    SCENARIO:
    - Write MAPA_raw_headers.json directly into mock storage with ["Número de Série", "Modelo"]
    - Call ContractsManager.get_current_file_headers(contract_id, "MAPA")
    - Assert it returns ["Número de Série", "Modelo"]
    """
    storage, contracts_dir, storage_base = isolated_storage
    contract_id = "TEST_PRES_HEADERS"

    raw_headers = ["Número de Série", "Modelo"]
    raw_key = f"{contract_id}/MAPA_raw_headers.json"

    # Write raw headers JSON directly into storage
    storage.ensure_dir(raw_key)
    raw_path = storage_base / contract_id / "MAPA_raw_headers.json"
    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump(raw_headers, f)

    assert storage.exists(raw_key), "Pré-condição: MAPA_raw_headers.json deve existir no storage."

    mgr = ContractsManager(contracts_dir=contracts_dir)
    result = mgr.get_current_file_headers(contract_id, "MAPA")

    assert result == raw_headers, (
        f"REGRESSÃO DETECTADA: get_current_file_headers retornou {result}, "
        f"esperado {raw_headers}."
    )


# ═══════════════════════════════════════════════════════════════════════════════
# PRESERVATION TEST 4 — STORAGE_TYPE=local: all CRUD methods work normally
# ═══════════════════════════════════════════════════════════════════════════════

def test_preservation_local_storage_type_crud(same_dir_storage):
    """
    **Validates: Requirements 3.3**

    Preservation: When STORAGE_TYPE=local, all CRUD methods continue to work.
    Both contracts_dir and storage base point to the same directory (simulating local mode).

    SCENARIO:
    - Use ContractsManager with contracts_dir pointing to a temp directory
    - Use LocalStorage pointing to the SAME temp directory
    - Call create_contract, get_contract, list_contracts, update_contract, delete_contract
    - Assert all operations work correctly
    """
    storage, shared_dir = same_dir_storage
    contract_id = "TEST_PRES_LOCAL_CRUD"

    mgr = ContractsManager(contracts_dir=shared_dir)

    # --- create_contract ---
    created = mgr.create_contract(contract_id, "Local Contract", "Testing local CRUD")
    assert created["id"] == contract_id, f"create_contract retornou id incorreto: {created}"
    assert created["name"] == "Local Contract"

    # --- get_contract ---
    fetched = mgr.get_contract(contract_id)
    assert fetched is not None, "get_contract retornou None após create_contract."
    assert fetched["id"] == contract_id
    assert fetched["name"] == "Local Contract"

    # --- list_contracts ---
    contracts = mgr.list_contracts()
    ids = [c["id"] for c in contracts]
    assert contract_id in ids, (
        f"list_contracts não retornou o contrato criado. Retornou: {ids}"
    )

    # --- update_contract ---
    updated = mgr.update_contract(contract_id, {"name": "Updated Local Contract"})
    assert updated["name"] == "Updated Local Contract", (
        f"update_contract não atualizou o nome. Retornou: {updated}"
    )

    # Verify update persisted
    re_fetched = mgr.get_contract(contract_id)
    assert re_fetched["name"] == "Updated Local Contract", (
        f"Atualização não persistiu. get_contract retornou: {re_fetched}"
    )

    # --- delete_contract ---
    mgr.delete_contract(contract_id)
    deleted = mgr.get_contract(contract_id)
    assert deleted is None, (
        f"delete_contract não removeu o contrato. get_contract retornou: {deleted}"
    )

    # Verify it's gone from list
    contracts_after = mgr.list_contracts()
    ids_after = [c["id"] for c in contracts_after]
    assert contract_id not in ids_after, (
        f"Contrato ainda aparece em list_contracts após delete: {ids_after}"
    )
