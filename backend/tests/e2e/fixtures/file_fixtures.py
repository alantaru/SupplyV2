"""
file_fixtures.py — Fixtures de arquivos CSV de teste para os testes E2E.
"""
from __future__ import annotations

from pathlib import Path

import pytest


FILES_DIR = Path(__file__).parent / "files"


@pytest.fixture(scope="session")
def test_csv_files() -> dict[str, Path]:
    """
    Retorna um dict com os paths dos arquivos CSV de teste.
    Chaves: 'mapa_minimal', 'mapa_mapping_required', 'contadores', 'papel', 'invalid'
    """
    return {
        "mapa_minimal": FILES_DIR / "mapa_test_minimal.csv",
        "mapa_mapping_required": FILES_DIR / "mapa_test_mapping_required.csv",
        "contadores": FILES_DIR / "contadores_test.csv",
        "papel": FILES_DIR / "papel_test.csv",
        "invalid": FILES_DIR / "invalid_format.pdf",
    }


@pytest.fixture(scope="session")
def mapa_minimal_csv() -> Path:
    """Path para o CSV de MAPA com colunas padrão."""
    return FILES_DIR / "mapa_test_minimal.csv"


@pytest.fixture(scope="session")
def mapa_mapping_required_csv() -> Path:
    """Path para o CSV de MAPA com colunas alternativas (requer mapeamento)."""
    return FILES_DIR / "mapa_test_mapping_required.csv"


@pytest.fixture(scope="session")
def contadores_csv() -> Path:
    """Path para o CSV de CONTADORES de teste."""
    return FILES_DIR / "contadores_test.csv"


@pytest.fixture(scope="session")
def papel_csv() -> Path:
    """Path para o CSV de PAPEL de teste."""
    return FILES_DIR / "papel_test.csv"
