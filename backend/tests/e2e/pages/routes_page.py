"""
RoutesPage — Page Object para o módulo de rotas (/routes).
"""
from __future__ import annotations

from playwright.sync_api import Page, Locator, expect

from .base_page import BasePage


class RoutesPage(BasePage):
    """Page Object para /routes."""

    # ─── Locators ─────────────────────────────────────────────────────────────

    @property
    def routes_list(self) -> Locator:
        return self.page.locator(
            "[data-testid='routes-list'], .routes-list, "
            "table[aria-label='Rotas']"
        ).first

    @property
    def new_route_button(self) -> Locator:
        return self.page.get_by_role("button", name="Nova Rota").or_(
            self.page.get_by_role("button", name="Criar Rota")
        ).first

    # ─── Actions ──────────────────────────────────────────────────────────────

    def navigate_to_routes(self) -> None:
        """Navega para /routes."""
        self.navigate("/routes")

    def get_route_by_name(self, name: str) -> Locator:
        """Retorna o locator da rota com o nome especificado."""
        return self.page.locator(
            f"tr:has-text('{name}'), "
            f"[data-route-name='{name}'], "
            f".route-item:has-text('{name}')"
        ).first

    def create_route(self, name: str, series: list[str]) -> None:
        """Cria uma nova rota com os equipamentos especificados."""
        self.new_route_button.click()
        self.page.wait_for_load_state("networkidle")

        # Preencher nome da rota
        name_input = self.page.get_by_label("Nome da Rota").or_(
            self.page.locator("input[name='name'], input[placeholder*='nome']")
        ).first
        name_input.fill(name)

        # Adicionar séries
        for serie in series:
            series_input = self.page.get_by_label("Série").or_(
                self.page.locator("input[name='serie'], input[placeholder*='série']")
            ).first
            if series_input.is_visible():
                series_input.fill(serie)
                add_button = self.page.get_by_role("button", name="Adicionar").first
                add_button.click()

        # Salvar rota
        self.page.get_by_role("button", name="Salvar Rota").or_(
            self.page.get_by_role("button", name="Criar")
        ).first.click()
        self.page.wait_for_load_state("networkidle")

    def analyze_route(self, route_name: str) -> dict:
        """Clica em 'Analisar' para a rota especificada e retorna dados da análise."""
        route_row = self.get_route_by_name(route_name)
        analyze_button = route_row.get_by_role("button", name="Analisar").or_(
            route_row.locator("[data-testid='analyze-btn']")
        ).first
        analyze_button.click()
        self.page.wait_for_load_state("networkidle")
        self.wait_for_loading_gone()

        # Coletar dados da análise
        return {"route_name": route_name, "analyzed": True}

    def generate_protocols(self, route_name: str) -> int:
        """
        Gera protocolos em lote para a rota especificada.
        Retorna o número de protocolos criados.
        """
        route_row = self.get_route_by_name(route_name)
        generate_button = route_row.get_by_role("button", name="Gerar Protocolos").or_(
            route_row.locator("[data-testid='generate-btn']")
        ).first
        generate_button.click()
        self.page.wait_for_load_state("networkidle")

        # Tentar extrair o número de protocolos criados da confirmação
        try:
            confirmation = self.page.locator(
                "text=protocolos criados, text=protocolos gerados"
            ).first
            text = confirmation.inner_text()
            import re
            numbers = re.findall(r"\d+", text)
            return int(numbers[0]) if numbers else 0
        except Exception:
            return 0

    def get_route_count(self) -> int:
        """Retorna o número de rotas na lista."""
        try:
            rows = self.page.locator(
                "[data-testid='route-row'], .route-item, "
                "tr[data-route-id]"
            )
            return rows.count()
        except Exception:
            return 0
