"""
StockPage — Page Object para o módulo de estoque (/stock).
"""
from __future__ import annotations

from playwright.sync_api import Locator

from .base_page import BasePage


class StockPage(BasePage):
    """Page Object para /stock."""

    # ─── Locators ─────────────────────────────────────────────────────────────

    @property
    def items_list(self) -> Locator:
        return self.page.locator(
            "[data-testid='stock-list'], .stock-list, "
            "table[aria-label='Estoque']"
        ).first

    @property
    def new_item_button(self) -> Locator:
        return self.page.get_by_role("button", name="Novo Item").or_(
            self.page.get_by_role("button", name="Adicionar Item")
        ).first

    @property
    def adjust_modal(self) -> Locator:
        return self.page.locator(
            "[data-testid='adjust-modal'], "
            "[role='dialog']:has-text('Ajuste'), "
            ".modal:has-text('Ajuste Manual')"
        ).first

    @property
    def confirm_adjust_button(self) -> Locator:
        return self.adjust_modal.get_by_role("button", name="Confirmar").or_(
            self.adjust_modal.get_by_role("button", name="Salvar")
        ).first

    # ─── Actions ──────────────────────────────────────────────────────────────

    def navigate_to_stock(self) -> None:
        """Navega para /stock."""
        self.navigate("/stock")

    def get_item_row(self, item_name: str) -> Locator:
        """Retorna a linha do item especificado na lista."""
        return self.page.locator(
            f"tr:has-text('{item_name}'), "
            f"[data-item-name='{item_name}'], "
            f".stock-item:has-text('{item_name}')"
        ).first

    def get_item_balance(self, item_name: str) -> int:
        """Retorna o saldo atual do item especificado."""
        row = self.get_item_row(item_name)
        balance_cell = row.locator(
            "[data-testid='balance'], .balance, "
            "td[data-field='estoque_atual']"
        ).first
        try:
            text = balance_cell.inner_text().strip()
            return int(float(text.replace(",", ".")))
        except Exception:
            return 0

    def open_adjust_modal(self, item_name: str) -> None:
        """Abre o modal de ajuste manual para o item especificado."""
        row = self.get_item_row(item_name)
        adjust_button = row.get_by_role("button", name="Ajuste").or_(
            row.locator("[data-testid='adjust-btn']")
        ).first
        adjust_button.click()
        self.adjust_modal.wait_for(state="visible", timeout=5_000)

    def adjust_item(self, item_name: str, qty: int, reason: str = "") -> None:
        """Realiza um ajuste manual de estoque."""
        self.open_adjust_modal(item_name)

        # Preencher quantidade
        qty_input = self.adjust_modal.get_by_label("Quantidade").or_(
            self.adjust_modal.locator("input[name='qty'], input[type='number']")
        ).first
        qty_input.fill(str(qty))

        # Preencher motivo se fornecido
        if reason:
            reason_input = self.adjust_modal.get_by_label("Motivo").or_(
                self.adjust_modal.locator("input[name='reason'], textarea[name='reason']")
            ).first
            if reason_input.is_visible():
                reason_input.fill(reason)

        self.confirm_adjust_button.click()
        self.page.wait_for_load_state("networkidle")

    def create_item(self, data: dict) -> None:
        """Cria um novo item de estoque."""
        self.new_item_button.click()
        self.page.wait_for_load_state("networkidle")

        # Preencher formulário
        for key, value in data.items():
            field = self.page.get_by_label(key).or_(
                self.page.locator(f"input[name='{key}']")
            ).first
            if field.is_visible():
                field.fill(str(value))

        # Salvar
        self.page.get_by_role("button", name="Salvar").or_(
            self.page.get_by_role("button", name="Criar")
        ).first.click()
        self.page.wait_for_load_state("networkidle")

    def delete_item(self, item_name: str) -> None:
        """Deleta um item de estoque (com confirmação)."""
        row = self.get_item_row(item_name)
        delete_button = row.get_by_role("button", name="Excluir").or_(
            row.locator("[data-testid='delete-btn']")
        ).first
        delete_button.click()

        # Confirmar no modal
        confirm_modal = self.page.locator("[role='dialog']").first
        confirm_modal.wait_for(state="visible", timeout=5_000)
        confirm_modal.get_by_role("button", name="Confirmar").or_(
            confirm_modal.get_by_role("button", name="Excluir")
        ).first.click()
        self.page.wait_for_load_state("networkidle")

    def get_item_history(self, item_name: str) -> list[dict]:
        """Retorna o histórico de movimentações do item."""
        row = self.get_item_row(item_name)
        history_button = row.get_by_role("button", name="Histórico").or_(
            row.locator("[data-testid='history-btn']")
        ).first
        history_button.click()
        self.page.wait_for_load_state("networkidle")

        # Coletar linhas do histórico
        rows = self.page.locator(
            "[data-testid='history-row'], .history-row, "
            "tr[data-movement]"
        ).all()
        return [{"text": row.inner_text()} for row in rows]
