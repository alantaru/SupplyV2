import boto3
from typing import List
from .base import StorageBackend

class S3Storage(StorageBackend):
    def __init__(self, bucket_name: str, region_name: str = 'us-east-1'):
        self.bucket_name = bucket_name
        self.s3_client = boto3.client('s3', region_name=region_name)
        self.bucket_uri = f"s3://{bucket_name}"

    def exists(self, key: str) -> bool:
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=key)
            return True
        except Exception:
            return False

    def get_uri(self, key: str) -> str:
        # s3://bucket/key
        # Ensure key doesn't have leading slash if bucket uri doesn't end with one
        clean_key = key.lstrip('/')
        return f"{self.bucket_uri}/{clean_key}"

    def list_files(self, prefix: str) -> List[str]:
        # Prefix should end with / for proper folder simulation
        if not prefix.endswith('/'):
            prefix += '/'
            
        try:
            # Use paginator to get ALL objects (not just first 1000)
            paginator = self.s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=self.bucket_name, Prefix=prefix)
            files = []
            for page in pages:
                for obj in page.get('Contents', []):
                    if obj['Key'] != prefix:
                        # Return relative path from prefix
                        files.append(obj['Key'][len(prefix):])
            return files
        except Exception:
            return []

    def delete_prefix(self, prefix: str):
        """Delete ALL objects under a prefix (recursive)."""
        if not prefix.endswith('/'):
            prefix += '/'
        try:
            paginator = self.s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=self.bucket_name, Prefix=prefix)
            for page in pages:
                objects = [{'Key': obj['Key']} for obj in page.get('Contents', [])]
                if objects:
                    self.s3_client.delete_objects(
                        Bucket=self.bucket_name,
                        Delete={'Objects': objects}
                    )
        except Exception:
            pass

    def delete(self, key: str):
        self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)

    def ensure_dir(self, key: str):
        # S3 is flat, no dirs needed, but we can check if "folder" prefix exists or just no-op
        pass

    def copy(self, source_key: str, dest_key: str):
        # S3 Server-side copy
        copy_source = {'Bucket': self.bucket_name, 'Key': source_key}
        self.s3_client.copy_object(CopySource=copy_source, Bucket=self.bucket_name, Key=dest_key)

    def get_metadata(self, key: str) -> dict:
        try:
            response = self.s3_client.head_object(Bucket=self.bucket_name, Key=key)
            return {
                'last_modified': response['LastModified'], # datetime
                'size': response['ContentLength']
            }
        except Exception:
            return {}

    def list_prefixes(self) -> List[str]:
        """Returns top-level prefixes (contract IDs) using S3 delimiter."""
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Delimiter="/"
            )
            prefixes = response.get("CommonPrefixes", [])
            # Strip trailing slash from each prefix
            return [p["Prefix"].rstrip("/") for p in prefixes]
        except Exception:
            return []
