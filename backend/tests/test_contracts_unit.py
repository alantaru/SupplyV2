import pytest
from backend.core.contracts import ContractsManager
from backend import config

@pytest.fixture
def temp_contracts_dir(tmp_path, monkeypatch):
    # Setup temp contracts dir
    new_dir = tmp_path / "contracts"
    new_dir.mkdir()
    monkeypatch.setattr(config, "CONTRACTS_DIR", new_dir)

    # Reset storage singleton so it picks up the new CONTRACTS_DIR
    import backend.core.storage as storage_module
    from backend.core.storage.local import LocalStorage
    monkeypatch.setattr(storage_module, "_BACKEND_INSTANCE", LocalStorage(base_path=new_dir))

    yield new_dir

def test_create_contract(temp_contracts_dir):
    mgr = ContractsManager()
    mgr.create_contract("TEST_ID", "Test Name", "Test Desc")
    
    assert (temp_contracts_dir / "TEST_ID").exists()
    # Actual file is config.json, not metadata.json
    assert (temp_contracts_dir / "TEST_ID" / "config.json").exists()
    
    contract = mgr.get_contract("TEST_ID")
    assert contract["name"] == "Test Name"
    assert contract["id"] == "TEST_ID"

def test_delete_contract(temp_contracts_dir):
    mgr = ContractsManager()
    mgr.create_contract("DELETE_ME", "Delete", "Desc")
    assert (temp_contracts_dir / "DELETE_ME").exists()
    
    mgr.delete_contract("DELETE_ME")
    assert not (temp_contracts_dir / "DELETE_ME").exists()

def test_get_mappings_behavior(temp_contracts_dir):
    mgr = ContractsManager()
    mgr.create_contract("MAP_TEST", "Map", "Desc")
    mappings = mgr.get_mappings("MAP_TEST")
    
    # mappings.json is only created when first mapping is saved
    assert mappings == {}
    
    mgr.save_mapping("MAP_TEST", "MAPA", {"serie": "SerialNumber"})
    new_mappings = mgr.get_mappings("MAP_TEST")
    assert "MAPA" in new_mappings
    assert new_mappings["MAPA"]["serie"] == "SerialNumber"
