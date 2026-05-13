
import os
import sys
from pathlib import Path

# Setup paths to match the service
BASE_DIR = Path("/opt/supply")
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / "backend"))

import users
import config

print(f"Checking USERS_FILE: {config.USERS_FILE}")
print(f"Exists: {config.USERS_FILE.exists()}")
print(f"Size: {config.USERS_FILE.stat().st_size if config.USERS_FILE.exists() else 'N/A'}")

u = users.get_user("admin2")
print(f"get_user('admin2') result: {u is not None}")
if u:
    print(f"User role: {u.get('role')}")
    print(f"User contracts: {u.get('contracts')}")
else:
    all_users = users.load_users()
    print(f"All loaded users: {list(all_users.keys())}")
    
    # Check for hidden characters or case issues
    for k in all_users.keys():
        if k.strip().lower() == "admin2":
            print(f"FOUND MATCHING KEY: '{k}' (len={len(k)})")
