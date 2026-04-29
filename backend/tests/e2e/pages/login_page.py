"""
LoginPage — Page Object para a tela de login do Supply 2026.
"""
from __future__ import annotations

from playwright.sync_api import Page, Locator, expect

from .base_page import BasePage


class LoginPage(BasePage):
    """Page Object para /login."""

    def __init__(self, page: Page, base_url: str = None):
        super().__init__(page, base_url or "")

    # ─── Locators ─────────────────────────────────────────────────────────────

    @property
    def username_input(self) -> Locator:
        return self.page.get_by_label("Usuário").or_(
            self.page.locator("input[name='username']")
        ).first

    @property
    def password_input(self) -> Locator:
        return self.page.get_by_label("Senha").or_(
            self.page.locator("input[name='password'], input[type='password']")
        ).first

    @property
    def submit_button(self) -> Locator:
        return self.page.get_by_role("button", name="Entrar").or_(
            self.page.locator("button[type='submit']")
        ).first

    @property
    def error_message(self) -> Locator:
        return self.page.locator(
            "[role='alert'], .error-message, [data-testid='login-error'], "
            "text=Usuário ou senha inválidos, text=Credenciais inválidas"
        ).first

    @property
    def forgot_password_link(self) -> Locator:
        return self.page.get_by_text("Esqueci minha senha").or_(
            self.page.get_by_role("link", name="Esqueci")
        ).first

    # ─── Actions ──────────────────────────────────────────────────────────────

    def navigate_to_login(self) -> None:
        """Navega para a tela de login."""
        self.page.goto(f"{self.base_url}/login")
        self.page.wait_for_load_state("networkidle")

    def login(self, username: str, password: str) -> None:
        """Preenche e submete o formulário de login."""
        self.username_input.fill(username)
        self.password_input.fill(password)
        self.submit_button.click()

    def login_and_wait_redirect(self, username: str, password: str) -> str:
        """
        Realiza login e aguarda o redirecionamento.
        Retorna a URL final após o redirecionamento.
        """
        self.login(username, password)
        # Aguarda sair de /login (redirecionamento bem-sucedido)
        self.page.wait_for_function(
            "() => !window.location.pathname.includes('/login')",
            timeout=15_000,
        )
        return self.page.url

    def get_error_text(self) -> str:
        """Retorna o texto da mensagem de erro exibida."""
        try:
            self.error_message.wait_for(state="visible", timeout=5_000)
            return self.error_message.inner_text()
        except Exception:
            return ""

    def click_forgot_password(self) -> None:
        """Clica no link 'Esqueci minha senha'."""
        self.forgot_password_link.click()
        self.page.wait_for_load_state("networkidle")

    def is_on_login_page(self) -> bool:
        """Verifica se a página atual é a tela de login."""
        return "/login" in self.page.url

    def expect_error_visible(self) -> None:
        """Verifica que a mensagem de erro está visível."""
        expect(self.error_message).to_be_visible()

    def expect_on_login_page(self) -> None:
        """Verifica que a URL atual é /login."""
        expect(self.page).to_have_url(f"**login**")
