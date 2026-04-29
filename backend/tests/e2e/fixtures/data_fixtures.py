"""
data_fixtures.py — Fixtures de dados de teste para os testes E2E.

Cria e destrói dados de teste via API do Playwright para garantir
isolamento entre testes.
"""
from __future__ import annotations

import os
import json
from dataclasses import dataclass
from typing import Generator

import pytest
from playwright.sync_api import Page, APIRequestContext


BASE_URL = os.environ.get("E2E_BASE_URL", "https://your-domain.com")
TEST_CONTRACT_ID = os.environ.get("E2E_TEST_CONTRACT_ID", "e2e-test-contract-2026")


@dataclass
class TestProtocol:
    """Dados de um protocolo de teste."""
    serie: str
    tipo: str = "Entrega"
    details: dict = None
    expected_stock_item: str = "A4 (RESMAS)"
    expected_stock_qty: int = 1

    def __post_init__(self):
        if self.details is None:
            self.details = {
                "solicitante": "E2E Test User",
                "a4": self.expected_stock_qty,
                "obs": "Protocolo criado por teste E2E",
            }


def _get_auth_token(request: APIRequestContext, username: str, password: str) -> str:
    """Obtém um token JWT via API."""
    resp = request.post(
        f"{BASE_URL}/api/auth/token",
        form={"username": username, "password": password},
    )
    if resp.ok:
        return resp.json().get("access_token", "")
    return ""


def _api_headers(token: str) -> dict:
    """Retorna headers com autenticação JWT."""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "X-Contract-ID": TEST_CONTRACT_ID,
    }


@pytest.fixture
def test_protocol_data() -> TestProtocol:
    """Retorna dados padrão para um protocolo de teste."""
    return TestProtocol(
        serie="E2E-SN001",
        tipo="Entrega",
        details={
            "solicitante": "E2E Test User",
            "a4": 1,
            "obs": "Protocolo criado por teste E2E",
        },
        expected_stock_item="A4 (RESMAS)",
        expected_stock_qty=1,
    )


@pytest.fixture
def created_protocol(page: Page, test_protocol_data: TestProtocol) -> Generator[int, None, None]:
    """
    Cria um protocolo de teste via API e faz cleanup após o teste.
    Retorna o protocol_id criado.
    """
    token = page.evaluate("localStorage.getItem('token')") or ""
    if not token:
        pytest.skip("Usuário não autenticado — fixture created_protocol requer autenticação")

    headers = _api_headers(token)

    # Criar protocolo
    resp = page.request.post(
        f"{BASE_URL}/api/data/entregas",
        data=json.dumps({
            "serie": test_protocol_data.serie,
            "solicitante": test_protocol_data.details.get("solicitante", "E2E"),
            "a4": test_protocol_data.details.get("a4", 1),
            "obs": test_protocol_data.details.get("obs", ""),
        }),
        headers=headers,
    )

    if not resp.ok:
        pytest.skip(f"Não foi possível criar protocolo de teste: {resp.status}")

    protocol_id = resp.json().get("protocol_id") or resp.json().get("id")
    yield protocol_id

    # Cleanup: cancelar protocolo se ainda pendente
    try:
        page.request.post(
            f"{BASE_URL}/api/data/entregas/{protocol_id}/cancel",
            data=json.dumps({"reason": "cleanup e2e"}),
            headers=headers,
        )
    except Exception:
        pass


@pytest.fixture
def stock_balance_before(page: Page) -> Generator[dict, None, None]:
    """
    Captura o saldo de estoque antes do teste.
    Retorna dict {item_name: balance}.
    """
    token = page.evaluate("localStorage.getItem('token')") or ""
    headers = _api_headers(token)

    resp = page.request.get(
        f"{BASE_URL}/api/stock/",
        headers=headers,
    )

    balances = {}
    if resp.ok:
        items = resp.json()
        for item in items:
            name = item.get("TipoModelo") or item.get("tipo_modelo", "")
            balance = item.get("EstoqueAtual") or item.get("estoque_atual", 0)
            if name:
                balances[name] = int(float(str(balance or 0)))

    yield balances
