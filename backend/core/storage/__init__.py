from .base import StorageBackend
from .local import LocalStorage
from .s3 import S3Storage
try:
    from ... import config
except (ImportError, ValueError):
    import config
import os

_BACKEND_INSTANCE = None

def get_storage() -> StorageBackend:
    global _BACKEND_INSTANCE
    if _BACKEND_INSTANCE:
        return _BACKEND_INSTANCE
        
    storage_type = os.getenv("STORAGE_TYPE", "LOCAL").upper()
    
    if storage_type == "S3":
        bucket = os.getenv("S3_BUCKET_NAME", "supply-app-data-uz02095-production")
        _BACKEND_INSTANCE = S3Storage(bucket_name=bucket)
    else:
        # Default to Config.FILES_DIR or equivalent
        # For now, base is contracts root, but keys include contract_id/file.csv
        # So base should be config.CONTRACTS_DIR.parent (which is data_dir essentially)
        # Actually config.CONTRACTS_DIR is a Path object to 'contracts/'
        # Let's use config.CONTRACTS_DIR as base? 
        # Wait, get_data_path uses CONTRACTS_DIR / id / file
        # If storage base is CONTRACTS_DIR, then key is "id/file"
        _BACKEND_INSTANCE = LocalStorage(base_path=config.CONTRACTS_DIR)
        
    return _BACKEND_INSTANCE
