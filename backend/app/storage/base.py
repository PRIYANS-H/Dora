from abc import ABC, abstractmethod
from typing import BinaryIO

class StorageResult:
    def __init__(self, file_path: str, url: str, file_name: str, file_size: int):
        self.file_path = file_path
        self.url = url
        self.file_name = file_name
        self.file_size = file_size

class BaseStorageProvider(ABC):
    @abstractmethod
    def save(self, file: BinaryIO, filename: str, subfolder: str = "media") -> StorageResult:
        """Save a file and return StorageResult with path and public URL."""
        pass

    @abstractmethod
    def delete(self, file_path: str) -> bool:
        """Delete a file given its stored path."""
        pass

    @abstractmethod
    def get_url(self, file_path: str) -> str:
        """Return public URL for a stored file path."""
        pass
