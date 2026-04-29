import json
import logging
from typing import Dict, Optional, Any
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Storage key for the cortex brain in the unified storage backend
CORTEX_STORAGE_KEY = "refinery/cortex_db.json"


class RefineryCortex:
    """
    The 'Brain' of the Refinery.
    Persists learned mappings using the unified storage backend (S3 or local).
    Falls back to local filesystem for backwards compatibility.
    """

    def __init__(self):
        try:
            from ... import config, database
        except (ImportError, ValueError):
            import config
            import database

        self._database = database
        self._config = config

        # Local fallback path (used when storage is unavailable or for legacy data)
        self._local_dir = Path(config.DATA_DIR) / "refinery"
        self._local_dir.mkdir(parents=True, exist_ok=True)
        self._local_file = self._local_dir / "cortex_db.json"

        self.memory = self._load_memory()

    def _load_memory(self) -> Dict:
        """Load from storage (primary) or local filesystem (fallback)."""
        import fsspec
        try:
            storage = self._database.get_storage()
            if storage.exists(CORTEX_STORAGE_KEY):
                uri = storage.get_uri(CORTEX_STORAGE_KEY)
                with fsspec.open(uri, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"Cortex: could not load from storage: {e}")

        # Fallback: local filesystem
        if self._local_file.exists():
            try:
                with open(self._local_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Cortex: failed to load local memory: {e}")

        return {"mappings": {}}

    def _save_memory(self):
        """Save to storage (primary) and local filesystem (fallback cache)."""
        import fsspec
        try:
            storage = self._database.get_storage()
            storage.ensure_dir(CORTEX_STORAGE_KEY)
            uri = storage.get_uri(CORTEX_STORAGE_KEY)
            with fsspec.open(uri, "w", encoding="utf-8") as f:
                json.dump(self.memory, f, indent=4, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"Cortex: could not save to storage: {e}")

        # Also write locally as cache/fallback
        try:
            with open(self._local_file, "w", encoding="utf-8") as f:
                json.dump(self.memory, f, indent=4, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Cortex: failed to save local memory: {e}")

    def get_mapping(self, input_column: Any) -> Optional[str]:
        """Retrieves a saved mapping for the given input column."""
        raw_key = str(input_column).lower().strip()
        return self.memory.get("mappings", {}).get(raw_key)

    def learn_mapping(self, input_column: Any, canonical_column: str, confidence: float = 1.0):
        """Learns and persists a new mapping."""
        raw_key = str(input_column).lower().strip()
        if not raw_key:
            return

        if "mappings" not in self.memory:
            self.memory["mappings"] = {}

        self.memory["mappings"][raw_key] = str(canonical_column)
        self._save_memory()
        logger.info(f"Cortex learned: '{raw_key}' -> '{canonical_column}'")


if __name__ == "__main__":
    pass
