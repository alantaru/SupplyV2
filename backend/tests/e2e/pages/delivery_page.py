"""
DeliveryPage — Page Object para a tela de entrega de protocolos.
"""
from __future__ import annotations

from playwright.sync_api import Page, Locator, expect

from .base_page import BasePage


class DeliveryPage(BasePage):
    """Page Object para /protocol/{id}/deliver e /history."""

    # ─── Locators ─────────────────────────────────────────────────────────────

    @property
    def deliver_button(self) -> Locator:
        return self.page.get_by_role("button", name="Confirmar Entrega").or_(
            self.page.get_by_role("button", name="Entregar")
        ).first

    @property
    def cancel_button(self) -> Locator:
        return self.page.get_by_role("button", name="Cancelar Protocolo").or_(
            self.page.get_by_role("button", name="Cancelar")
        ).first

    @property
    def confirmation_modal(self) -> Locator:
        return self.page.locator(
            "[data-testid='confirmation-modal'], "
            "[role='dialog']:has-text('Confirmar'), "
            ".modal:has-text('Cancelar')"
        ).first

    @property
    def confirm_cancel_button(self) -> Locator:
        """Botão de confirmação dentro do modal de cancelamento."""
        return self.confirmation_modal.get_by_role("button", name="Confirmar").or_(
            self.confirmation_modal.get_by_role("button", name="Sim")
        ).first

    @property
    def history_list(self) -> Locator:
        return self.page.locator(
            "[data-testid='history-list'], .history-list, "
            "table[aria-label='Histórico']"
        ).first

    @property
    def export_csv_button(self) -> Locator:
        return self.page.get_by_role("button", name="Exportar CSV").or_(
            self.page.get_by_role("button", name="Exportar")
        ).first

    # ─── Actions ──────────────────────────────────────────────────────────────

    def navigate_to_deliver(self, protocol_id: int) -> None:
        """Navega para a tela de entrega do protocolo."""
        self.navigate(f"/protocol/{protocol_id}/deliver")

    def navigate_to_history(self) -> None:
        """Navega para o histórico de entregas."""
        self.navigate("/history")

    def fill_delivery_form(self, data: dict) -> None:
        """
        Preenche o formulário de entrega.
        data: dict com 'received_by', 'counter_final', etc.
        """
        field_map = {
            "received_by": ["Recebido Por", "receivedBy"],
            "counter_final": ["Contador Final", "counterFinal"],
            "funcionario": ["Funcionário", "funcionario"],
        }

        for key, value in data.items():
            labels = field_map.get(key, [key])
            for label in labels:
                try:
                    field = self.page.get_by_label(label).or_(
                        self.page.locator(f"input[name='{key}']")
                    ).first
                    if field.is_visible():
                        field.fill(str(value))
                        break
                except Exception:
                    continue

    def confirm_delivery(self) -> None:
        """Confirma a entrega do protocolo."""
        self.deliver_button.click()
        self.page.wait_for_load_state("networkidle")

    def cancel_delivery(self) -> None:
        """Inicia o cancelamento do protocolo (abre modal de confirmação)."""
        self.cancel_button.click()

    def confirm_cancellation(self) -> None:
        """Confirma o cancelamento no modal."""
        self.confirmation_modal.wait_for(state="visible", timeout=5_000)
        self.confirm_cancel_button.click()
        self.page.wait_for_load_state("networkidle")

    def get_protocol_status_in_history(self, protocol_id: int) -> str:
        """Retorna o status do protocolo no histórico."""
        row = self.page.locator(
            f"tr:has-text('{protocol_id}'), "
            f"[data-protocol-id='{protocol_id}']"
        ).first
        status_cell = row.locator(
            "[data-testid='status'], .status, td:last-child"
        ).first
        return status_cell.inner_text().strip().lower()

    def apply_filter(self, filter_type: str, value: str) -> None:
        """Aplica um filtro no histórico."""
        filter_input = self.page.get_by_label(filter_type).or_(
            self.page.locator(f"[data-filter='{filter_type}']")
        ).first
        filter_input.fill(value)
        self.page.wait_for_load_state("networkidle")

    def export_csv(self) -> None:
        """Clica em 'Exportar CSV' e aguarda o download."""
        with self.page.expect_download():
            self.export_csv_button.click()
