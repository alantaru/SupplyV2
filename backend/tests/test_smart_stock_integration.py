"""
Smart Stock System — Integration Tests

Testa o fluxo completo: criar item → ajustar → verificar histórico,
entrega com baixa automática, e retrocompatibilidade com CSV legado.

Feature: smart-stock-system
"""
import pytest
import pandas as pd
from unittest.mock import patch, MagicMock

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.core.services.stock import StockService
from backend.core.services.protocol import ProtocolService


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _empty_estoque():
    return pd.DataFrame(columns=[
        "TipoModelo", "EstoqueAtual", "UltimaAlteracao",
        "Cor", "Empresa", "Codigo", "Categoria", "ModeloEquipamento", "TipoToner"
    ])

def _empty_lancamentos():
    return pd.DataFrame(columns=[
        "TipoMaterial", "Modelo", "TipoLancamento", "Quantidade",
        "ProtocoloOUPedido", "FilaImpressao", "Colaborador",
        "DataLancamento", "Empresa", "Obs"
    ])


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 10.1 — Fixture de contrato temporário
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def stock_svc():
    return StockService(contract_id="INTEG_TEST")

@pytest.fixture
def protocol_svc():
    return ProtocolService(contract_id="INTEG_TEST")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 10.2 — Fluxo completo: criar item → ajustar → verificar histórico
# Validates: Requirements 3.1, 3.7
# ═══════════════════════════════════════════════════════════════════════════════

def test_integration_criar_item_ajustar_historico(stock_svc):
    """
    Fluxo: POST /stock/item (toner) → POST /stock/adjust → GET /stock/history
    Verifica que histórico contém lançamento de criação e lançamento de ajuste.
    """
    # Estado inicial: estoque e histórico vazios
    estoque_state = [_empty_estoque()]
    lancamentos_state = [_empty_lancamentos()]

    def fake_load_estoque(cid):
        return estoque_state[0].copy()

    def fake_load_lancamentos(cid):
        return lancamentos_state[0].copy()

    def fake_save(df, uri):
        if "TipoMaterial" in df.columns:
            lancamentos_state[0] = df.copy()
        elif "TipoModelo" in df.columns:
            estoque_state[0] = df.copy()

    with patch("backend.core.services.stock.database.load_estoque", side_effect=fake_load_estoque), \
         patch("backend.core.services.stock.database.load_estoque_lancamentos", side_effect=fake_load_lancamentos), \
         patch("backend.core.services.stock.database.save_dataframe_csv", side_effect=fake_save), \
         patch("backend.core.services.stock.database.get_data_uri", return_value="file:///tmp/test.csv"):

        # 1. Criar item toner
        result_create = stock_svc.create_item({
            "categoria": "toner",
            "modelo_equipamento": "ZT421",
            "tipo_toner": "BK",
            "quantidade_inicial": 50,
            "empresa": "USIMINAS",
        })
        assert result_create["status"] == "success", f"create_item falhou: {result_create}"
        assert result_create["nome"] == "BK ZT421"

        # Verificar estoque
        assert len(estoque_state[0]) == 1
        assert estoque_state[0].iloc[0]["TipoModelo"] == "BK ZT421"
        assert int(estoque_state[0].iloc[0]["EstoqueAtual"]) == 50
        assert estoque_state[0].iloc[0]["Categoria"] == "toner"

        # Verificar lançamento de criação
        assert len(lancamentos_state[0]) == 1
        assert lancamentos_state[0].iloc[0]["TipoMaterial"] == "Criação"
        assert lancamentos_state[0].iloc[0]["TipoLancamento"] == "Entrada"

        # 2. Ajustar estoque (entrada de 20 unidades)
        result_adjust = stock_svc.adjust({
            "item": "BK ZT421",
            "qty": 20,
            "user": "Admin",
            "reason": "Reposição",
            "type": "Entrada"
        })
        assert result_adjust["status"] == "success"

        # Verificar estoque atualizado
        assert int(estoque_state[0].iloc[0]["EstoqueAtual"]) == 70

        # Verificar histórico com 2 lançamentos
        assert len(lancamentos_state[0]) == 2
        tipos = lancamentos_state[0]["TipoMaterial"].tolist()
        assert "Criação" in tipos
        assert "Ajuste" in tipos


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 10.3 — Fluxo de entrega com baixa automática
# Validates: Requirements 5.1, 5.3, 5.9
# ═══════════════════════════════════════════════════════════════════════════════

def test_integration_entrega_baixa_automatica(protocol_svc):
    """
    Criar protocolo → deliver() → verificar Estoque.csv e EstoqueLancamentos.csv.
    Verifica decremento exato e lançamentos de saída.
    """
    estoque_state = [pd.DataFrame([
        {"TipoModelo": "A4 (RESMAS)", "EstoqueAtual": 200, "UltimaAlteracao": "01/01/2026",
         "Cor": "", "Empresa": "TEST", "Codigo": "", "Categoria": "papel", "ModeloEquipamento": "", "TipoToner": ""},
        {"TipoModelo": "BK SLM4020", "EstoqueAtual": 30, "UltimaAlteracao": "01/01/2026",
         "Cor": "", "Empresa": "TEST", "Codigo": "", "Categoria": "toner", "ModeloEquipamento": "SLM4020", "TipoToner": "BK"},
    ])]
    lancamentos_state = [_empty_lancamentos()]

    entregas_df = pd.DataFrame([{
        "Protocolo": 100, "Serie": "SN001", "Modelo": "SLM4020", "ModeloSimpress": "SLM4020",
        "Fila": "FILA01", "Status": "Pendente", "Empresa": "TEST",
        "A4": 10, "A3": 0,
        "TonerPreto": 2, "TonerCiano": 0, "TonerAmarelo": 0, "TonerMagenta": 0,
        "DataEntrega": "", "RecebidoPor": "", "Funcionario": ""
    }])

    def fake_save(df, uri):
        if "TipoMaterial" in df.columns:
            lancamentos_state[0] = df.copy()
        elif "TipoModelo" in df.columns:
            estoque_state[0] = df.copy()

    with patch("backend.core.services.protocol.database.load_entregas", return_value=entregas_df.copy()), \
         patch("backend.core.services.protocol.database.load_estoque", side_effect=lambda cid: estoque_state[0].copy()), \
         patch("backend.core.services.protocol.database.load_estoque_lancamentos", side_effect=lambda cid: lancamentos_state[0].copy()), \
         patch("backend.core.services.protocol.database.save_dataframe_csv", side_effect=fake_save), \
         patch("backend.core.services.protocol.database.get_data_uri", return_value="file:///tmp/test.csv"):

        result = protocol_svc.deliver(100, {"RecebidoPor": "Maria", "Funcionario": "João"})

    assert result["status"] == "success"

    # Verificar A4 decrementado
    a4_row = estoque_state[0][estoque_state[0]["TipoModelo"] == "A4 (RESMAS)"]
    assert int(a4_row.iloc[0]["EstoqueAtual"]) == 190  # 200 - 10

    # Verificar toner BK decrementado
    bk_row = estoque_state[0][estoque_state[0]["TipoModelo"] == "BK SLM4020"]
    assert int(bk_row.iloc[0]["EstoqueAtual"]) == 28  # 30 - 2

    # Verificar lançamentos de saída
    saidas = lancamentos_state[0][
        (lancamentos_state[0]["TipoLancamento"] == "Saída") &
        (lancamentos_state[0]["TipoMaterial"] == "Consumo")
    ]
    assert len(saidas) >= 2


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 10.4 — Retrocompatibilidade com CSV legado
# Validates: Requirements 2.1, 2.2, 2.3
# ═══════════════════════════════════════════════════════════════════════════════

def test_integration_retrocompatibilidade_csv_legado(stock_svc):
    """
    Carregar Estoque.csv sem colunas novas → GET /stock/ → verificar defaults.
    """
    legacy_df = pd.DataFrame([
        {"TipoModelo": "A4 (RESMAS)", "EstoqueAtual": 100, "UltimaAlteracao": "01/01/2026", "Cor": "", "Empresa": "USIMINAS"},
        {"TipoModelo": "BK SLM4020", "EstoqueAtual": 50, "UltimaAlteracao": "01/01/2026", "Cor": "", "Empresa": "USIMINAS"},
        {"TipoModelo": "Grampeador", "EstoqueAtual": 5, "UltimaAlteracao": "01/01/2026", "Cor": "", "Empresa": "USIMINAS"},
    ])

    with patch("backend.core.services.stock.database.load_estoque", return_value=legacy_df):
        levels = stock_svc.get_levels()

    assert len(levels) == 3

    for item in levels:
        assert item.get("Categoria", "customizado") == "customizado", (
            f"Item legado deve ter Categoria='customizado', obtido: {item.get('Categoria')}"
        )
        assert item.get("ModeloEquipamento", "") == "", (
            f"ModeloEquipamento deve ser vazio para item legado: {item.get('ModeloEquipamento')}"
        )
        assert item.get("TipoToner", "") == "", (
            f"TipoToner deve ser vazio para item legado: {item.get('TipoToner')}"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 10.5 — GET /stock/modelos com MAPA.csv vazio e populado
# Validates: Requirements 4.1, 4.2, 4.3
# ═══════════════════════════════════════════════════════════════════════════════

def test_integration_get_modelos_vazio(stock_svc):
    """GET /stock/modelos com MAPA.csv vazio retorna []."""
    with patch("backend.core.services.stock.database.load_mapa", return_value=pd.DataFrame()):
        result = stock_svc.get_modelos()
    assert result == []


def test_integration_get_modelos_populado(stock_svc):
    """GET /stock/modelos com MAPA.csv populado retorna lista ordenada e única."""
    mapa_df = pd.DataFrame({
        "ModeloSimpress": ["ZT421", "SLM4020", "ZT421", "SLM4020", "HP1020", ""]
    })
    with patch("backend.core.services.stock.database.load_mapa", return_value=mapa_df):
        result = stock_svc.get_modelos()

    assert result == ["HP1020", "SLM4020", "ZT421"]  # ordenado, sem duplicatas, sem vazio


# ═══════════════════════════════════════════════════════════════════════════════
# TEST — Criação automática de item ausente na baixa (integração)
# Validates: Requirements 5.7, 5.8
# ═══════════════════════════════════════════════════════════════════════════════

def test_integration_criacao_automatica_na_baixa(protocol_svc):
    """
    Estoque vazio + protocolo com A4 e toner → deliver() cria itens automaticamente.
    """
    estoque_state = [_empty_estoque()]
    lancamentos_state = [_empty_lancamentos()]

    entregas_df = pd.DataFrame([{
        "Protocolo": 200, "Serie": "SN002", "Modelo": "ZT421", "ModeloSimpress": "ZT421",
        "Fila": "FILA02", "Status": "Pendente", "Empresa": "TEST",
        "A4": 5, "A3": 0,
        "TonerPreto": 1, "TonerCiano": 0, "TonerAmarelo": 0, "TonerMagenta": 0,
        "DataEntrega": "", "RecebidoPor": "", "Funcionario": ""
    }])

    def fake_save(df, uri):
        if "TipoMaterial" in df.columns:
            lancamentos_state[0] = df.copy()
        elif "TipoModelo" in df.columns:
            estoque_state[0] = df.copy()

    with patch("backend.core.services.protocol.database.load_entregas", return_value=entregas_df.copy()), \
         patch("backend.core.services.protocol.database.load_estoque", side_effect=lambda cid: estoque_state[0].copy()), \
         patch("backend.core.services.protocol.database.load_estoque_lancamentos", side_effect=lambda cid: lancamentos_state[0].copy()), \
         patch("backend.core.services.protocol.database.save_dataframe_csv", side_effect=fake_save), \
         patch("backend.core.services.protocol.database.get_data_uri", return_value="file:///tmp/test.csv"):

        result = protocol_svc.deliver(200, {"RecebidoPor": "Ana", "Funcionario": "Pedro"})

    assert result["status"] == "success"

    # Verificar que itens foram criados automaticamente
    nomes = estoque_state[0]["TipoModelo"].tolist()
    assert "A4 (RESMAS)" in nomes, f"A4 (RESMAS) não foi criado: {nomes}"
    assert "BK ZT421" in nomes, f"BK ZT421 não foi criado: {nomes}"

    # Verificar valores negativos (estoque criado com consumo)
    a4_row = estoque_state[0][estoque_state[0]["TipoModelo"] == "A4 (RESMAS)"]
    assert int(a4_row.iloc[0]["EstoqueAtual"]) == -5

    bk_row = estoque_state[0][estoque_state[0]["TipoModelo"] == "BK ZT421"]
    assert int(bk_row.iloc[0]["EstoqueAtual"]) == -1
    assert bk_row.iloc[0]["Categoria"] == "toner"
    assert bk_row.iloc[0]["TipoToner"] == "BK"
    assert bk_row.iloc[0]["ModeloEquipamento"] == "ZT421"
