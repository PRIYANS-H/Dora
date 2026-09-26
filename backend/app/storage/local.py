import os
import shutil
from typing import BinaryIO
from app.storage.base import BaseStorageProvider, StorageResult

class LocalStorageProvider(BaseStorageProvider):
    def __init__(self, base_static_dir: str = None, base_url_prefix: str = "/static/uploads"):
        if base_static_dir is None:
            # Default to backend/static/uploads
            backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            self.base_dir = os.path.join(backend_dir, "static", "uploads")
        else:
            self.base_dir = base_static_dir
        self.base_url_prefix = base_url_prefix.rstrip("/")
        os.makedirs(self.base_dir, exist_ok=True)

    def save(self, file: BinaryIO, filename: str, subfolder: str = "media") -> StorageResult:
        target_dir = os.path.join(self.base_dir, subfolder)
        os.makedirs(target_dir, exist_ok=True)
        file_path = os.path.join(target_dir, filename)

        file.seek(0)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file, buffer)

        file_size = os.path.getsize(file_path)
        url = f"{self.base_url_prefix}/{subfolder}/{filename}"
        return StorageResult(file_path=file_path, url=url, file_name=filename, file_size=file_size)

    def delete(self, file_path: str) -> bool:
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
                return True
            except OSError:
                return False
        return False

    def get_url(self, file_path: str) -> str:
        # If already a URL or relative path
        if file_path.startswith("http://") or file_path.startswith("https://") or file_path.startswith("/"):
            return file_path
        rel = os.path.relpath(file_path, self.base_dir)
        rel_url = rel.replace("\\", "/")
        return f"{self.base_url_prefix}/{rel_url}"

# Default singleton instance
storage_provider = LocalStorageProvider()
