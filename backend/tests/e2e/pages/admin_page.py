"""
AdminPage — Page Object para o painel de administração (/admin).
"""
from __future__ import annotations

from playwright.sync_api import Locator

from .base_page import BasePage


class AdminPage(BasePage):
    """Page Object para /admin."""

    # ─── Locators ─────────────────────────────────────────────────────────────

    @property
    def users_tab(self) -> Locator:
        return self.page.get_by_role("tab", name="Usuários").or_(
            self.page.get_by_text("Usuários")
        ).first

    @property
    def contracts_tab(self) -> Locator:
        return self.page.get_by_role("tab", name="Contratos").or_(
            self.page.get_by_text("Contratos")
        ).first

    @property
    def new_contract_button(self) -> Locator:
        return self.page.get_by_role("button", name="Novo Contrato").or_(
            self.page.get_by_role("button", name="Criar Contrato")
        ).first

    @property
    def new_user_button(self) -> Locator:
        return self.page.get_by_role("button", name="Novo Usuário").or_(
            self.page.get_by_role("button", name="Criar Usuário")
        ).first

    # ─── Actions ──────────────────────────────────────────────────────────────

    def navigate_to_admin(self) -> None:
        """Navega para /admin."""
        self.navigate("/admin")

    def click_users_tab(self) -> None:
        """Clica na aba 'Usuários'."""
        self.users_tab.click()
        self.page.wait_for_load_state("networkidle")

    def click_contracts_tab(self) -> None:
        """Clica na aba 'Contratos'."""
        self.contracts_tab.click()
        self.page.wait_for_load_state("networkidle")

    def create_contract(self, data: dict) -> str:
        """
        Cria um novo contrato.
        data: dict com 'id', 'name', 'description'
        Retorna o contract_id criado.
        """
        self.click_contracts_tab()
        self.new_contract_button.click()
        self.page.wait_for_load_state("networkidle")

        # Preencher formulário
        for key, value in data.items():
            field = self.page.get_by_label(key.capitalize()).or_(
                self.page.locator(f"input[name='{key}'], textarea[name='{key}']")
            ).first
            if field.is_visible():
                field.fill(str(value))

        # Salvar
        self.page.get_by_role("button", name="Criar").or_(
            self.page.get_by_role("button", name="Salvar")
        ).first.click()
        self.page.wait_for_load_state("networkidle")

        return data.get("id", "")

    def list_contracts(self) -> list[dict]:
        """Retorna a lista de contratos visíveis."""
        self.click_contracts_tab()
        rows = self.page.locator(
            "[data-testid='contract-row'], .contract-item, "
            "tr[data-contract-id]"
        ).all()
        return [{"text": row.inner_text()} for row in rows]

    def associate_user(self, username: str, contract_id: str) -> None:
        """Associa um usuário a um contrato."""
        # Navegar para o usuário
        self.click_users_tab()
        user_row = self.page.locator(
            f"tr:has-text('{username}'), [data-username='{username}']"
        ).first
        edit_button = user_row.get_by_role("button", name="Editar").or_(
            user_row.locator("[data-testid='edit-btn']")
        ).first
        edit_button.click()
        self.page.wait_for_load_state("networkidle")

        # Adicionar contrato
        contract_input = self.page.get_by_label("Contratos").or_(
            self.page.locator("input[name='contracts']")
        ).first
        if contract_input.is_visible():
            contract_input.fill(contract_id)

        # Salvar
        self.page.get_by_role("button", name="Salvar").first.click()
        self.page.wait_for_load_state("networkidle")

    def get_contract_by_id(self, contract_id: str) -> Locator:
        """Retorna o locator do contrato com o ID especificado."""
        return self.page.locator(
            f"tr:has-text('{contract_id}'), "
            f"[data-contract-id='{contract_id}']"
        ).first
