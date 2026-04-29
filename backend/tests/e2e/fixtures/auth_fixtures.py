"""
auth_fixtures.py — Fixtures e helpers de autenticação para os testes E2E.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass
class AuthState:
    """Estado de autenticação de um usuário."""
    username: str
    role: str          # "superadmin" | "admin" | "user"
    token: str = ""
    contracts: list[str] = field(default_factory=list)
    active_contract: str = ""


def get_credentials(role: str) -> dict:
    """
    Retorna as credenciais para o role especificado.
    Lê das variáveis de ambiente configuradas em .env.e2e.
    """
    role_map = {
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
    creds = role_map.get(role, {})
    if not creds.get("username") or not creds.get("password"):
        raise ValueError(
            f"Credenciais para role '{role}' não configuradas. "
            f"Verifique .env.e2e (E2E_{role.upper()}_USER e E2E_{role.upper()}_PASS)."
        )
    return creds


# Nomes de usuários válidos (para excluir do Hypothesis)
VALID_USERNAMES = [
    os.environ.get("E2E_SUPERADMIN_USER", "superadmin"),
    os.environ.get("E2E_ADMIN_USER", "admin_e2e"),
    os.environ.get("E2E_USER_USER", "user_e2e"),
]
