"""
ProtocolWizardPage — Page Object para o wizard de criação de protocolos.
Cobre as 3 etapas: Tipo → Equipamento → Detalhes.
"""
from __future__ import annotations

from playwright.sync_api import Page, Locator, expect

from .base_page import BasePage


class ProtocolWizardPage(BasePage):
    """Page Object para /wizard."""

    # ─── Locators ─────────────────────────────────────────────────────────────

    @property
    def step_indicator(self) -> Locator:
        return self.page.locator(
            "[data-testid='step-indicator'], .step-indicator, "
            "[aria-label='Progresso do wizard']"
        ).first

    @property
    def back_button(self) -> Locator:
        return self.page.get_by_role("button", name="Voltar").first

    @property
    def next_button(self) -> Locator:
        return self.page.get_by_role("button", name="Próximo").or_(
            self.page.get_by_role("button", name="Avançar")
        ).first

    @property
    def submit_button(self) -> Locator:
        return self.page.get_by_role("button", name="Criar Protocolo").or_(
            self.page.get_by_role("button", name="Confirmar")
        ).first

    @property
    def equipment_search_input(self) -> Locator:
        return self.page.get_by_placeholder("Buscar equipamento").or_(
            self.page.locator("input[data-testid='equipment-search']")
        ).first

    # ─── Actions ──────────────────────────────────────────────────────────────

    def navigate_to_wizard(self) -> None:
        """Navega para /wizard."""
        self.navigate("/wizard")

    def get_current_step(self) -> int:
        """Retorna o número da etapa atual (1, 2 ou 3)."""
        try:
            # Tentar ler do indicador de progresso
            indicator = self.step_indicator
            text = indicator.inner_text()
            for i in range(1, 4):
                if str(i) in text:
                    return i
        except Exception:
            pass

        # Fallback: verificar qual etapa está ativa
        for i in range(1, 4):
            step = self.page.locator(
                f"[data-step='{i}'][aria-current='step'], "
                f".step-{i}.active"
            ).first
            if step.is_visible():
                return i
        return 1

    def select_protocol_type(self, tipo: str) -> None:
        """Seleciona o tipo de protocolo na etapa 1."""
        self.page.get_by_text(tipo).or_(
            self.page.locator(f"[data-tipo='{tipo}']")
        ).first.click()
        self.page.wait_for_load_state("networkidle")

    def search_equipment(self, query: str) -> None:
        """Busca um equipamento pelo número de série ou fila."""
        self.equipment_search_input.fill(query)
        self.page.wait_for_load_state("networkidle")

    def select_equipment(self, serie: str) -> None:
        """Seleciona um equipamento da lista de resultados."""
        result = self.page.get_by_text(serie).or_(
            self.page.locator(f"[data-serie='{serie}']")
        ).first
        result.click()
        self.page.wait_for_load_state("networkidle")

    def fill_details(self, details: dict) -> None:
        """
        Preenche os campos da etapa 3 (detalhes do protocolo).
        details: dict com chaves como 'solicitante', 'a4', 'obs', etc.
        """
        field_map = {
            "solicitante": ["Solicitante", "solicitante"],
            "a4": ["A4", "Resmas A4"],
            "obs": ["Observações", "obs"],
            "solicitacao": ["Canal de Solicitação", "solicitacao"],
            "ramal": ["Ramal", "ramal"],
        }

        for key, value in details.items():
            labels = field_map.get(key, [key])
            for label in labels:
                try:
                    field = self.page.get_by_label(label).or_(
                        self.page.locator(f"input[name='{key}'], textarea[name='{key}']")
                    ).first
                    if field.is_visible():
                        field.fill(str(value))
                        break
                except Exception:
                    continue

    def submit(self) -> None:
        """Submete o formulário na etapa 3."""
        self.submit_button.click()
        self.page.wait_for_load_state("networkidle")

    def go_back(self) -> None:
        """Clica em 'Voltar' para retornar à etapa anterior."""
        self.back_button.click()
        self.page.wait_for_load_state("networkidle")

    def go_next(self) -> None:
        """Clica em 'Próximo' para avançar para a próxima etapa."""
        self.next_button.click()
        self.page.wait_for_load_state("networkidle")
