"""
Módulo de Testes: Auth Router (backend.routers.auth)
Descrição: Testes de integração para Login, e endpoints protegidos.
Cobertura: /token, /users/me
Idioma: PT-BR
"""
import pytest
from fastapi.testclient import TestClient

@pytest.mark.integration
def test_login_success(client: TestClient, fs_isolation):
    """
    Cenário: Login com credenciais válidas (admin/admin).
    Ação: POST /token.
    Resultado: 200 OK e access_token retornado.
    """
    # fs_isolation mocked users.json with admin:admin
    response = client.post("/auth/token", data={"username": "admin", "password": "admin"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

@pytest.mark.integration
def test_login_invalid(client: TestClient, fs_isolation):
    """
    Cenário: Login incorreto.
    Ação: POST /token com senha errada.
    Resultado: 401 Unauthorized.
    """
    response = client.post("/auth/token", data={"username": "admin", "password": "wrongpassword"})
    assert response.status_code == 401

@pytest.mark.integration
def test_read_users_me(client: TestClient, mock_auth_admin):
    """
    Cenário: Acessar dados do usuário atual.
    Ação: GET /users/me com token válido.
    Resultado: 200 OK e dados do admin.
    """
    response = client.get("/auth/me", headers=mock_auth_admin)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "admin"
    assert "role" in data

@pytest.mark.integration
def test_read_users_me_unauthorized(client: TestClient):
    """
    Cenário: Acessar dados sem token.
    Ação: GET /auth/me.
    Resultado: 401 Unauthorized.
    """
    response = client.get("/auth/me")
    assert response.status_code == 401
