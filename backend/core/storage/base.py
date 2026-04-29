from abc import ABC, abstractmethod
from typing import List

class StorageBackend(ABC):
    @abstractmethod
    def exists(self, key: str) -> bool:
        pass

    @abstractmethod
    def get_uri(self, key: str) -> str:
        """Returns string adaptable for pandas read/write (e.g. file://... or s3://...)"""
        pass
    
    @abstractmethod
    def list_files(self, prefix: str) -> List[str]:
        pass
        
    @abstractmethod
    def delete(self, key: str):
        pass

    def delete_prefix(self, prefix: str):
        """Delete ALL files under a prefix. Default: list_files + delete each."""
        for filename in self.list_files(prefix):
            self.delete(f"{prefix}/{filename}")
    
    @abstractmethod
    def ensure_dir(self, key: str):
        pass

    @abstractmethod
    def copy(self, source_key: str, dest_key: str):
        pass

    @abstractmethod
    def get_metadata(self, key: str) -> dict:
        """Returns {'last_modified': datetime, 'size': int}"""
        pass

    @abstractmethod
    def list_prefixes(self) -> List[str]:
        """Returns top-level prefixes (contract IDs) in the storage root."""
        pass
