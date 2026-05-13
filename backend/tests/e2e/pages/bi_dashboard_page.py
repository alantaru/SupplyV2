"""
BIDashboardPage — Page Object para o BI Dashboard (/equipment/bi).
"""
from __future__ import annotations

from playwright.sync_api import Locator

from .base_page import BasePage


class BIDashboardPage(BasePage):
    """Page Object para /equipment/bi."""

    TABS = ["Visão Geral", "Entregas", "Insumos", "Equipamentos", "Estoque", "Operacional"]

    # ─── Locators ─────────────────────────────────────────────────────────────

    @property
    def loading_indicator(self) -> Locator:
        return self.page.locator(
            "[data-testid='bi-loading'], .bi-loading, "
            "[aria-label='Carregando BI']"
        ).first

    @property
    def close_button(self) -> Locator:
        return self.page.get_by_role("button", name="Fechar").or_(
            self.page.locator("[data-testid='bi-close'], .bi-close")
        ).first

    @property
    def tab_bar(self) -> Locator:
        return self.page.locator(
            "[role='tablist'], .bi-tabs, [data-testid='bi-tabs']"
        ).first

    @property
    def date_start_input(self) -> Locator:
        return self.page.get_by_label("Data Início").or_(
            self.page.locator("input[name='start_date'], input[type='date']:first-of-type")
        ).first

    @property
    def date_end_input(self) -> Locator:
        return self.page.get_by_label("Data Fim").or_(
            self.page.locator("input[name='end_date'], input[type='date']:last-of-type")
        ).first

    @property
    def apply_filter_button(self) -> Locator:
        return self.page.get_by_role("button", name="Aplicar").or_(
            self.page.get_by_role("button", name="Filtrar")
        ).first

    # ─── Actions ──────────────────────────────────────────────────────────────

    def navigate_to_bi(self) -> None:
        """Navega para /equipment/bi."""
        self.navigate("/equipment/bi")

    def wait_for_load(self) -> None:
        """Aguarda o BI Dashboard carregar completamente."""
        # Aguardar loading desaparecer
        try:
            self.loading_indicator.wait_for(state="hidden", timeout=20_000)
        except Exception:
            pass
        self.page.wait_for_load_state("networkidle")

    def click_tab(self, tab_name: str) -> None:
        """Clica em uma aba do BI Dashboard."""
        tab = self.page.get_by_role("tab", name=tab_name).or_(
            self.page.get_by_text(tab_name)
        ).first
        tab.click()
        self.page.wait_for_load_state("networkidle")
        self.wait_for_loading_gone()

    def get_active_tab_content(self) -> Locator:
        """Retorna o conteúdo da aba ativa."""
        return self.page.locator(
            "[role='tabpanel'][aria-selected='true'], "
            ".tab-content.active, "
            "[data-testid='bi-content']"
        ).first

    def apply_date_filter(self, start: str, end: str) -> None:
        """
        Aplica filtro de data no BI Dashboard.
        start, end: formato YYYY-MM-DD
        """
        self.date_start_input.fill(start)
        self.date_end_input.fill(end)
        self.apply_filter_button.click()
        self.page.wait_for_load_state("networkidle")
        self.wait_for_loading_gone()

    def close(self) -> None:
        """Fecha o BI Dashboard."""
        self.close_button.click()
        self.page.wait_for_load_state("networkidle")

    def has_error(self) -> bool:
        """Verifica se há mensagem de erro no BI Dashboard."""
        error_indicators = [
            "text=Erro ao carregar",
            "text=Falha ao buscar",
            "[data-testid='bi-error']",
            ".error-state",
        ]
        for selector in error_indicators:
            try:
                if self.page.locator(selector).first.is_visible():
                    return True
            except Exception:
                pass
        return False

    def has_empty_state(self) -> bool:
        """Verifica se o BI exibe estado vazio (sem dados)."""
        empty_indicators = [
            "text=Sem dados",
            "text=Nenhum dado",
            "[data-testid='empty-state']",
            ".empty-state",
        ]
        for selector in empty_indicators:
            try:
                if self.page.locator(selector).first.is_visible():
                    return True
            except Exception:
                pass
        return False
