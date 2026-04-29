"""
Smart Stock System — Property-Based Tests (PBT)

Metodologia PBT-first: estes testes são escritos ANTES das implementações.
Eles devem FALHAR inicialmente (ImportError ou AssertionError) e PASSAR após a implementação.

Feature: smart-stock-system
"""
import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
from datetime import datetime

# ─── Imports do sistema ───────────────────────────────────────────────────────
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.core.services.stock import StockService
from backend.core.services.protocol import ProtocolService

# ─── Hypothesis ───────────────────────────────────────────────────────────────
try:
    from hypothesis import given, settings, assume, HealthCheck
    from hypothesis import strategies as st
    HAS_HYPOTHESIS = True
except ImportError:
    HAS_HYPOTHESIS = False
    HealthCheck = None
    # Stubs para que o módulo carregue sem hypothesis
    def given(*args, **kwargs):
        return lambda f: pytest.mark.skip(reason="hypothesis not installed")(f)
    def settings(*args, **kwargs):
        return lambda f: f
    def assume(cond):
        pass
    class st:
        @staticmethod
        def sampled_from(seq): return None
        @staticmethod
        def integers(**kwargs): return None
        @staticmethod
        def text(**kwargs): return None
        @staticmethod
        def lists(*args, **kwargs): return None
        @staticmethod
        def characters(**kwargs): return None

VALID_CATEGORIAS = ["papel", "toner", "customizado"]
VALID_TIPO_TONER = ["BK", "CY", "MG", "YW"]
TONER_MAP = {
    "TonerPreto": "BK",
    "TonerCiano": "CY",
    "TonerAmarelo": "YW",
    "TonerMagenta": "MG",
}

# ─── Fixtures ─────────────────────────────────────────────────────────────────

def _make_empty_estoque():
    return pd.DataFrame(columns=[
        "TipoModelo", "EstoqueAtual", "UltimaAlteracao",
        "Cor", "Empresa", "Codigo", "Categoria", "ModeloEquipamento", "TipoToner"
    ])

def _make_empty_lancamentos():
    return pd.DataFrame(columns=[
        "TipoMaterial", "Modelo", "TipoLancamento", "Quantidade",
        "ProtocoloOUPedido", "FilaImpressao", "Colaborador",
        "DataLancamento", "Empresa", "Obs"
    ])

@pytest.fixture
def stock_svc():
    return StockService(contract_id="TEST_PBT")

@pytest.fixture
def protocol_svc():
    return ProtocolService(contract_id="TEST_PBT")


# ═══════════════════════════════════════════════════════════════════════════════
# PROPERTY 1 — Categoria sempre válida
# Feature: smart-stock-system, Property 1: Categoria sempre válida
# Validates: Requirements 1.1
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.skipif(not HAS_HYPOTHESIS, reason="hypothesis not installed")
@given(categoria=st.sampled_from(VALID_CATEGORIAS))
@settings(max_examples=30, suppress_health_check=[HealthCheck.function_scoped_fixture] if HAS_HYPOTHESIS else [])
def test_p1_categoria_sempre_valida(stock_svc, categoria):
    """
    Para qualquer categoria válida, o item criado deve ter Categoria persistida
    pertencente ao conjunto {"papel", "toner", "customizado"}.
    """
    if categoria == "toner":
        payload = {
            "categoria": "toner",
            "modelo_equipamento": "SLM4020",
            "tipo_toner": "BK",
            "quantidade_inicial": 10,
        }
    elif categoria == "papel":
        payload = {"categoria": "papel", "tipo_papel": "A4", "quantidade_inicial": 5}
    else:
        payload = {"categoria": "customizado", "nome": "Item Teste P1", "quantidade_inicial": 0}

    saved_dfs = []

    def fake_save(df, uri):
        saved_dfs.append(df.copy())

    with patch("backend.core.services.stock.database.load_estoque", return_value=_make_empty_estoque()), \
         patch("backend.core.services.stock.database.load_estoque_lancamentos", return_value=_make_empty_lancamentos()), \
         patch("backend.core.services.stock.database.save_dataframe_csv", side_effect=fake_save), \
         patch("backend.core.services.stock.database.get_data_uri", return_value="file:///tmp/test.csv"):

        result = stock_svc.create_item(payload)

    assert result.get("status") == "success", f"create_item falhou: {result}"
    assert len(saved_dfs) >= 1, "Nenhum DataFrame foi salvo"

    estoque_df = saved_dfs[0]
    assert "Categoria" in estoque_df.columns, "Coluna 'Categoria' ausente no CSV salvo"
    cat_val = estoque_df.iloc[-1]["Categoria"]
    assert cat_val in VALID_CATEGORIAS, (
        f"Categoria '{cat_val}' não pertence ao conjunto válido {VALID_CATEGORIAS}"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# PROPERTY 2 — Validação de toner rejeita payloads incompletos
# Feature: smart-stock-system, Property 2: Validação de toner rejeita payloads incompletos
# Validates: Requirements 1.2, 3.4
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.parametrize("payload", [
    {"categoria": "toner"},
    {"categoria": "toner", "modelo_equipamento": "SLM4020"},
    {"categoria": "toner", "tipo_toner": "BK"},
    {"categoria": "toner", "modelo_equipamento": "", "tipo_toner": "BK"},
    {"categoria": "toner", "modelo_equipamento": "SLM4020", "tipo_toner": ""},
    {"categoria": "toner", "modelo_equipamento": "   ", "tipo_toner": "BK"},
])
def test_p2_toner_payload_incompleto_rejeitado(stock_svc, payload):
    """
    Para qualquer payload com categoria="toner" onde modelo_equipamento ou tipo_toner
    estão ausentes ou vazios, create_item deve retornar {"status": "error"} e
    o Estoque.csv não deve ser modificado.
    """
    saved_dfs = []

    def fake_save(df, uri):
        saved_dfs.append(df.copy())

    with patch("backend.core.services.stock.database.load_estoque", return_value=_make_empty_estoque()), \
         patch("backend.core.services.stock.database.load_estoque_lancamentos", return_value=_make_empty_lancamentos()), \
         patch("backend.core.services.stock.database.save_dataframe_csv", side_effect=fake_save), \
         patch("backend.core.services.stock.database.get_data_uri", return_value="file:///tmp/test.csv"):

        result = stock_svc.create_item(payload)

    assert result.get("status") == "error", (
        f"create_item deveria retornar erro para payload incompleto {payload}, mas retornou: {result}"
    )
    # Estoque.csv não deve ter sido salvo (ou salvo sem novo item)
    estoque_saves = [df for df in saved_dfs if "TipoModelo" in df.columns and len(df) > 0]
    assert len(estoque_saves) == 0, (
        f"Estoque.csv foi modificado indevidamente para payload inválido {payload}"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# PROPERTY 3 — Nome de toner gerado deterministicamente
# Feature: smart-stock-system, Property 3: Nome de toner gerado deterministicamente
# Validates: Requirements 1.3
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.skipif(not HAS_HYPOTHESIS, reason="hypothesis not installed")
@given(
    tipo_toner=st.sampled_from(VALID_TIPO_TONER),
    modelo=st.text(min_size=1, max_size=20, alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")))
)
@settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture] if HAS_HYPOTHESIS else [])
def test_p3_nome_toner_deterministico(stock_svc, tipo_toner, modelo):
    """
    Para qualquer combinação válida de (tipo_toner, modelo_equipamento),
    o TipoModelo do item criado deve ser exatamente f"{tipo_toner.strip().upper()} {modelo.strip()}".
    """
    assume(modelo.strip())  # Ignorar modelos que ficam vazios após strip

    expected_nome = f"{tipo_toner.strip().upper()} {modelo.strip()}"
    payload = {
        "categoria": "toner",
        "modelo_equipamento": modelo,
        "tipo_toner": tipo_toner,
        "quantidade_inicial": 0,
    }

    saved_dfs = []

    def fake_save(df, uri):
        saved_dfs.append(df.copy())

    with patch("backend.core.services.stock.database.load_estoque", return_value=_make_empty_estoque()), \
         patch("backend.core.services.stock.database.load_estoque_lancamentos", return_value=_make_empty_lancamentos()), \
         patch("backend.core.services.stock.database.save_dataframe_csv", side_effect=fake_save), \
         patch("backend.core.services.stock.database.get_data_uri", return_value="file:///tmp/test.csv"):

        result = stock_svc.create_item(payload)

    assert result.get("status") == "success", f"create_item falhou: {result}"
    assert len(saved_dfs) >= 1

    estoque_df = saved_dfs[0]
    nome_salvo = estoque_df.iloc[-1]["TipoModelo"]
    assert nome_salvo == expected_nome, (
        f"Nome gerado '{nome_salvo}' != esperado '{expected_nome}' "
        f"para tipo_toner='{tipo_toner}', modelo='{modelo}'"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# PROPERTY 4 — Unicidade de item no estoque
# Feature: smart-stock-system, Property 4: Unicidade de item no estoque
# Validates: Requirements 3.6
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.parametrize("nome,variante", [
    ("A4 (RESMAS)", "A4 (RESMAS)"),
    ("A4 (RESMAS)", "a4 (resmas)"),
    ("BK SLM4020", "BK SLM4020"),
    ("BK SLM4020", "bk slm4020"),
    ("Grampeador", "GRAMPEADOR"),
])
def test_p4_unicidade_item_estoque(stock_svc, nome, variante):
    """
    Para qualquer item já existente no Estoque.csv, chamar create_item com o mesmo
    nome (case-insensitive) deve retornar {"status": "error"} e não criar duplicata.
    """
    existing_df = pd.DataFrame([{
        "TipoModelo": nome, "EstoqueAtual": 10, "UltimaAlteracao": "01/01/2026",
        "Cor": "", "Empresa": "", "Codigo": "", "Categoria": "customizado",
        "ModeloEquipamento": "", "TipoToner": ""
    }])

    payload = {"categoria": "customizado", "nome": variante, "quantidade_inicial": 5}

    saved_dfs = []

    def fake_save(df, uri):
        saved_dfs.append(df.copy())

    with patch("backend.core.services.stock.database.load_estoque", return_value=existing_df.copy()), \
         patch("backend.core.services.stock.database.load_estoque_lancamentos", return_value=_make_empty_lancamentos()), \
         patch("backend.core.services.stock.database.save_dataframe_csv", side_effect=fake_save), \
         patch("backend.core.services.stock.database.get_data_uri", return_value="file:///tmp/test.csv"):

        result = stock_svc.create_item(payload)

    assert result.get("status") == "error", (
        f"create_item deveria retornar erro para item duplicado '{variante}' (existente: '{nome}'), "
        f"mas retornou: {result}"
    )
    assert "já existe" in result.get("message", "").lower(), (
        f"Mensagem de erro inesperada: {result.get('message')}"
    )
    # Não deve ter salvo nada
    estoque_saves = [df for df in saved_dfs if "TipoModelo" in df.columns and len(df) > 1]
    assert len(estoque_saves) == 0, "Estoque.csv foi modificado indevidamente para item duplicado"


# ═══════════════════════════════════════════════════════════════════════════════
# PROPERTY 5 — Criação registra lançamento de auditoria
# Feature: smart-stock-system, Property 5: Criação registra lançamento de auditoria
# Validates: Requirements 3.7
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.parametrize("payload,expected_nome", [
    ({"categoria": "papel", "tipo_papel": "A4", "quantidade_inicial": 100}, "A4 (RESMAS)"),
    ({"categoria": "toner", "modelo_equipamento": "ZT421", "tipo_toner": "BK", "quantidade_inicial": 20}, "BK ZT421"),
    ({"categoria": "customizado", "nome": "Grampeador", "quantidade_inicial": 5}, "Grampeador"),
])
def test_p5_criacao_registra_lancamento_auditoria(stock_svc, payload, expected_nome):
    """
    Para qualquer item criado com sucesso via create_item, o EstoqueLancamentos.csv
    deve conter exatamente um novo lançamento com TipoLancamento="Entrada" e
    TipoMaterial="Criação" referenciando o item criado.
    """
    saved_dfs = {}

    def fake_save(df, uri):
        # Distinguir pelo conteúdo: lancamentos tem TipoMaterial, estoque tem TipoModelo
        if "TipoMaterial" in df.columns:
            saved_dfs["lancamentos"] = df.copy()
        else:
            saved_dfs["estoque"] = df.copy()

    with patch("backend.core.services.stock.database.load_estoque", return_value=_make_empty_estoque()), \
         patch("backend.core.services.stock.database.load_estoque_lancamentos", return_value=_make_empty_lancamentos()), \
         patch("backend.core.services.stock.database.save_dataframe_csv", side_effect=fake_save), \
         patch("backend.core.services.stock.database.get_data_uri", return_value="file:///tmp/test.csv"):

        result = stock_svc.create_item(payload)

    assert result.get("status") == "success", f"create_item falhou: {result}"
    assert "lancamentos" in saved_dfs, "EstoqueLancamentos.csv não foi salvo"

    lanc_df = saved_dfs["lancamentos"]
    assert len(lanc_df) >= 1, "Nenhum lançamento foi registrado"

    ultimo = lanc_df.iloc[-1]
    assert str(ultimo.get("TipoLancamento", "")).strip() == "Entrada", (
        f"TipoLancamento esperado 'Entrada', obtido '{ultimo.get('TipoLancamento')}'"
    )
    assert str(ultimo.get("TipoMaterial", "")).strip() == "Criação", (
        f"TipoMaterial esperado 'Criação', obtido '{ultimo.get('TipoMaterial')}'"
    )
    assert str(ultimo.get("Modelo", "")).strip() == expected_nome, (
        f"Modelo no lançamento esperado '{expected_nome}', obtido '{ultimo.get('Modelo')}'"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# PROPERTY 6 — Retrocompatibilidade de itens legados
# Feature: smart-stock-system, Property 6: Retrocompatibilidade de itens legados
# Validates: Requirements 2.1, 2.2, 2.3
# ═══════════════════════════════════════════════════════════════════════════════

def test_p6_retrocompatibilidade_csv_legado(stock_svc):
    """
    Para qualquer Estoque.csv sem as colunas Categoria, ModeloEquipamento ou TipoToner,
    get_levels() deve retornar cada item com Categoria="customizado",
    ModeloEquipamento="" e TipoToner="" sem lançar exceção.
    """
    # CSV legado: apenas colunas originais
    legacy_df = pd.DataFrame([
        {"TipoModelo": "A4 (RESMAS)", "EstoqueAtual": 100, "UltimaAlteracao": "01/01/2026", "Cor": "", "Empresa": "USIMINAS"},
        {"TipoModelo": "BK SLM4020", "EstoqueAtual": 50, "UltimaAlteracao": "01/01/2026", "Cor": "", "Empresa": "USIMINAS"},
    ])

    with patch("backend.core.services.stock.database.load_estoque", return_value=legacy_df):
        levels = stock_svc.get_levels()

    assert len(levels) == 2, f"get_levels retornou {len(levels)} itens, esperado 2"

    for item in levels:
        assert item.get("Categoria", "customizado") == "customizado", (
            f"Item legado deve ter Categoria='customizado', obtido: {item.get('Categoria')}"
        )
        assert item.get("ModeloEquipamento", "") == "", (
            f"Item legado deve ter ModeloEquipamento='', obtido: {item.get('ModeloEquipamento')}"
        )
        assert item.get("TipoToner", "") == "", (
            f"Item legado deve ter TipoToner='', obtido: {item.get('TipoToner')}"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# PROPERTY 7 — update_item() preserva campos de categoria
# Feature: smart-stock-system, Property 7: update_item() preserva campos de categoria
# Validates: Requirements 2.4
# ═══════════════════════════════════════════════════════════════════════════════

def test_p7_update_item_preserva_categoria(stock_svc):
    """
    Para qualquer item com Categoria, ModeloEquipamento e TipoToner definidos,
    chamar update_item() com apenas new_item, code ou empresa deve preservar
    os valores originais de Categoria, ModeloEquipamento e TipoToner.
    """
    existing_df = pd.DataFrame([{
        "TipoModelo": "BK SLM4020",
        "EstoqueAtual": 30,
        "UltimaAlteracao": "01/01/2026",
        "Cor": "",
        "Empresa": "USIMINAS",
        "Codigo": "OLD_CODE",
        "Categoria": "toner",
        "ModeloEquipamento": "SLM4020",
        "TipoToner": "BK"
    }])

    saved_dfs = []

    def fake_save(df, uri):
        saved_dfs.append(df.copy())

    with patch("backend.core.services.stock.database.load_estoque", return_value=existing_df.copy()), \
         patch("backend.core.services.stock.database.save_dataframe_csv", side_effect=fake_save), \
         patch("backend.core.services.stock.database.get_data_uri", return_value="file:///tmp/test.csv"):

        result = stock_svc.update_item({
            "original_item": "BK SLM4020",
            "code": "NEW_CODE",
            "empresa": "FSFX"
            # Sem Categoria, ModeloEquipamento, TipoToner
        })

    assert result.get("status") == "success", f"update_item falhou: {result}"
    assert len(saved_dfs) >= 1

    saved = saved_dfs[0]
    row = saved.iloc[0]

    assert str(row.get("Categoria", "")) == "toner", (
        f"Categoria foi alterada indevidamente: '{row.get('Categoria')}'"
    )
    assert str(row.get("ModeloEquipamento", "")) == "SLM4020", (
        f"ModeloEquipamento foi alterado indevidamente: '{row.get('ModeloEquipamento')}'"
    )
    assert str(row.get("TipoToner", "")) == "BK", (
        f"TipoToner foi alterado indevidamente: '{row.get('TipoToner')}'"
    )
    # Campos atualizados devem ter mudado
    assert str(row.get("Codigo", "")) == "NEW_CODE"
    assert str(row.get("Empresa", "")) == "FSFX"


# ═══════════════════════════════════════════════════════════════════════════════
# PROPERTY 12 — get_modelos() retorna valores únicos e ordenados
# Feature: smart-stock-system, Property 12: get_modelos() retorna valores únicos e ordenados
# Validates: Requirements 4.1, 4.3
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.skipif(not HAS_HYPOTHESIS, reason="hypothesis not installed")
@given(
    modelos=st.lists(
        st.text(min_size=1, max_size=15, alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd"))),
        min_size=0, max_size=20
    )
)
@settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture] if HAS_HYPOTHESIS else [])
def test_p12_get_modelos_unicos_ordenados(stock_svc, modelos):
    """
    Para qualquer MAPA.csv com N valores distintos e não-vazios em ModeloSimpress,
    get_modelos() deve retornar exatamente esses N valores em ordem alfabética
    crescente, sem duplicatas e sem valores vazios.
    """
    # Incluir duplicatas e vazios propositalmente
    modelos_com_duplicatas = modelos + modelos[:2] + ["", "  "]
    mapa_df = pd.DataFrame({"ModeloSimpress": modelos_com_duplicatas})

    with patch("backend.core.services.stock.database.load_mapa", return_value=mapa_df):
        result = stock_svc.get_modelos()

    # Calcular esperado: únicos, não-vazios, ordenados
    expected = sorted(set(m.strip() for m in modelos if m.strip()))

    assert result == expected, (
        f"get_modelos() retornou {result}, esperado {expected} "
        f"(entrada: {modelos_com_duplicatas})"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# PROPERTY 8 — Baixa automática de papel decrementa valor exato
# Feature: smart-stock-system, Property 8: Baixa automática de papel decrementa valor exato
# Validates: Requirements 5.1, 5.2
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.skipif(not HAS_HYPOTHESIS, reason="hypothesis not installed")
@given(
    qty_a4=st.integers(min_value=1, max_value=500),
    qty_a3=st.integers(min_value=0, max_value=100),
    estoque_inicial=st.integers(min_value=0, max_value=1000),
)
@settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture] if HAS_HYPOTHESIS else [])
def test_p8_baixa_papel_decrementa_exato(protocol_svc, qty_a4, qty_a3, estoque_inicial):
    """
    Para qualquer protocolo entregue com A4 > 0 ou A3 > 0, o EstoqueAtual do item
    de papel correspondente deve diminuir exatamente pelo valor informado.
    """
    estoque_df = pd.DataFrame([
        {"TipoModelo": "A4 (RESMAS)", "EstoqueAtual": estoque_inicial, "UltimaAlteracao": "01/01/2026",
         "Cor": "", "Empresa": "TEST", "Codigo": "", "Categoria": "papel", "ModeloEquipamento": "", "TipoToner": ""},
        {"TipoModelo": "A3 (RESMAS)", "EstoqueAtual": estoque_inicial, "UltimaAlteracao": "01/01/2026",
         "Cor": "", "Empresa": "TEST", "Codigo": "", "Categoria": "papel", "ModeloEquipamento": "", "TipoToner": ""},
    ])
    entregas_df = pd.DataFrame([{
        "Protocolo": 1, "Serie": "SN001", "Modelo": "SLM4020", "ModeloSimpress": "SLM4020",
        "Fila": "FILA01", "Status": "Pendente", "Empresa": "TEST",
        "A4": qty_a4, "A3": qty_a3,
        "TonerPreto": 0, "TonerCiano": 0, "TonerAmarelo": 0, "TonerMagenta": 0,
        "DataEntrega": "", "RecebidoPor": "", "Funcionario": ""
    }])
    lancamentos_df = _make_empty_lancamentos()

    saved_dfs = {}

    def fake_save(df, uri):
        if "TipoMaterial" in df.columns:
            saved_dfs["lancamentos"] = df.copy()
        elif "TipoModelo" in df.columns:
            saved_dfs["estoque"] = df.copy()
        else:
            saved_dfs["entregas"] = df.copy()

    with patch("backend.core.services.protocol.database.load_entregas", return_value=entregas_df.copy()), \
         patch("backend.core.services.protocol.database.load_estoque", return_value=estoque_df.copy()), \
         patch("backend.core.services.protocol.database.load_estoque_lancamentos", return_value=lancamentos_df.copy()), \
         patch("backend.core.services.protocol.database.save_dataframe_csv", side_effect=fake_save), \
         patch("backend.core.services.protocol.database.get_data_uri", return_value="file:///tmp/test.csv"):

        result = protocol_svc.deliver(1, {"RecebidoPor": "Maria", "Funcionario": "João"})

    assert result.get("status") == "success", f"deliver() falhou: {result}"
    assert "estoque" in saved_dfs, "Estoque.csv não foi salvo após deliver()"

    estoque_salvo = saved_dfs["estoque"]

    # Verificar A4
    a4_row = estoque_salvo[estoque_salvo["TipoModelo"].astype(str).str.strip() == "A4 (RESMAS)"]
    assert len(a4_row) == 1, "Item 'A4 (RESMAS)' não encontrado no estoque salvo"
    novo_a4 = int(a4_row.iloc[0]["EstoqueAtual"])
    assert novo_a4 == estoque_inicial - qty_a4, (
        f"A4: esperado {estoque_inicial - qty_a4}, obtido {novo_a4} "
        f"(inicial={estoque_inicial}, qty={qty_a4})"
    )

    # Verificar A3 (apenas se qty_a3 > 0)
    if qty_a3 > 0:
        a3_row = estoque_salvo[estoque_salvo["TipoModelo"].astype(str).str.strip() == "A3 (RESMAS)"]
        assert len(a3_row) == 1, "Item 'A3 (RESMAS)' não encontrado no estoque salvo"
        novo_a3 = int(a3_row.iloc[0]["EstoqueAtual"])
        assert novo_a3 == estoque_inicial - qty_a3, (
            f"A3: esperado {estoque_inicial - qty_a3}, obtido {novo_a3}"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# PROPERTY 9 — Baixa automática de toner associa modelo corretamente
# Feature: smart-stock-system, Property 9: Baixa automática de toner associa modelo corretamente
# Validates: Requirements 5.3, 5.4, 5.5, 5.6
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.parametrize("campo_protocolo,tipo_toner_esperado", [
    ("TonerPreto", "BK"),
    ("TonerCiano", "CY"),
    ("TonerAmarelo", "YW"),
    ("TonerMagenta", "MG"),
])
def test_p9_baixa_toner_associa_modelo(protocol_svc, campo_protocolo, tipo_toner_esperado):
    """
    Para qualquer protocolo entregue com TonerX > 0 e Modelo não-vazio,
    o item com Categoria="toner", TipoToner correspondente e ModeloEquipamento
    igual ao modelo do protocolo deve ter seu EstoqueAtual decrementado.
    """
    modelo = "ZT421"
    nome_item = f"{tipo_toner_esperado} {modelo}"
    estoque_inicial = 50

    estoque_df = pd.DataFrame([{
        "TipoModelo": nome_item, "EstoqueAtual": estoque_inicial, "UltimaAlteracao": "01/01/2026",
        "Cor": "", "Empresa": "TEST", "Codigo": "",
        "Categoria": "toner", "ModeloEquipamento": modelo, "TipoToner": tipo_toner_esperado
    }])

    # Protocolo com apenas o toner em questão = 1
    toner_fields = {"TonerPreto": 0, "TonerCiano": 0, "TonerAmarelo": 0, "TonerMagenta": 0}
    toner_fields[campo_protocolo] = 1

    entregas_df = pd.DataFrame([{
        "Protocolo": 1, "Serie": "SN001", "Modelo": modelo, "ModeloSimpress": modelo,
        "Fila": "FILA01", "Status": "Pendente", "Empresa": "TEST",
        "A4": 0, "A3": 0,
        "DataEntrega": "", "RecebidoPor": "", "Funcionario": "",
        **toner_fields
    }])

    saved_dfs = {}

    def fake_save(df, uri):
        if "TipoMaterial" in df.columns:
            saved_dfs["lancamentos"] = df.copy()
        elif "TipoModelo" in df.columns:
            saved_dfs["estoque"] = df.copy()
        else:
            saved_dfs["entregas"] = df.copy()

    with patch("backend.core.services.protocol.database.load_entregas", return_value=entregas_df.copy()), \
         patch("backend.core.services.protocol.database.load_estoque", return_value=estoque_df.copy()), \
         patch("backend.core.services.protocol.database.load_estoque_lancamentos", return_value=_make_empty_lancamentos()), \
         patch("backend.core.services.protocol.database.save_dataframe_csv", side_effect=fake_save), \
         patch("backend.core.services.protocol.database.get_data_uri", return_value="file:///tmp/test.csv"):

        result = protocol_svc.deliver(1, {"RecebidoPor": "Maria", "Funcionario": "João"})

    assert result.get("status") == "success", f"deliver() falhou: {result}"
    assert "estoque" in saved_dfs, "Estoque.csv não foi salvo"

    estoque_salvo = saved_dfs["estoque"]
    item_row = estoque_salvo[
        (estoque_salvo.get("Categoria", pd.Series([""] * len(estoque_salvo))).astype(str) == "toner") &
        (estoque_salvo.get("TipoToner", pd.Series([""] * len(estoque_salvo))).astype(str) == tipo_toner_esperado) &
        (estoque_salvo.get("ModeloEquipamento", pd.Series([""] * len(estoque_salvo))).astype(str) == modelo)
    ]

    assert len(item_row) == 1, (
        f"Item toner '{nome_item}' não encontrado no estoque salvo. "
        f"Estoque: {estoque_salvo[['TipoModelo', 'Categoria', 'TipoToner', 'ModeloEquipamento', 'EstoqueAtual']].to_dict('records')}"
    )
    novo_estoque = int(item_row.iloc[0]["EstoqueAtual"])
    assert novo_estoque == estoque_inicial - 1, (
        f"Estoque de '{nome_item}': esperado {estoque_inicial - 1}, obtido {novo_estoque}"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# PROPERTY 10 — Criação automática de item ausente na baixa
# Feature: smart-stock-system, Property 10: Criação automática de item ausente na baixa
# Validates: Requirements 5.7, 5.8
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.parametrize("campo,qty,categoria_esperada,nome_esperado", [
    ("A4", 5, "papel", "A4 (RESMAS)"),
    ("TonerPreto", 1, "toner", "BK SLM4020"),
    ("TonerCiano", 2, "toner", "CY SLM4020"),
])
def test_p10_criacao_automatica_item_ausente(protocol_svc, campo, qty, categoria_esperada, nome_esperado):
    """
    Para qualquer protocolo entregue cujo item de estoque não existe,
    deliver() deve criar automaticamente o item com EstoqueAtual = -qty,
    Categoria correta e campos TipoToner/ModeloEquipamento preenchidos.
    """
    # Estoque VAZIO
    estoque_df = _make_empty_estoque()

    toner_fields = {"TonerPreto": 0, "TonerCiano": 0, "TonerAmarelo": 0, "TonerMagenta": 0}
    if campo in toner_fields:
        toner_fields[campo] = qty

    entregas_df = pd.DataFrame([{
        "Protocolo": 1, "Serie": "SN001", "Modelo": "SLM4020", "ModeloSimpress": "SLM4020",
        "Fila": "FILA01", "Status": "Pendente", "Empresa": "TEST",
        "A4": qty if campo == "A4" else 0,
        "A3": 0,
        "DataEntrega": "", "RecebidoPor": "", "Funcionario": "",
        **toner_fields
    }])

    saved_dfs = {}

    def fake_save(df, uri):
        if "TipoMaterial" in df.columns:
            saved_dfs["lancamentos"] = df.copy()
        elif "TipoModelo" in df.columns:
            saved_dfs["estoque"] = df.copy()
        else:
            saved_dfs["entregas"] = df.copy()

    with patch("backend.core.services.protocol.database.load_entregas", return_value=entregas_df.copy()), \
         patch("backend.core.services.protocol.database.load_estoque", return_value=estoque_df.copy()), \
         patch("backend.core.services.protocol.database.load_estoque_lancamentos", return_value=_make_empty_lancamentos()), \
         patch("backend.core.services.protocol.database.save_dataframe_csv", side_effect=fake_save), \
         patch("backend.core.services.protocol.database.get_data_uri", return_value="file:///tmp/test.csv"):

        result = protocol_svc.deliver(1, {"RecebidoPor": "Maria", "Funcionario": "João"})

    assert result.get("status") == "success", f"deliver() falhou: {result}"
    assert "estoque" in saved_dfs, "Estoque.csv não foi salvo"

    estoque_salvo = saved_dfs["estoque"]
    item_row = estoque_salvo[estoque_salvo["TipoModelo"].astype(str).str.strip() == nome_esperado]

    assert len(item_row) == 1, (
        f"Item '{nome_esperado}' não foi criado automaticamente. "
        f"Estoque: {estoque_salvo['TipoModelo'].tolist()}"
    )
    novo_estoque = int(item_row.iloc[0]["EstoqueAtual"])
    assert novo_estoque == -qty, (
        f"EstoqueAtual do item criado automaticamente: esperado {-qty}, obtido {novo_estoque}"
    )
    cat = str(item_row.iloc[0].get("Categoria", ""))
    assert cat == categoria_esperada, (
        f"Categoria do item criado: esperado '{categoria_esperada}', obtido '{cat}'"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# PROPERTY 11 — Baixa registra lançamento de saída
# Feature: smart-stock-system, Property 11: Baixa registra lançamento de saída
# Validates: Requirements 5.9
# ═══════════════════════════════════════════════════════════════════════════════

def test_p11_baixa_registra_lancamento_saida(protocol_svc):
    """
    Para qualquer entrega com qty > 0, o EstoqueLancamentos.csv deve conter
    um novo lançamento com TipoMaterial="Consumo" e TipoLancamento="Saída"
    para cada item decrementado.
    """
    estoque_df = pd.DataFrame([
        {"TipoModelo": "A4 (RESMAS)", "EstoqueAtual": 100, "UltimaAlteracao": "01/01/2026",
         "Cor": "", "Empresa": "TEST", "Codigo": "", "Categoria": "papel", "ModeloEquipamento": "", "TipoToner": ""},
        {"TipoModelo": "BK SLM4020", "EstoqueAtual": 50, "UltimaAlteracao": "01/01/2026",
         "Cor": "", "Empresa": "TEST", "Codigo": "", "Categoria": "toner", "ModeloEquipamento": "SLM4020", "TipoToner": "BK"},
    ])
    entregas_df = pd.DataFrame([{
        "Protocolo": 42, "Serie": "SN001", "Modelo": "SLM4020", "ModeloSimpress": "SLM4020",
        "Fila": "FILA01", "Status": "Pendente", "Empresa": "TEST",
        "A4": 3, "A3": 0,
        "TonerPreto": 1, "TonerCiano": 0, "TonerAmarelo": 0, "TonerMagenta": 0,
        "DataEntrega": "", "RecebidoPor": "", "Funcionario": ""
    }])

    saved_dfs = {}

    def fake_save(df, uri):
        if "TipoMaterial" in df.columns:
            saved_dfs["lancamentos"] = df.copy()
        elif "TipoModelo" in df.columns:
            saved_dfs["estoque"] = df.copy()
        else:
            saved_dfs["entregas"] = df.copy()

    with patch("backend.core.services.protocol.database.load_entregas", return_value=entregas_df.copy()), \
         patch("backend.core.services.protocol.database.load_estoque", return_value=estoque_df.copy()), \
         patch("backend.core.services.protocol.database.load_estoque_lancamentos", return_value=_make_empty_lancamentos()), \
         patch("backend.core.services.protocol.database.save_dataframe_csv", side_effect=fake_save), \
         patch("backend.core.services.protocol.database.get_data_uri", return_value="file:///tmp/test.csv"):

        result = protocol_svc.deliver(42, {"RecebidoPor": "Maria", "Funcionario": "João"})

    assert result.get("status") == "success"
    assert "lancamentos" in saved_dfs, "EstoqueLancamentos.csv não foi salvo"

    lanc_df = saved_dfs["lancamentos"]
    saidas = lanc_df[
        (lanc_df["TipoLancamento"].astype(str) == "Saída") &
        (lanc_df["TipoMaterial"].astype(str) == "Consumo")
    ]

    # Deve ter pelo menos 2 lançamentos de saída: A4 e TonerPreto
    assert len(saidas) >= 2, (
        f"Esperado >= 2 lançamentos de Saída/Consumo, obtido {len(saidas)}. "
        f"Lançamentos: {lanc_df[['TipoMaterial', 'TipoLancamento', 'Modelo']].to_dict('records')}"
    )

    modelos_saida = saidas["Modelo"].astype(str).tolist()
    assert any("A4" in m for m in modelos_saida), f"Lançamento de A4 não encontrado: {modelos_saida}"
    assert any("BK" in m or "Toner" in m.lower() for m in modelos_saida), (
        f"Lançamento de toner não encontrado: {modelos_saida}"
    )
