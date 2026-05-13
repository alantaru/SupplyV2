"""
SettingsPage — Page Object para a tela de configurações (/settings).
Gerencia upload de arquivos base (MAPA, CONTADORES, PAPEL, etc.)
e mapeamento de colunas.
"""
from __future__ import annotations

from pathlib import Path

from playwright.sync_api import Locator

from .base_page import BasePage


class SettingsPage(BasePage):
    """Page Object para /settings."""

    # ─── Locators ─────────────────────────────────────────────────────────────

    def get_file_card(self, file_key: str) -> Locator:
        """Retorna o card de gerenciamento para o file_key especificado."""
        return self.page.locator(
            f"[data-file-key='{file_key}'], "
            f"[data-testid='file-card-{file_key}'], "
            f".file-card:has-text('{file_key}')"
        ).first

    def get_upload_input(self, file_key: str) -> Locator:
        """Retorna o input de upload para o file_key especificado."""
        card = self.get_file_card(file_key)
        return card.locator("input[type='file']").or_(
            self.page.locator(f"input[accept='.csv'][data-file-key='{file_key}']")
        ).first

    @property
    def column_mapping_modal(self) -> Locator:
        return self.page.locator(
            "[data-testid='column-mapping-modal'], "
            ".column-mapping-modal, "
            "[aria-label='Mapeamento de Colunas']"
        ).first

    @property
    def mapping_confirm_button(self) -> Locator:
        return self.page.get_by_role("button", name="Confirmar Mapeamento").or_(
            self.page.get_by_role("button", name="Confirmar")
        ).first

    # ─── Actions ──────────────────────────────────────────────────────────────

    def navigate_to_settings(self) -> None:
        """Navega para /settings."""
        self.navigate("/settings")

    def upload_file(self, file_key: str, file_path: Path) -> dict:
        """
        Faz upload de um arquivo CSV para o file_key especificado.
        Retorna dict com 'status' e 'message'.
        """
        # Interceptar a resposta da API de upload
        response_data = {}

        def handle_response(response):
            if f"/upload/csv/{file_key}" in response.url:
                try:
                    response_data.update(response.json())
                except Exception:
                    pass

        self.page.on("response", handle_response)

        # Clicar no botão de upload do card
        card = self.get_file_card(file_key)
        upload_button = card.get_by_role("button", name="Atualizar").or_(
            card.get_by_role("button", name="Upload")
        ).first

        # Usar file chooser para selecionar o arquivo
        with self.page.expect_file_chooser() as fc_info:
            upload_button.click()
        file_chooser = fc_info.value
        file_chooser.set_files(str(file_path))

        # Aguardar resposta da API
        self.page.wait_for_load_state("networkidle")
        self.page.remove_listener("response", handle_response)

        return response_data

    def get_upload_status(self, file_key: str) -> str:
        """
        Retorna o status do último upload para o file_key.
        Valores: 'success' | 'mapping_required' | 'error' | 'unknown'
        """
        # Verificar se o modal de mapeamento está aberto
        if self.column_mapping_modal.is_visible():
            return "mapping_required"

        # Verificar toast de sucesso
        try:
            success = self.page.locator(
                "text=sucesso, text=atualizado, text=importado"
            ).first
            if success.is_visible():
                return "success"
        except Exception:
            pass

        # Verificar toast de erro
        try:
            error = self.page.locator(
                "text=erro, text=falhou, text=inválido"
            ).first
            if error.is_visible():
                return "error"
        except Exception:
            pass

        return "unknown"

    def confirm_mapping(self, mapping: dict | None = None) -> None:
        """
        Confirma o mapeamento de colunas no ColumnMappingModal.
        Se mapping for fornecido, aplica os mapeamentos antes de confirmar.
        """
        # Aguardar modal abrir
        self.column_mapping_modal.wait_for(state="visible", timeout=10_000)

        if mapping:
            for canonical, input_col in mapping.items():
                # Selecionar o input_col para o canonical no modal
                select = self.page.locator(
                    f"select[data-canonical='{canonical}'], "
                    f"[data-testid='mapping-{canonical}']"
                ).first
                if select.is_visible():
                    select.select_option(input_col)

        # Clicar em confirmar
        self.mapping_confirm_button.click()
        self.page.wait_for_load_state("networkidle")

    def preview_file(self, file_key: str) -> None:
        """Abre o modal de preview do arquivo especificado."""
        card = self.get_file_card(file_key)
        preview_button = card.get_by_role("button", name="Visualizar").or_(
            card.get_by_role("button", name="Preview")
        ).first
        preview_button.click()
        self.page.wait_for_load_state("networkidle")

    def file_exists(self, file_key: str) -> bool:
        """Verifica se o arquivo especificado existe (foi carregado)."""
        card = self.get_file_card(file_key)
        # Verificar indicador de arquivo existente
        exists_indicator = card.locator(
            ".file-exists, [data-exists='true'], text=Atualizado em"
        ).first
        return exists_indicator.is_visible()
