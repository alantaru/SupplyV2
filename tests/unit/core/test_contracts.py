"""
Módulo de Testes: Contracts Manager (backend.core.contracts)
Descrição: Testes para gerenciamento de contratos, metadados e inicialização de arquivos.
Cobertura: ContractsManager class (create, list, update, get)
Idioma: PT-BR
"""
import pytest
import json
from backend.core.contracts import ContractsManager

@pytest.fixture
def manager(clean_fs):
    """Retorna uma instância limpa do gerenciador usando o FS isolado"""
    # fs_isolation monkeypatches CONTRACTS_DIR in backend.config/database
    # But ContractsManager uses default arg CONTRACTS_DIR imported at module level
    # We must instantiate it with the patched path or reload module.
    # Since fs_isolation patches backend.core.contracts.CONTRACTS_DIR via sys.modules trick or config?
    # fs_isolation patches config.CONTRACTS_DIR and database.CONTRACTS_DIR.
    # backend.core.contracts imports CONTRACTS_DIR from ..config.
    # If the module was already imported before patch, it holds the old value.
    # The safest way is to pass the path explicitly or reloading.
    
    # Getting the patched path from config (which IS patched in conftest)
    from backend import config
    return ContractsManager(contracts_dir=config.CONTRACTS_DIR)

@pytest.mark.unit
def test_create_contract(manager):
    """
    Cenário: Criar um novo contrato.
    Ação: Chamar create_contract.
    Resultado: Pasta criada, arquivos inicializados, config.json salvo.
    """
    meta = manager.create_contract("123", "Test Contract", "Desc")
    
    assert meta["id"] == "123"
    assert meta["name"] == "Test Contract"
    
    # Verificar Sistema de Arquivos
    contract_path = manager.base_dir / "123"
    assert contract_path.exists()
    assert (contract_path / "config.json").exists()
    assert (contract_path / "Entregas.csv").exists()
    
    # Verificar Conteúdo do JSON
    with open(contract_path / "config.json") as f:
        saved = json.load(f)
        assert saved["id"] == "123"

@pytest.mark.unit
def test_create_duplicate_contract_fails(manager):
    """
    Cenário: Criar um contrato com ID existente.
    Ação: Tentar criar duas vezes.
    Resultado: ValueError.
    """
    manager.create_contract("DUP", "Dup", "D")
    with pytest.raises(ValueError, match="already exists"):
        manager.create_contract("DUP", "Dup2", "D2")

@pytest.mark.unit
def test_list_contracts(manager):
    """
    Cenário: Listar contratos existentes.
    Ação: Criar 2 contratos e listar.
    Resultado: Lista deve conter os 2 contratos.
    """
    manager.create_contract("A", "Alpha", "D1")
    manager.create_contract("B", "Beta", "D2")
    
    lst = manager.list_contracts()
    ids = sorted([c["id"] for c in lst])
    assert ids == ["A", "B"]

@pytest.mark.unit
def test_update_contract(manager):
    """
    Cenário: Atualizar metadados do contrato.
    Ação: Alterar nome e status.
    Resultado: config.json atualizado.
    """
    manager.create_contract("UPD", "Old Name", "Old Desc")
    
    updated = manager.update_contract("UPD", {"name": "New Name", "status": "archived"})
    
    assert updated["name"] == "New Name"
    assert updated["status"] == "archived"
    
    # Persistência
    saved = manager.get_contract("UPD")
    assert saved["name"] == "New Name"
    assert saved["status"] == "archived"
