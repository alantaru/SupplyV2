"""
BasePage — Classe base para todos os Page Objects.

Centraliza operações comuns: navegação, espera, localStorage, requisições API.
"""
from __future__ import annotations

import os
from typing import Any

from playwright.sync_api import Page, Locator, APIResponse, expect


BASE_URL = os.environ.get("E2E_BASE_URL", "https://your-domain.com")


class BasePage:
    """Classe base herdada por todos os Page Objects."""

    def __init__(self, page: Page, base_url: str = BASE_URL):
        self.page = page
        self.base_url = base_url.rstrip("/")

    # ─── Navegação ────────────────────────────────────────────────────────────

    def navigate(self, path: str) -> None:
        """Navega para um path relativo ao base_url."""
        url = f"{self.base_url}{path}"
        self.page.goto(url)
        self.page.wait_for_load_state("networkidle")

    def wait_for_url(self, pattern: str, timeout: int = 10_000) -> None:
        """Aguarda a URL corresponder ao padrão."""
        self.page.wait_for_url(pattern, timeout=timeout)

    def current_path(self) -> str:
        """Retorna o path atual da URL (sem base_url)."""
        url = self.page.url
        return url.replace(self.base_url, "") or "/"

    # ─── Espera ───────────────────────────────────────────────────────────────

    def wait_for_toast(self, text: str, timeout: int = 8_000) -> Locator:
        """Aguarda e retorna um toast/notificação com o texto especificado."""
        # Tenta vários seletores comuns de toast
        for selector in [
            f"text={text}",
            f"[role='alert']:has-text('{text}')",
            f".toast:has-text('{text}')",
            f"[data-testid='toast']:has-text('{text}')",
        ]:
            try:
                locator = self.page.locator(selector).first
                locator.wait_for(state="visible", timeout=timeout)
                return locator
            except Exception:
                continue
        # Fallback: qualquer elemento com o texto
        locator = self.page.get_by_text(text).first
        locator.wait_for(state="visible", timeout=timeout)
        return locator

    def wait_for_loading_gone(self, timeout: int = 15_000) -> None:
        """Aguarda spinners/loading indicators desaparecerem."""
        for selector in [
            "[data-testid='loading']",
            ".loading",
            "[aria-label='Carregando']",
            ".spinner",
            "[role='progressbar']",
        ]:
            try:
                locator = self.page.locator(selector)
                if locator.count() > 0:
                    locator.wait_for(state="hidden", timeout=timeout)
            except Exception:
                pass

    def wait_for_network_idle(self, timeout: int = 10_000) -> None:
        """Aguarda a rede ficar ociosa."""
        self.page.wait_for_load_state("networkidle", timeout=timeout)

    # ─── localStorage ─────────────────────────────────────────────────────────

    def get_local_storage(self, key: str) -> str | None:
        """Lê um valor do localStorage."""
        return self.page.evaluate(f"localStorage.getItem('{key}')")

    def set_local_storage(self, key: str, value: str) -> None:
        """Define um valor no localStorage."""
        self.page.evaluate(f"localStorage.setItem('{key}', '{value}')")

    def clear_local_storage(self) -> None:
        """Limpa todo o localStorage."""
        self.page.evaluate("localStorage.clear()")

    def get_jwt_token(self) -> str | None:
        """Retorna o JWT token do localStorage."""
        return self.get_local_storage("token")

    def get_active_contract(self) -> str | None:
        """Retorna o contrato ativo do localStorage."""
        return self.get_local_storage("active_contract")

    # ─── Requisições API ──────────────────────────────────────────────────────

    def api_request(
        self,
        method: str,
        path: str,
        data: Any = None,
        headers: dict | None = None,
        **kwargs,
    ) -> APIResponse:
        """
        Realiza uma requisição à API usando o contexto do Playwright.
        Injeta automaticamente o token JWT se disponível.
        """
        url = f"{self.base_url}/api{path}"
        token = self.get_jwt_token()

        req_headers = {"Content-Type": "application/json"}
        if token:
            req_headers["Authorization"] = f"Bearer {token}"
        if headers:
            req_headers.update(headers)

        method = method.upper()
        if method == "GET":
            return self.page.request.get(url, headers=req_headers, **kwargs)
        elif method == "POST":
            return self.page.request.post(url, data=data, headers=req_headers, **kwargs)
        elif method == "PUT":
            return self.page.request.put(url, data=data, headers=req_headers, **kwargs)
        elif method == "DELETE":
            return self.page.request.delete(url, headers=req_headers, **kwargs)
        else:
            raise ValueError(f"Método HTTP não suportado: {method}")

    # ─── Helpers de Asserção ──────────────────────────────────────────────────

    def expect_url_contains(self, path: str) -> None:
        """Verifica que a URL atual contém o path especificado."""
        expect(self.page).to_have_url(f"**{path}**")

    def expect_visible(self, locator: Locator) -> None:
        """Verifica que o locator está visível."""
        expect(locator).to_be_visible()

    def expect_text(self, locator: Locator, text: str) -> None:
        """Verifica que o locator contém o texto especificado."""
        expect(locator).to_contain_text(text)
