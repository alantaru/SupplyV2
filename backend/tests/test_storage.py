import unittest
from unittest.mock import MagicMock, patch
import os
import sys

# Ensure backend path is in sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.core.storage.s3 import S3Storage
from backend.core.storage.local import LocalStorage

class TestStorageBackend(unittest.TestCase):
    
    def test_local_storage_crud(self):
        """Test LocalStorage Create, Read, Delete"""
        import tempfile
        import shutil
        from pathlib import Path
        
        # Setup
        temp_dir = Path(tempfile.mkdtemp())
        storage = LocalStorage(temp_dir)
        
        try:
            # Create (mimicked by ensuring dir and using path)
            key = "test_folder/test.txt"
            storage.ensure_dir(key)
            file_path = temp_dir / key
            with open(file_path, "w") as f:
                f.write("Hello Local")
            
            # Exists
            self.assertTrue(storage.exists(key))
            self.assertFalse(storage.exists("nonexistent.txt"))
            
            # Get URI
            uri = storage.get_uri(key)
            self.assertTrue(uri.endswith("test.txt"))
            
            # Metadata
            meta = storage.get_metadata(key)
            self.assertIn("size", meta)
            self.assertEqual(meta["size"], 11)
            
            # List Files
            files = storage.list_files("test_folder")
            self.assertIn("test.txt", files)
            
            # Copy
            storage.copy(key, "test_folder/copy.txt")
            self.assertTrue(storage.exists("test_folder/copy.txt"))
            
            # Delete
            storage.delete(key)
            self.assertFalse(storage.exists(key))
            
        finally:
            shutil.rmtree(temp_dir)

    @patch("boto3.client")
    def test_s3_storage_crud(self, mock_boto):
        """Test S3Storage logic (mocking boto3)"""
        mock_s3 = MagicMock()
        mock_boto.return_value = mock_s3
        
        storage = S3Storage("my-bucket")
        key = "folder/data.csv"
        
        # Exists (True case)
        mock_s3.head_object.return_value = {}
        self.assertTrue(storage.exists(key))
        mock_s3.head_object.assert_called_with(Bucket="my-bucket", Key=key)
        
        # Exists (False case)
        mock_s3.head_object.side_effect = Exception("404")
        self.assertFalse(storage.exists("missing"))
        
        # Get URI
        uri = storage.get_uri(key)
        self.assertEqual(uri, "s3://my-bucket/folder/data.csv")
        
        # List Files — returns relative paths from prefix (e.g. "file1.txt", "file2.txt")
        mock_s3.head_object.side_effect = None
        mock_s3.head_object.return_value = {}
        # Use paginator mock for list_files (new implementation uses paginator)
        mock_paginator = MagicMock()
        mock_s3.get_paginator.return_value = mock_paginator
        mock_paginator.paginate.return_value = [
            {'Contents': [
                {'Key': 'folder/file1.txt'},
                {'Key': 'folder/file2.txt'}
            ]}
        ]
        files = storage.list_files("folder")
        self.assertEqual(sorted(files), sorted(['file1.txt', 'file2.txt']))
        
        # Copy
        storage.copy(key, "backup/data.csv")
        mock_s3.copy_object.assert_called()
        
        # Delete
        storage.delete(key)
        mock_s3.delete_object.assert_called_with(Bucket="my-bucket", Key=key)

if __name__ == "__main__":
    unittest.main()
