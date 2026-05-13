"""
SolicitantesPage — Page Object para o módulo de solicitantes (/solicitantes).
"""
from __future__ import annotations

from playwright.sync_api import Locator

from .base_page import BasePage


class SolicitantesPage(BasePage):
    """Page Object para /solicitantes."""

    # ─── Locators ─────────────────────────────────────────────────────────────

    @property
    def solicitantes_list(self) -> Locator:
        return self.page.locator(
            "[data-testid='solicitantes-list'], .solicitantes-list, "
            "table[aria-label='Solicitantes']"
        ).first

    @property
    def new_solicitante_button(self) -> Locator:
        return self.page.get_by_role("button", name="Novo Solicitante").or_(
            self.page.get_by_role("button", name="Adicionar")
        ).first

    # ─── Actions ──────────────────────────────────────────────────────────────

    def navigate_to_solicitantes(self) -> None:
        """Navega para /solicitantes."""
        self.navigate("/solicitantes")

    def get_solicitante_row(self, nome: str) -> Locator:
        """Retorna a linha do solicitante com o nome especificado."""
        return self.page.locator(
            f"tr:has-text('{nome}'), "
            f"[data-nome='{nome}'], "
            f".solicitante-item:has-text('{nome}')"
        ).first

    def list_solicitantes(self) -> list[str]:
        """Retorna a lista de nomes de solicitantes visíveis."""
        rows = self.page.locator(
            "[data-testid='solicitante-row'], .solicitante-item, "
            "tr[data-solicitante]"
        ).all()
        return [row.inner_text().split("\n")[0].strip() for row in rows]

    def create_solicitante(self, nome: str, ramal: str = "", obs: str = "") -> None:
        """Cria um novo solicitante."""
        self.new_solicitante_button.click()
        self.page.wait_for_load_state("networkidle")

        # Preencher formulário
        self.page.get_by_label("Nome").fill(nome)
        if ramal:
            self.page.get_by_label("Ramal").fill(ramal)
        if obs:
            self.page.get_by_label("Observações").fill(obs)

        # Salvar
        self.page.get_by_role("button", name="Salvar").or_(
            self.page.get_by_role("button", name="Criar")
        ).first.click()
        self.page.wait_for_load_state("networkidle")

    def edit_solicitante(self, nome: str, updates: dict) -> None:
        """Edita um solicitante existente."""
        row = self.get_solicitante_row(nome)
        edit_button = row.get_by_role("button", name="Editar").or_(
            row.locator("[data-testid='edit-btn']")
        ).first
        edit_button.click()
        self.page.wait_for_load_state("networkidle")

        for key, value in updates.items():
            field = self.page.get_by_label(key).or_(
                self.page.locator(f"input[name='{key}']")
            ).first
            if field.is_visible():
                field.fill(str(value))

        self.page.get_by_role("button", name="Salvar").first.click()
        self.page.wait_for_load_state("networkidle")

    def delete_solicitante(self, nome: str) -> None:
        """Deleta um solicitante (com confirmação)."""
        row = self.get_solicitante_row(nome)
        delete_button = row.get_by_role("button", name="Excluir").or_(
            row.locator("[data-testid='delete-btn']")
        ).first
        delete_button.click()

        # Confirmar no modal
        modal = self.page.locator("[role='dialog']").first
        modal.wait_for(state="visible", timeout=5_000)
        modal.get_by_role("button", name="Confirmar").or_(
            modal.get_by_role("button", name="Excluir")
        ).first.click()
        self.page.wait_for_load_state("networkidle")

    def associate_equipment(self, nome: str, serie: str) -> None:
        """Associa um equipamento a um solicitante."""
        row = self.get_solicitante_row(nome)
        associate_button = row.get_by_role("button", name="Associar").or_(
            row.locator("[data-testid='associate-btn']")
        ).first
        associate_button.click()
        self.page.wait_for_load_state("networkidle")

        # Buscar e selecionar equipamento
        search = self.page.get_by_placeholder("Buscar série").or_(
            self.page.locator("input[name='serie']")
        ).first
        search.fill(serie)
        self.page.get_by_text(serie).first.click()

        # Confirmar
        self.page.get_by_role("button", name="Associar").or_(
            self.page.get_by_role("button", name="Confirmar")
        ).first.click()
        self.page.wait_for_load_state("networkidle")
