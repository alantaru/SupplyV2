"""
Módulo de Testes: Refinery Normalizer (backend.core.refinery.normalizer)
Descrição: Testes para limpeza e padronização de dados (Money, Date, Boolean).
Cobertura: RefineryNormalizer methods
Idioma: PT-BR
"""
import pytest
import pandas as pd
from backend.core.refinery.normalizer import RefineryNormalizer

@pytest.mark.unit
def test_clean_money():
    norm = RefineryNormalizer()
    assert norm.clean_money("R$ 1.234,56") == 1234.56
    assert norm.clean_money("1.234,56") == 1234.56
    assert norm.clean_money("-") == 0.0
    assert norm.clean_money(None) == 0.0
    assert norm.clean_money("Garbage") == 0.0

@pytest.mark.unit
def test_clean_boolean():
    norm = RefineryNormalizer()
    assert norm.clean_boolean("Sim") is True
    assert norm.clean_boolean("yes") is True
    assert norm.clean_boolean("1") is True
    assert norm.clean_boolean("não") is False
    assert norm.clean_boolean(None) is False

@pytest.mark.unit
def test_clean_date():
    norm = RefineryNormalizer()
    ts = norm.clean_date("31/12/2026")
    assert ts.year == 2026
    assert ts.month == 12
    assert ts.day == 31
    
    assert norm.clean_date("-") is None
    assert norm.clean_date("") is None

@pytest.mark.unit
def test_normalize_dataframe():
    """
    Cenário: DataFrame com colunas sujas (Valor, Data, Strings com espaço).
    Ação: normalize().
    Resultado: Tipos convertidos e strings limpas.
    """
    df = pd.DataFrame({
        "Valor Total": ["R$ 1.000,00", "R$ 500,00"],
        "Data Instalacao": ["01/01/2025", "01/02/2025"],
        "Modelo": ["  HP  ", "Canon"]
    })
    
    norm = RefineryNormalizer()
    cleaned = norm.normalize(df)
    
    assert cleaned.iloc[0]["Valor Total"] == 1000.0
    assert isinstance(cleaned.iloc[0]["Valor Total"], float)
    
    assert cleaned.iloc[0]["Data Instalacao"].year == 2025
    
    assert cleaned.iloc[0]["Modelo"] == "HP" # Trimmed
