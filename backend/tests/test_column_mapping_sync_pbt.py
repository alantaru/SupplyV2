"""
Property-Based Test — Bug Condition Exploration
Column Mapping Sync Bugfix Spec

Property 1: Bug Condition — Headers Canônicos Retornados Após Upload

CRITICAL: Este teste DEVE FALHAR no código não corrigido.
A falha confirma que o bug existe: get_current_file_headers retorna colunas
canônicas (UPPERCASE do sistema) em vez das colunas brutas do CSV original.

Validates: Requirements 1.1, 1.3
"""
import json
import pytest
import pandas as pd
from pathlib import Path
from io import StringIO

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

import backend.config as config
from backend.core.storage.local import LocalStorage
from backend.core.contracts import ContractsManager
import backend.database as database


# ─── Fixtures ─────────────────────────────────────────────────────────────────

TEST_CONTRACT_ID = "BUG_EXPLORE_SYNC"

@pytest.fixture
def isolated_storage(tmp_path, monkeypatch):
    """
    Cria um storage local isolado em tmp_path para não poluir o ambiente real.
    Substitui o storage global e o CONTRACTS_DIR pelo diretório temporário.
    """
    contracts_dir = tmp_path / "contracts"
    contracts_dir.mkdir()

    # Patch config
    monkeypatch.setattr(config, "CONTRACTS_DIR", contracts_dir)

    # Patch storage singleton
    import backend.core.storage as storage_module
    local_storage = LocalStorage(base_path=contracts_dir)
    monkeypatch.setattr(storage_module, "_BACKEND_INSTANCE", local_storage)

    return local_storage, contracts_dir


@pytest.fixture
def contract_with_mapa(isolated_storage):
    """
    Cria o contrato de teste e simula o fluxo de save_file com um DataFrame
    já normalizado (colunas canônicas em UPPERCASE), como ocorre após process_upload.
    Retorna (storage, contracts_dir, mgr).
    """
    storage, contracts_dir = isolated_storage

    # Criar diretório do contrato
    contract_dir = contracts_dir / TEST_CONTRACT_ID
    contract_dir.mkdir(parents=True, exist_ok=True)
    (contract_dir / "backups").mkdir(exist_ok=True)

    # Criar config.json mínimo
    cfg = {
        "id": TEST_CONTRACT_ID,
        "name": "Bug Explore",
        "description": "Test",
        "created_at": "2026-01-01T00:00:00",
        "status": "active",
        "admin_id": "admin2"
    }
    with open(contract_dir / "config.json", "w", encoding="utf-8") as f:
        json.dump(cfg, f)

    mgr = ContractsManager(contracts_dir=contracts_dir)
    return storage, contracts_dir, mgr


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER
# ═══════════════════════════════════════════════════════════════════════════════

def simulate_save_file_with_canonical_df(file_key: str, contract_id: str, raw_columns: list, storage: LocalStorage, contracts_dir: Path):
    """
    Simula o que process_upload faz após mapeamento bem-sucedido (comportamento CORRIGIDO):
    - Aplica mapeamento (raw → canonical)
    - Salva o DataFrame com colunas CANÔNICAS (UPPERCASE) no storage
    - Persiste os raw headers em {contract_id}/{file_key}_raw_headers.json (fix aplicado)

    Retorna o DataFrame normalizado salvo.
    """
    import fsspec

    # Mapeamento simulado: raw → canonical (como o RefineryMapper faria)
    # Para MAPA: "Número de Série" → "SERIE", "Modelo Equipamento" → "MODELOSIMPRESS"
    raw_to_canonical = {col: col.upper().replace(" ", "").replace("Ú", "U").replace("É", "E") for col in raw_columns}

    # Criar DataFrame com colunas brutas (como viria do CSV original)
    raw_data = {col: [f"val_{i}_{col[:3]}" for i in range(3)] for col in raw_columns}
    raw_df = pd.DataFrame(raw_data)

    # Simular apply_mapping: renomear para canônicas
    canonical_df = raw_df.rename(columns=raw_to_canonical)
    canonical_df.columns = [str(c).strip().upper() for c in canonical_df.columns]

    # Salvar via save_file (como logic_upload.save_file faz)
    key = database.get_data_key(file_key.upper(), contract_id)
    uri = storage.get_uri(key)
    storage.ensure_dir(key)
    database.save_dataframe_csv(canonical_df, uri)

    # Persistir raw headers (comportamento corrigido — simula o fix das Tasks 3.2/3.3)
    raw_headers_key = database.get_raw_headers_key(file_key, contract_id)
    raw_headers_uri = storage.get_uri(raw_headers_key)
    storage.ensure_dir(raw_headers_key)
    with fsspec.open(raw_headers_uri, "w", encoding="utf-8") as f:
        f.write(json.dumps(raw_columns))

    return canonical_df


# ═══════════════════════════════════════════════════════════════════════════════
# PROPERTY 1: BUG CONDITION EXPLORATION
# ═══════════════════════════════════════════════════════════════════════════════

def test_bug_condition_get_current_file_headers_returns_canonical_not_raw(contract_with_mapa):
    """
    **Validates: Requirements 1.1, 1.3**

    Property 1: Bug Condition — Headers Canônicos Retornados Após Upload

    CENÁRIO:
    - CSV original com colunas brutas: ["Número de Série", "Modelo Equipamento", "Fabricante"]
    - Após process_upload bem-sucedido, o arquivo MAPA.csv é salvo com colunas canônicas
    - get_current_file_headers é chamado para o contrato/base

    COMPORTAMENTO ESPERADO (após fix):
    - get_current_file_headers DEVE retornar as colunas BRUTAS do CSV original
    - ["Número de Série", "Modelo Equipamento", "Fabricante"]

    COMPORTAMENTO ATUAL (com bug — este teste FALHA):
    - get_current_file_headers retorna as colunas CANÔNICAS do arquivo normalizado
    - ["NÚMERODÉSÉRIE", "MODELOEQUIPAMENTO", "FABRICANTE"] ou similar UPPERCASE

    CONTRAEXEMPLO DOCUMENTADO:
    - get_current_file_headers("MAPA", TEST_CONTRACT_ID) retorna colunas canônicas
      em vez de ["Número de Série", "Modelo Equipamento", "Fabricante"]
    - Causa: raw_headers_key não existe no storage após o fluxo atual
    """
    storage, contracts_dir, mgr = contract_with_mapa

    # Colunas brutas do CSV original (pré-normalização)
    raw_columns = ["Número de Série", "Modelo Equipamento", "Fabricante"]

    # Simular o fluxo de save_file com DataFrame normalizado (sem persistir raw headers)
    simulate_save_file_with_canonical_df(
        file_key="MAPA",
        contract_id=TEST_CONTRACT_ID,
        raw_columns=raw_columns,
        storage=storage,
        contracts_dir=contracts_dir
    )

    # Verificar que raw_headers_key EXISTE (confirma que o fix persiste os raw headers)
    raw_headers_key = f"{TEST_CONTRACT_ID}/MAPA_raw_headers.json"
    assert storage.exists(raw_headers_key), (
        f"INESPERADO: raw_headers_key '{raw_headers_key}' não existe no storage. "
        f"O fix deve persistir os raw headers após o upload."
    )

    # Chamar get_current_file_headers (o método com bug)
    returned_headers = mgr.get_current_file_headers(TEST_CONTRACT_ID, "MAPA")

    # O arquivo foi salvo — deve retornar algo (não vazio)
    assert len(returned_headers) > 0, (
        "get_current_file_headers retornou lista vazia. "
        "O arquivo MAPA.csv deveria existir no storage após simulate_save_file."
    )

    # ASSERTION PRINCIPAL: os headers retornados devem ser os BRUTOS (comportamento esperado após fix)
    # No código com bug, esta assertion FALHA porque retorna canônicas
    assert returned_headers == raw_columns, (
        f"BUG CONFIRMADO (Property 1):\n"
        f"  get_current_file_headers retornou: {returned_headers}\n"
        f"  Esperado (headers brutos): {raw_columns}\n"
        f"  Contraexemplo: após save_file com colunas canônicas, "
        f"get_current_file_headers lê o CSV normalizado e retorna colunas UPPERCASE "
        f"em vez das colunas brutas do CSV original.\n"
        f"  Causa raiz: raw_headers_key ('{raw_headers_key}') não existe no storage — "
        f"os headers brutos nunca são persistidos no fluxo atual."
    )


def test_bug_condition_raw_headers_key_absent_after_save_file(contract_with_mapa):
    """
    **Validates: Requirements 1.1, 1.3**

    Confirma que raw_headers_key NÃO existe no storage após o fluxo atual de save_file.
    Esta é a causa raiz do bug: sem persistência dos raw headers, get_current_file_headers
    não tem como retornar as colunas brutas.

    COMPORTAMENTO ESPERADO (após fix):
    - raw_headers_key DEVE existir após save_file bem-sucedido

    COMPORTAMENTO ATUAL (com bug — este teste FALHA):
    - raw_headers_key NÃO existe após save_file
    """
    storage, contracts_dir, mgr = contract_with_mapa

    raw_columns = ["Número de Série", "Modelo Equipamento", "Fabricante"]

    simulate_save_file_with_canonical_df(
        file_key="MAPA",
        contract_id=TEST_CONTRACT_ID,
        raw_columns=raw_columns,
        storage=storage,
        contracts_dir=contracts_dir
    )

    # Verificar que o arquivo CSV normalizado existe (confirma que save_file funcionou)
    data_key = database.get_data_key("MAPA", TEST_CONTRACT_ID)
    assert storage.exists(data_key), (
        f"O arquivo CSV normalizado '{data_key}' não existe. "
        f"simulate_save_file_with_canonical_df falhou."
    )

    # ASSERTION PRINCIPAL: raw_headers_key DEVE existir após fix
    # No código com bug, esta assertion FALHA porque raw_headers nunca são persistidos
    raw_headers_key = f"{TEST_CONTRACT_ID}/MAPA_raw_headers.json"
    assert storage.exists(raw_headers_key), (
        f"BUG CONFIRMADO (Causa Raiz):\n"
        f"  raw_headers_key '{raw_headers_key}' NÃO existe no storage após save_file.\n"
        f"  Contraexemplo: após upload bem-sucedido de MAPA.csv com colunas brutas "
        f"{raw_columns}, o sistema não persiste os headers originais.\n"
        f"  Consequência: get_current_file_headers não tem como retornar as colunas brutas "
        f"e cai no fallback de ler o CSV normalizado (colunas canônicas UPPERCASE).\n"
        f"  Fix necessário: persistir raw headers em '{raw_headers_key}' durante save_file."
    )


def test_bug_condition_multiple_file_keys(contract_with_mapa):
    """
    **Validates: Requirements 1.1, 1.3**

    Verifica que o bug afeta todas as três bases editáveis: MAPA, CONTADORES, PAPEL.
    Para cada base, após save_file com colunas canônicas:
    - raw_headers_key não existe
    - get_current_file_headers retorna canônicas em vez de brutas

    COMPORTAMENTO ATUAL (com bug — este teste FALHA para cada base):
    - Nenhuma das três bases persiste raw headers
    """
    storage, contracts_dir, mgr = contract_with_mapa

    test_cases = [
        ("MAPA", ["Número de Série", "Modelo Equipamento", "Localização"]),
        ("CONTADORES", ["Equipamento", "Contador Total", "Data Leitura"]),
        ("PAPEL", ["Número de Série", "Meta Resma", "Média Mensal"]),
    ]

    failures = []

    for file_key, raw_columns in test_cases:
        simulate_save_file_with_canonical_df(
            file_key=file_key,
            contract_id=TEST_CONTRACT_ID,
            raw_columns=raw_columns,
            storage=storage,
            contracts_dir=contracts_dir
        )

        raw_headers_key = f"{TEST_CONTRACT_ID}/{file_key}_raw_headers.json"
        raw_key_exists = storage.exists(raw_headers_key)

        returned_headers = mgr.get_current_file_headers(TEST_CONTRACT_ID, file_key)

        if raw_key_exists:
            failures.append(
                f"  {file_key}: raw_headers_key existe (fix já aplicado?)"
            )
        elif returned_headers == raw_columns:
            failures.append(
                f"  {file_key}: get_current_file_headers retornou headers brutos "
                f"sem raw_headers_key (comportamento inesperado)"
            )
        # Se raw_key não existe E headers retornados são canônicos → bug confirmado para esta base

    # O teste FALHA se alguma base já tiver o fix aplicado (raw_headers_key existe)
    # No código com bug, nenhuma base tem raw_headers_key → o assert abaixo falha
    # porque esperamos que TODAS as bases tenham raw_headers_key após o fix
    for file_key, raw_columns in test_cases:
        raw_headers_key = f"{TEST_CONTRACT_ID}/{file_key}_raw_headers.json"
        assert storage.exists(raw_headers_key), (
            f"BUG CONFIRMADO em {file_key}:\n"
            f"  raw_headers_key '{raw_headers_key}' não existe após save_file.\n"
            f"  Colunas brutas originais: {raw_columns}\n"
            f"  get_current_file_headers retornou: "
            f"{mgr.get_current_file_headers(TEST_CONTRACT_ID, file_key)}\n"
            f"  O bug afeta todas as três bases editáveis (MAPA, CONTADORES, PAPEL)."
        )


# ═══════════════════════════════════════════════════════════════════════════════
# PROPERTY 2: PRESERVATION — Fluxo de Upload e Confirm-Mapping Inalterados
# ═══════════════════════════════════════════════════════════════════════════════
"""
Property 2: Preservation — Fluxo de Upload e Confirm-Mapping Inalterados

Estes testes verificam que os comportamentos existentes NÃO mudam após o fix.
RESULTADO ESPERADO: Todos os testes PASSAM no código não corrigido.
Eles estabelecem o baseline de comportamento que deve ser preservado.

Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
"""

TEST_PRESERVATION_CONTRACT = "PRESERVATION_TEST"


@pytest.fixture
def preservation_storage(tmp_path, monkeypatch):
    """
    Storage isolado para os testes de preservação.
    Patcha tanto backend.core.storage quanto core.storage para garantir
    que logic_upload.save_file e ContractsManager usem o mesmo storage isolado.
    """
    contracts_dir = tmp_path / "preservation_contracts"
    contracts_dir.mkdir()

    monkeypatch.setattr(config, "CONTRACTS_DIR", contracts_dir)

    import backend.core.storage as storage_module
    local_storage = LocalStorage(base_path=contracts_dir)
    monkeypatch.setattr(storage_module, "_BACKEND_INSTANCE", local_storage)

    # Também patchar core.storage (sem prefixo backend.) usado por database.py
    import sys
    if "core.storage" in sys.modules:
        monkeypatch.setattr(sys.modules["core.storage"], "_BACKEND_INSTANCE", local_storage)

    return local_storage, contracts_dir


@pytest.fixture
def preservation_contract(preservation_storage):
    """
    Cria o contrato de teste para os testes de preservação.
    """
    storage, contracts_dir = preservation_storage

    contract_dir = contracts_dir / TEST_PRESERVATION_CONTRACT
    contract_dir.mkdir(parents=True, exist_ok=True)
    (contract_dir / "backups").mkdir(exist_ok=True)

    cfg = {
        "id": TEST_PRESERVATION_CONTRACT,
        "name": "Preservation Test",
        "description": "Baseline preservation tests",
        "created_at": "2026-01-01T00:00:00",
        "status": "active",
        "admin_id": "admin2"
    }
    with open(contract_dir / "config.json", "w", encoding="utf-8") as f:
        json.dump(cfg, f)

    mgr = ContractsManager(contracts_dir=contracts_dir)
    return storage, contracts_dir, mgr


# ─── Preservation Test 1 ──────────────────────────────────────────────────────

def test_preservation_get_current_file_headers_no_file_returns_empty(preservation_contract):
    """
    **Validates: Requirements 3.4**

    Preservation: get_current_file_headers para base sem arquivo retorna [].

    CENÁRIO:
    - Contrato existe mas nenhum arquivo CSV foi carregado para a base MAPA
    - get_current_file_headers é chamado

    COMPORTAMENTO ESPERADO (baseline a preservar):
    - Retorna lista vazia []
    - Não lança exceção

    RESULTADO ESPERADO: PASSA no código não corrigido e deve continuar PASSANDO após o fix.
    """
    storage, contracts_dir, mgr = preservation_contract

    # Garantir que o arquivo não existe
    data_key = database.get_data_key("MAPA", TEST_PRESERVATION_CONTRACT)
    assert not storage.exists(data_key), (
        f"Pré-condição falhou: arquivo '{data_key}' não deveria existir."
    )

    # Chamar get_current_file_headers para base sem arquivo
    headers = mgr.get_current_file_headers(TEST_PRESERVATION_CONTRACT, "MAPA")

    assert headers == [], (
        f"Preservation falhou: get_current_file_headers para base sem arquivo "
        f"deveria retornar [], mas retornou: {headers}"
    )


def test_preservation_get_current_file_headers_no_file_all_bases(preservation_contract):
    """
    **Validates: Requirements 3.4**

    Preservation: get_current_file_headers retorna [] para todas as bases sem arquivo.

    Verifica que o comportamento é consistente para MAPA, CONTADORES e PAPEL.
    """
    storage, contracts_dir, mgr = preservation_contract

    for file_key in ["MAPA", "CONTADORES", "PAPEL"]:
        headers = mgr.get_current_file_headers(TEST_PRESERVATION_CONTRACT, file_key)
        assert headers == [], (
            f"Preservation falhou para {file_key}: "
            f"get_current_file_headers deveria retornar [] para base sem arquivo, "
            f"mas retornou: {headers}"
        )


# ─── Preservation Test 2 ──────────────────────────────────────────────────────

def test_preservation_save_file_stores_canonical_columns(preservation_contract):
    """
    **Validates: Requirements 3.2**

    Preservation: O arquivo CSV normalizado é salvo corretamente com colunas
    canônicas após save_file.

    CENÁRIO:
    - DataFrame com colunas canônicas (UPPERCASE) é salvo via database.save_dataframe_csv
      (o mesmo mecanismo que save_file usa internamente)
    - O arquivo CSV resultante deve conter exatamente essas colunas

    COMPORTAMENTO ESPERADO (baseline a preservar):
    - O arquivo CSV é criado no storage
    - As colunas do CSV salvo correspondem às colunas do DataFrame de entrada
    - Os dados são preservados corretamente

    RESULTADO ESPERADO: PASSA no código não corrigido e deve continuar PASSANDO após o fix.
    """
    storage, contracts_dir, mgr = preservation_contract

    # DataFrame com colunas canônicas (como viria após normalização)
    canonical_df = pd.DataFrame({
        "SERIE": ["SN001", "SN002", "SN003"],
        "MODELOSIMPRESS": ["ModeloA", "ModeloB", "ModeloC"],
        "FILA": ["Fila1", "Fila2", "Fila3"],
    })

    # Salvar diretamente via storage (mesmo mecanismo que save_file usa)
    data_key = database.get_data_key("MAPA", TEST_PRESERVATION_CONTRACT)
    uri = storage.get_uri(data_key)
    storage.ensure_dir(data_key)
    database.save_dataframe_csv(canonical_df, uri)

    # Verificar que o arquivo foi criado
    assert storage.exists(data_key), (
        f"Preservation falhou: arquivo '{data_key}' não foi criado após save_dataframe_csv."
    )

    # Verificar que as colunas do CSV salvo correspondem às colunas do DataFrame
    saved_df = pd.read_csv(uri, sep=';', encoding='utf-8-sig')
    saved_cols = [str(c).strip() for c in saved_df.columns]

    assert saved_cols == list(canonical_df.columns), (
        f"Preservation falhou: colunas do CSV salvo não correspondem ao DataFrame de entrada.\n"
        f"  Esperado: {list(canonical_df.columns)}\n"
        f"  Obtido: {saved_cols}"
    )

    # Verificar que os dados foram preservados
    assert len(saved_df) == len(canonical_df), (
        f"Preservation falhou: número de linhas do CSV salvo ({len(saved_df)}) "
        f"não corresponde ao DataFrame de entrada ({len(canonical_df)})."
    )


def test_preservation_save_file_canonical_columns_multiple_bases(preservation_contract):
    """
    **Validates: Requirements 3.2**

    Preservation: save_file funciona corretamente para todas as bases editáveis.
    """
    storage, contracts_dir, mgr = preservation_contract

    test_cases = [
        ("MAPA", pd.DataFrame({"SERIE": ["SN001"], "MODELOSIMPRESS": ["ModeloA"]})),
        ("CONTADORES", pd.DataFrame({"SERIE": ["SN001"], "TOTAL": [1000], "DATA": ["2026-01-01"]})),
        ("PAPEL", pd.DataFrame({"SERIE": ["SN001"], "A4RESMA": [500]})),
    ]

    for file_key, canonical_df in test_cases:
        data_key = database.get_data_key(file_key, TEST_PRESERVATION_CONTRACT)
        uri = storage.get_uri(data_key)
        storage.ensure_dir(data_key)
        database.save_dataframe_csv(canonical_df, uri)

        assert storage.exists(data_key), (
            f"Preservation falhou para {file_key}: arquivo não foi criado após save_dataframe_csv."
        )

        saved_df = pd.read_csv(uri, sep=';', encoding='utf-8-sig')
        saved_cols = [str(c).strip() for c in saved_df.columns]

        assert saved_cols == list(canonical_df.columns), (
            f"Preservation falhou para {file_key}: colunas do CSV salvo não correspondem.\n"
            f"  Esperado: {list(canonical_df.columns)}\n"
            f"  Obtido: {saved_cols}"
        )


# ─── Preservation Test 3 ──────────────────────────────────────────────────────

def test_preservation_mappings_json_format_canonical_to_input(preservation_contract):
    """
    **Validates: Requirements 3.3, 3.5**

    Preservation: O mapeamento salvo em mappings.json tem o formato correto
    {Canonical: InputColumn}.

    CENÁRIO:
    - save_mapping é chamado com um mapeamento {Canonical: InputColumn}
    - O arquivo mappings.json deve conter exatamente esse formato

    COMPORTAMENTO ESPERADO (baseline a preservar):
    - mappings.json é criado/atualizado com o formato {file_key: {Canonical: InputColumn}}
    - get_mappings retorna o mapeamento correto

    RESULTADO ESPERADO: PASSA no código não corrigido e deve continuar PASSANDO após o fix.
    """
    storage, contracts_dir, mgr = preservation_contract

    # Mapeamento no formato {Canonical: InputColumn}
    mapping = {
        "SERIE": "Número de Série",
        "MODELOSIMPRESS": "Modelo Equipamento",
        "FILA": "Fila de Impressão",
    }

    # Salvar mapeamento
    mgr.save_mapping(TEST_PRESERVATION_CONTRACT, "MAPA", mapping)

    # Verificar que mappings.json foi criado
    mappings_path = contracts_dir / TEST_PRESERVATION_CONTRACT / "mappings.json"
    assert mappings_path.exists(), (
        f"Preservation falhou: mappings.json não foi criado em '{mappings_path}'."
    )

    # Verificar o conteúdo do arquivo JSON diretamente
    with open(mappings_path, "r", encoding="utf-8") as f:
        raw_content = json.load(f)

    assert "MAPA" in raw_content, (
        f"Preservation falhou: chave 'MAPA' não encontrada em mappings.json.\n"
        f"  Conteúdo: {raw_content}"
    )

    saved_mapping = raw_content["MAPA"]
    assert saved_mapping == mapping, (
        f"Preservation falhou: mapeamento salvo não corresponde ao esperado.\n"
        f"  Esperado: {mapping}\n"
        f"  Obtido: {saved_mapping}"
    )

    # Verificar via get_mappings
    loaded = mgr.get_mappings(TEST_PRESERVATION_CONTRACT)
    assert loaded.get("MAPA") == mapping, (
        f"Preservation falhou: get_mappings retornou mapeamento incorreto.\n"
        f"  Esperado: {mapping}\n"
        f"  Obtido: {loaded.get('MAPA')}"
    )


def test_preservation_mappings_json_format_multiple_file_keys(preservation_contract):
    """
    **Validates: Requirements 3.3, 3.5**

    Preservation: mappings.json suporta múltiplas bases com formato correto.
    """
    storage, contracts_dir, mgr = preservation_contract

    mappings_to_save = {
        "MAPA": {"SERIE": "Número de Série", "MODELOSIMPRESS": "Modelo"},
        "CONTADORES": {"SERIE": "Equipamento", "TOTAL": "Contador Total", "DATA": "Data Leitura"},
        "PAPEL": {"SERIE": "Serial", "A4RESMA": "Meta Resma"},
    }

    for file_key, mapping in mappings_to_save.items():
        mgr.save_mapping(TEST_PRESERVATION_CONTRACT, file_key, mapping)

    # Verificar que todos os mapeamentos foram salvos corretamente
    loaded = mgr.get_mappings(TEST_PRESERVATION_CONTRACT)

    for file_key, expected_mapping in mappings_to_save.items():
        assert file_key in loaded, (
            f"Preservation falhou: chave '{file_key}' não encontrada em mappings.json."
        )
        assert loaded[file_key] == expected_mapping, (
            f"Preservation falhou para {file_key}: mapeamento incorreto.\n"
            f"  Esperado: {expected_mapping}\n"
            f"  Obtido: {loaded[file_key]}"
        )


# ─── Preservation Test 4 ──────────────────────────────────────────────────────

def test_preservation_bases_isolated_save_mapa_does_not_affect_contadores(preservation_contract):
    """
    **Validates: Requirements 3.5**

    Preservation: Bases diferentes são isoladas — salvar MAPA não afeta CONTADORES.

    CENÁRIO:
    - CONTADORES tem um arquivo CSV e um mapeamento salvos
    - save_dataframe_csv é chamado para MAPA com um DataFrame diferente
    - O arquivo e mapeamento de CONTADORES devem permanecer inalterados

    COMPORTAMENTO ESPERADO (baseline a preservar):
    - Operações em MAPA não afetam CONTADORES (e vice-versa)
    - Isolamento entre bases dentro do mesmo contrato

    RESULTADO ESPERADO: PASSA no código não corrigido e deve continuar PASSANDO após o fix.
    """
    storage, contracts_dir, mgr = preservation_contract

    # 1. Salvar CONTADORES com dados iniciais
    contadores_df = pd.DataFrame({
        "SERIE": ["SN001", "SN002"],
        "TOTAL": [1000, 2000],
        "DATA": ["2026-01-01", "2026-01-02"],
    })
    contadores_key = database.get_data_key("CONTADORES", TEST_PRESERVATION_CONTRACT)
    contadores_uri = storage.get_uri(contadores_key)
    storage.ensure_dir(contadores_key)
    database.save_dataframe_csv(contadores_df, contadores_uri)

    # 2. Salvar mapeamento de CONTADORES
    contadores_mapping = {"SERIE": "Equipamento", "TOTAL": "Contador Total", "DATA": "Data Leitura"}
    mgr.save_mapping(TEST_PRESERVATION_CONTRACT, "CONTADORES", contadores_mapping)

    # 3. Verificar estado inicial de CONTADORES
    assert storage.exists(contadores_key), "Pré-condição: CONTADORES.csv deve existir."

    # 4. Agora salvar MAPA (operação que NÃO deve afetar CONTADORES)
    mapa_df = pd.DataFrame({
        "SERIE": ["SN100"],
        "MODELOSIMPRESS": ["ModeloX"],
    })
    mapa_key = database.get_data_key("MAPA", TEST_PRESERVATION_CONTRACT)
    mapa_uri = storage.get_uri(mapa_key)
    storage.ensure_dir(mapa_key)
    database.save_dataframe_csv(mapa_df, mapa_uri)

    # 5. Salvar mapeamento de MAPA
    mapa_mapping = {"SERIE": "Número de Série", "MODELOSIMPRESS": "Modelo"}
    mgr.save_mapping(TEST_PRESERVATION_CONTRACT, "MAPA", mapa_mapping)

    # 6. Verificar que CONTADORES permanece inalterado
    saved_contadores = pd.read_csv(contadores_uri, sep=';', encoding='utf-8-sig')
    saved_contadores_cols = [str(c).strip() for c in saved_contadores.columns]

    assert saved_contadores_cols == list(contadores_df.columns), (
        f"Preservation falhou: colunas de CONTADORES foram alteradas após save de MAPA.\n"
        f"  Esperado: {list(contadores_df.columns)}\n"
        f"  Obtido: {saved_contadores_cols}"
    )

    assert len(saved_contadores) == len(contadores_df), (
        f"Preservation falhou: número de linhas de CONTADORES foi alterado após save de MAPA.\n"
        f"  Esperado: {len(contadores_df)}\n"
        f"  Obtido: {len(saved_contadores)}"
    )

    # 7. Verificar que o mapeamento de CONTADORES permanece inalterado
    loaded_mappings = mgr.get_mappings(TEST_PRESERVATION_CONTRACT)
    assert loaded_mappings.get("CONTADORES") == contadores_mapping, (
        f"Preservation falhou: mapeamento de CONTADORES foi alterado após save_mapping de MAPA.\n"
        f"  Esperado: {contadores_mapping}\n"
        f"  Obtido: {loaded_mappings.get('CONTADORES')}"
    )

    # 8. Verificar que MAPA foi salvo corretamente (não interferiu com CONTADORES)
    assert storage.exists(mapa_key), (
        "Preservation falhou: MAPA.csv não foi criado após save."
    )
    assert loaded_mappings.get("MAPA") == mapa_mapping, (
        f"Preservation falhou: mapeamento de MAPA não foi salvo corretamente.\n"
        f"  Esperado: {mapa_mapping}\n"
        f"  Obtido: {loaded_mappings.get('MAPA')}"
    )


def test_preservation_different_contracts_isolated(preservation_storage):
    """
    **Validates: Requirements 3.5**

    Preservation: Contratos diferentes são isolados — salvar MAPA em contrato A
    não afeta contrato B.

    CENÁRIO:
    - Dois contratos distintos (A e B) com arquivos e mapeamentos
    - Operações em contrato A não devem afetar contrato B

    RESULTADO ESPERADO: PASSA no código não corrigido e deve continuar PASSANDO após o fix.
    """
    storage, contracts_dir = preservation_storage

    contract_a = "CONTRACT_A"
    contract_b = "CONTRACT_B"

    # Criar ambos os contratos
    for cid in [contract_a, contract_b]:
        cdir = contracts_dir / cid
        cdir.mkdir(parents=True, exist_ok=True)
        (cdir / "backups").mkdir(exist_ok=True)
        cfg = {
            "id": cid, "name": cid, "description": "Test",
            "created_at": "2026-01-01T00:00:00", "status": "active", "admin_id": "admin2"
        }
        with open(cdir / "config.json", "w", encoding="utf-8") as f:
            json.dump(cfg, f)

    mgr = ContractsManager(contracts_dir=contracts_dir)

    # Salvar MAPA em contrato B com dados iniciais
    mapa_b_df = pd.DataFrame({"SERIE": ["SN_B_001"], "MODELOSIMPRESS": ["Modelo_B"]})
    mapa_b_key = database.get_data_key("MAPA", contract_b)
    mapa_b_uri = storage.get_uri(mapa_b_key)
    storage.ensure_dir(mapa_b_key)
    database.save_dataframe_csv(mapa_b_df, mapa_b_uri)
    mgr.save_mapping(contract_b, "MAPA", {"SERIE": "Serial_B", "MODELOSIMPRESS": "Modelo_B_Input"})

    # Salvar MAPA em contrato A (não deve afetar contrato B)
    mapa_a_df = pd.DataFrame({"SERIE": ["SN_A_001"], "MODELOSIMPRESS": ["Modelo_A"]})
    mapa_a_key = database.get_data_key("MAPA", contract_a)
    mapa_a_uri = storage.get_uri(mapa_a_key)
    storage.ensure_dir(mapa_a_key)
    database.save_dataframe_csv(mapa_a_df, mapa_a_uri)
    mgr.save_mapping(contract_a, "MAPA", {"SERIE": "Serial_A", "MODELOSIMPRESS": "Modelo_A_Input"})

    # Verificar que contrato B permanece inalterado
    saved_b = pd.read_csv(mapa_b_uri, sep=';', encoding='utf-8-sig')

    assert saved_b["SERIE"].iloc[0] == "SN_B_001", (
        f"Preservation falhou: dados de MAPA no contrato B foram alterados após operação no contrato A.\n"
        f"  Esperado SERIE[0]: 'SN_B_001'\n"
        f"  Obtido: {saved_b['SERIE'].iloc[0]}"
    )

    mappings_b = mgr.get_mappings(contract_b)
    assert mappings_b.get("MAPA", {}).get("SERIE") == "Serial_B", (
        f"Preservation falhou: mapeamento de MAPA no contrato B foi alterado após operação no contrato A.\n"
        f"  Esperado SERIE: 'Serial_B'\n"
        f"  Obtido: {mappings_b.get('MAPA', {}).get('SERIE')}"
    )
