"""
conftest.py — Configuração raiz dos testes do backend Supply 2026.

Exclui o diretório tests/e2e/ da coleta padrão do pytest.
Os testes E2E requerem Playwright instalado e servidor em execução.
Para rodar os testes E2E: pytest tests/e2e/ -m smoke
"""
collect_ignore_glob = ["e2e/*"]
