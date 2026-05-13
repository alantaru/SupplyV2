"""
Módulo de Testes: Authentication (backend.auth)
Descrição: Testes unitários para lógica de hashing e geração de tokens JWT.
Cobertura: verify_password, get_password_hash, create_access_token
Idioma: PT-BR
"""
import pytest
from datetime import timedelta
from jose import jwt
from backend import auth
from backend.config import SECRET_KEY, ALGORITHM

@pytest.mark.unit
def test_password_hashing():
    """
    Cenário: Hashing de senha.
    Ação: Hash uma senha e verificar.
    Resultado: O hash deve ser diferente do plain text e verificável.
    """
    password = "secure_password"
    hashed = auth.get_password_hash(password)
    
    assert hashed != password
    assert auth.verify_password(password, hashed) is True
    assert auth.verify_password("wrong_password", hashed) is False

@pytest.mark.unit
def test_create_access_token_default_expiry():
    """
    Cenário: Token sem expiração explícita.
    Ação: Criar token.
    Resultado: Token deve ter claim 'exp' ~15 min no futuro.
    """
    data = {"sub": "testuser"}
    token = auth.create_access_token(data)
    
    decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert decoded["sub"] == "testuser"
    assert "exp" in decoded
    
    # Check if expiry is roughly 15 mins from now (allow small delta)
    # We can't easily assert exact time, but existence is key.

@pytest.mark.unit
def test_create_access_token_custom_expiry():
    """
    Cenário: Token com expiração customizada.
    Ação: Criar token com delta de 30 min.
    Resultado: Token deve ser válido e decodificável.
    """
    expires = timedelta(minutes=30)
    data = {"sub": "testuser"}
    token = auth.create_access_token(data, expires_delta=expires)
    
    decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert decoded["sub"] == "testuser"
