"""
conftest.py — Fixtures globais para a suíte E2E do Supply 2026.

Responsabilidades:
- Carregar variáveis de ambiente de .env.e2e
- Configurar timeout padrão do Playwright
- Capturar screenshot e trace ao falhar
- Fornecer páginas autenticadas por role (superadmin, admin, user)
"""
import os
import re
from datetime import datetime
from pathlib import Path

import pytest
from playwright.sync_api import Page, BrowserContext

# ─── Caminhos ────────────────────────────────────────────────────────────────

E2E_DIR = Path(__file__).parent
ARTIFACTS_DIR = E2E_DIR / "artifacts"
SCREENSHOTS_DIR = ARTIFACTS_DIR / "screenshots"
TRACES_DIR = ARTIFACTS_DIR / "traces"

# Garantir que os diretórios existem
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
TRACES_DIR.mkdir(parents=True, exist_ok=True)

# ─── Variáveis de Ambiente ────────────────────────────────────────────────────

def _load_env():
    """Carrega .env.e2e se existir, sem sobrescrever variáveis já definidas."""
    env_file = E2E_DIR / ".env.e2e"
    if env_file.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(env_file, override=False)
        except ImportError:
            # Fallback manual se python-dotenv não estiver instalado
            with open(env_file) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, _, value = line.partition("=")
                        os.environ.setdefault(key.strip(), value.strip())

_load_env()

BASE_URL = os.environ.get("E2E_BASE_URL", "https://your-domain.com")
DEFAULT_TIMEOUT = int(os.environ.get("E2E_DEFAULT_TIMEOUT", "10000"))
TEST_CONTRACT_ID = os.environ.get("E2E_TEST_CONTRACT_ID", "e2e-test-contract-2026")

CREDENTIALS = {
    "superadmin": {
        "username": os.environ.get("E2E_SUPERADMIN_USER", ""),
        "password": os.environ.get("E2E_SUPERADMIN_PASS", ""),
    },
    "admin": {
        "username": os.environ.get("E2E_ADMIN_USER", ""),
        "password": os.environ.get("E2E_ADMIN_PASS", ""),
    },
    "user": {
        "username": os.environ.get("E2E_USER_USER", ""),
        "password": os.environ.get("E2E_USER_PASS", ""),
    },
}


# ─── Fixtures de Configuração ─────────────────────────────────────────────────

@pytest.fixture(scope="session")
def base_url() -> str:
    """URL base do sistema Supply 2026."""
    return BASE_URL


@pytest.fixture(scope="session")
def test_contract_id() -> str:
    """ID do contrato de teste dedicado."""
    return TEST_CONTRACT_ID


@pytest.fixture(autouse=True)
def configure_page_timeout(page: Page):
    """Aplica timeout padrão a todas as operações do Playwright."""
    page.set_default_timeout(DEFAULT_TIMEOUT)
    yield


# ─── Captura de Artefatos ao Falhar ──────────────────────────────────────────

@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Captura screenshot e trace ao falhar em fase 'call'."""
    outcome = yield
    rep = outcome.get_result()

    if rep.when == "call" and rep.failed:
        page: Page | None = item.funcargs.get("page")
        if page is None:
            return

        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = re.sub(r"[^\w]", "_", item.nodeid)[:100]

        # Screenshot
        try:
            screenshot_path = SCREENSHOTS_DIR / f"{safe_name}_{ts}.png"
            page.screenshot(path=str(screenshot_path), full_page=True)
        except Exception:
            pass

        # Trace
        try:
            ctx: BrowserContext = page.context
            trace_path = TRACES_DIR / f"{safe_name}_{ts}.zip"
            ctx.tracing.stop(path=str(trace_path))
        except Exception:
            pass


# ─── Fixtures de Autenticação ─────────────────────────────────────────────────

def _do_login(page: Page, role: str) -> None:
    """Realiza login para o role especificado."""
    creds = CREDENTIALS[role]
    if not creds["username"] or not creds["password"]:
        pytest.skip(f"Credenciais para role '{role}' não configuradas em .env.e2e")

    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")

    # Preencher formulário de login
    page.get_by_label("Usuário").fill(creds["username"])
    page.get_by_label("Senha").fill(creds["password"])
    page.get_by_role("button", name="Entrar").click()

    # Aguardar redirecionamento pós-login
    page.wait_for_url(f"{BASE_URL}/**", timeout=15_000)


@pytest.fixture
def authenticated_superadmin(page: Page, context: BrowserContext) -> Page:
    """Página autenticada como superadmin."""
    context.tracing.start(screenshots=True, snapshots=True, sources=True)
    _do_login(page, "superadmin")
    yield page
    page.evaluate("localStorage.clear()")


@pytest.fixture
def authenticated_admin(page: Page, context: BrowserContext) -> Page:
    """Página autenticada como admin."""
    context.tracing.start(screenshots=True, snapshots=True, sources=True)
    _do_login(page, "admin")
    yield page
    page.evaluate("localStorage.clear()")


@pytest.fixture
def authenticated_user(page: Page, context: BrowserContext) -> Page:
    """Página autenticada como user."""
    context.tracing.start(screenshots=True, snapshots=True, sources=True)
    _do_login(page, "user")
    yield page
    page.evaluate("localStorage.clear()")


@pytest.fixture
def authenticated_page(page: Page, context: BrowserContext, request):
    """
    Fixture parametrizável: retorna página autenticada para o role especificado.
    Uso: @pytest.mark.parametrize('role', ['superadmin', 'admin', 'user'])
         def test_foo(authenticated_page_for_role, role): ...
    """
    role = getattr(request, "param", "admin")
    context.tracing.start(screenshots=True, snapshots=True, sources=True)
    _do_login(page, role)
    yield page
    page.evaluate("localStorage.clear()")


# ─── Fixture para Testes Lentos ───────────────────────────────────────────────

@pytest.fixture
def slow_page(page: Page, context: BrowserContext) -> Page:
    """Página com timeout estendido para fluxos completos (30s)."""
    page.set_default_timeout(30_000)
    context.tracing.start(screenshots=True, snapshots=True, sources=True)
    yield page
    page.evaluate("localStorage.clear()")


# ─── Fixture de API Helper ────────────────────────────────────────────────────

@pytest.fixture
def api(page: Page):
    """
    Helper para requisições diretas à API via Playwright.
    Usa o mesmo contexto de autenticação da página.
    """
    return page.request
