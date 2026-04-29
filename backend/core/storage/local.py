import os
import shutil
from pathlib import Path
from typing import List
from .base import StorageBackend

class LocalStorage(StorageBackend):
    def __init__(self, base_path: Path):
        self.base_path = base_path
        self.base_path.mkdir(parents=True, exist_ok=True)

    def exists(self, key: str) -> bool:
        return (self.base_path / key).exists()

    def get_uri(self, key: str) -> str:
        # Return absolute path for pandas, forcing string
        return str((self.base_path / key).resolve())

    def list_files(self, prefix: str) -> List[str]:
        target_dir = self.base_path / prefix
        if not target_dir.exists():
            return []
        return [f.name for f in target_dir.glob("*") if f.is_file()]

    def delete(self, key: str):
        target = self.base_path / key
        if target.exists():
            os.remove(target)

    def delete_prefix(self, prefix: str):
        """Delete ALL files under a prefix (recursive)."""
        target_dir = self.base_path / prefix
        if target_dir.exists():
            shutil.rmtree(target_dir)

    def ensure_dir(self, key: str):
        target = self.base_path / key
        target.parent.mkdir(parents=True, exist_ok=True)

    def copy(self, source_key: str, dest_key: str):
        src = self.base_path / source_key
        dst = self.base_path / dest_key
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.exists():
            shutil.copy2(src, dst)

    def get_metadata(self, key: str) -> dict:
        target = self.base_path / key
        if not target.exists():
            return {}
        stat = target.stat()
        from datetime import datetime
        return {
            'last_modified': datetime.fromtimestamp(stat.st_mtime),
            'size': stat.st_size
        }

    def list_prefixes(self) -> List[str]:
        """Returns top-level subdirectory names (contract IDs)."""
        if not self.base_path.exists():
            return []
        return [d.name for d in self.base_path.iterdir() if d.is_dir()]
