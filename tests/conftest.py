import pytest
import shutil
from fastapi.testclient import TestClient
from datetime import timedelta

# Import app logic securely
from backend.main import app
from backend import config, database, auth
from backend.core.services import route as route_service_module

@pytest.fixture(scope="session")
def fs_isolation(tmp_path_factory):
    """
    Isolate filesystem tests.
    Creates a temporary directory for DATA_DIR and CONTRACTS_DIR.
    Monkeypatches database and config modules.
    """
    # Create temp structure
    base_temp = tmp_path_factory.mktemp("supply_data")
    data_dir = base_temp / "data"
    contracts_dir = base_temp / "contracts"
    users_file = base_temp / "users.json"
    
    data_dir.mkdir()
    contracts_dir.mkdir()
    
    # Create dummy users.json
    dummy_users = {
        "admin": {"username": "admin", "password": auth.get_password_hash("admin"), "role": "admin", "contracts": [], "active_contract": "6071"},
        "user": {"username": "user", "password": auth.get_password_hash("user"), "role": "user", "contracts": ["6071"], "active_contract": "6071"}
    }
    import json
    with open(users_file, "w") as f:
        json.dump(dummy_users, f)

    # Monkeypatch GLOBAL vars
    # We must patch where they are USED, not just defined, if imported via 'from'
    
    # Patch database module
    database.DATA_DIR = data_dir
    database.CONTRACTS_DIR = contracts_dir
    
    # Patch config module — direct assignment on the module object ensures all
    # code that does `config.CONTRACTS_DIR` sees the temp path, regardless of
    # how the module was imported (relative or absolute).
    config.DATA_DIR = data_dir
    config.CONTRACTS_DIR = contracts_dir
    config.USERS_FILE = users_file

    # Also patch via sys.modules to cover any module that imported config before
    # this fixture ran (e.g. route.py which does `from ... import config`)
    import sys
    for mod_name, mod in list(sys.modules.items()):
        if mod is not None and hasattr(mod, 'CONTRACTS_DIR'):
            # Only patch modules that are our config (same object or same path)
            if getattr(mod, 'CONTRACTS_DIR', None) is not None:
                try:
                    # Check if it's our config by looking for SECRET_KEY
                    if hasattr(mod, 'SECRET_KEY') and hasattr(mod, 'DEFAULT_CONTRACT'):
                        mod.CONTRACTS_DIR = contracts_dir
                        mod.DATA_DIR = data_dir
                        if hasattr(mod, 'USERS_FILE'):
                            mod.USERS_FILE = users_file
                except Exception:
                    pass

    monkeypatch = pytest.MonkeyPatch()

    # Reset storage singleton so it picks up the new CONTRACTS_DIR
    import backend.core.storage as storage_module
    from backend.core.storage.local import LocalStorage
    storage_module._BACKEND_INSTANCE = LocalStorage(base_path=contracts_dir)
    
    # Reload users to ensure new path is used
    from backend import users
    
    # Reload users cached_users list
    users._users_cache = None
    users.load_users()
    
    return base_temp

@pytest.fixture
def clean_fs(fs_isolation):
    """
    Clean up contracts dir between tests if needed, 
    but keeps the base isolation.
    """
    yield fs_isolation
    # Wipe contracts directory content after yield
    from backend import database
    # Safe delete content
    for item in database.CONTRACTS_DIR.iterdir():
        if item.is_dir():
            shutil.rmtree(item)
        else:
            item.unlink()

@pytest.fixture
def mock_auth_admin():
    """Returns headers for Admin user"""
    access_token = auth.create_access_token(
        data={"sub": "admin"}, expires_delta=timedelta(minutes=30)
    )
    return {"Authorization": f"Bearer {access_token}"}

@pytest.fixture
def mock_auth_user():
    """Returns headers for Standard user"""
    access_token = auth.create_access_token(
        data={"sub": "user"}, expires_delta=timedelta(minutes=30)
    )
    return {"Authorization": f"Bearer {access_token}"}

@pytest.fixture
def client(fs_isolation):
    """FastAPI Test Client with FS isolation enabled"""
    with TestClient(app) as c:
        yield c

@pytest.fixture
def sample_csvs(tmp_path):
    """Generates sample CSV files for testing"""
    
    def _create_csv(filename, content):
        p = tmp_path / filename
        with open(p, "w", encoding="utf-8-sig") as f:
            f.write(content)
        return p
        
    return {
        "valid_mapa": lambda: _create_csv("mapa_valid.csv", "Cod. Contrato;Contrato\n2965;Contract A\n2966;Contract B"),
        "invalid_sep": lambda: _create_csv("invalid.csv", "Col1,Col2\nVal1,Val2"), # Comma instead of semicolon
        "empty": lambda: _create_csv("empty.csv", ""),
    }
