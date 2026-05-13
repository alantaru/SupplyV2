"""
DashboardPage — Page Object para o Dashboard principal do Supply 2026.
"""
from __future__ import annotations

from playwright.sync_api import Page, Locator, expect

from .base_page import BasePage


class DashboardPage(BasePage):
    """Page Object para / (Dashboard principal)."""

    # ─── Locators ─────────────────────────────────────────────────────────────

    @property
    def pending_protocols_list(self) -> Locator:
        return self.page.locator(
            "[data-testid='pending-list'], .pending-protocols, "
            "[aria-label='Pendências']"
        ).first

    @property
    def new_protocol_button(self) -> Locator:
        return self.page.get_by_role("button", name="Novo Protocolo").or_(
            self.page.get_by_role("link", name="Novo Protocolo")
        ).first

    @property
    def sidebar_logout_button(self) -> Locator:
        return self.page.get_by_role("button", name="Sair").or_(
            self.page.get_by_text("Sair")
        ).first

    @property
    def contract_switcher(self) -> Locator:
        return self.page.locator(
            "[data-testid='contract-switcher'], .contract-switcher, "
            "[aria-label='Trocar contrato']"
        ).first

    @property
    def header_avatar(self) -> Locator:
        return self.page.locator(
            "[data-testid='user-avatar'], .user-avatar, "
            "[aria-label='Perfil do usuário']"
        ).first

    # ─── Actions ──────────────────────────────────────────────────────────────

    def get_pending_count(self) -> int:
        """Retorna o número de protocolos pendentes na lista."""
        try:
            items = self.page.locator(
                "[data-testid='protocol-item'], .protocol-item, "
                "tr[data-protocol-id]"
            )
            return items.count()
        except Exception:
            return 0

    def click_new_protocol(self) -> None:
        """Clica no botão 'Novo Protocolo' e aguarda navegação."""
        self.new_protocol_button.click()
        self.page.wait_for_load_state("networkidle")

    def logout(self) -> None:
        """Realiza logout clicando em 'Sair' na sidebar."""
        self.sidebar_logout_button.click()
        # Aguarda redirecionamento para /login
        self.page.wait_for_url("**/login**", timeout=10_000)

    def switch_contract(self, contract_id: str) -> None:
        """Troca o contrato ativo via ContractSwitcher."""
        self.contract_switcher.click()
        self.page.get_by_text(contract_id).click()
        self.page.wait_for_load_state("networkidle")

    def get_protocol_by_id(self, protocol_id: int) -> Locator:
        """Retorna o locator do protocolo com o ID especificado."""
        return self.page.locator(
            f"[data-protocol-id='{protocol_id}'], "
            f"tr:has-text('{protocol_id}'), "
            f"[data-testid='protocol-{protocol_id}']"
        ).first

    def open_user_profile(self) -> None:
        """Abre o modal de perfil do usuário."""
        self.header_avatar.click()
        self.page.wait_for_load_state("networkidle")

    def is_logged_in(self) -> bool:
        """Verifica se o usuário está logado (token no localStorage)."""
        token = self.get_jwt_token()
        return bool(token)

    def wait_for_dashboard_load(self) -> None:
        """Aguarda o dashboard carregar completamente."""
        self.page.wait_for_load_state("networkidle")
        self.wait_for_loading_gone()
