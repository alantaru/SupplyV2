import json
import secrets
import string
import threading
from typing import Optional, Dict, List, Any
from pydantic import BaseModel
try:
    from . import config
except (ImportError, ValueError):
    import config

# Thread lock for file operations (RLock allows reentrant locking)
_USERS_LOCK = threading.RLock()

# Type hint for User Dictionary

# Type hint for User Dictionary
UserDict = Dict[str, Any] # { "password": "...", "role": "...", ... }

class User(BaseModel):
    username: str
    role: str
    contracts: List[str]
    active_contract: Optional[str] = None
    initial_route: str = "/"
    theme: str = "light"
    accent: str = "indigo"
    avatar: str = "default"
    created_by: Optional[str] = None

def load_users() -> Dict[str, UserDict]:
    with _USERS_LOCK:
        if not config.USERS_FILE.exists():
            return {}
        try:
            with open(config.USERS_FILE, "r") as f:
                raw_users = json.load(f)

            # Migration Logic: Convert classic "username": "hash" to objects
            migrated = False
            normalized_users = {}

            for u, data in raw_users.items():
                if isinstance(data, str):
                    # Old format - migrate to Admin
                    normalized_users[u] = {
                        "password": data,
                        "role": "admin",
                        "contracts": [],
                        "recovery_key_hash": None,
                        "initial_route": "/admin" # Admins default to admin panel
                    }
                    migrated = True
                else:
                    # Ensure initial_route exists
                    if "initial_route" not in data:
                        data["initial_route"] = "/"
                        migrated = True
                    # Ensure new preference fields exist
                    if "theme" not in data:
                        data["theme"] = "light"
                        migrated = True
                    if "accent" not in data:
                        data["accent"] = "indigo"
                        migrated = True
                    if "avatar" not in data:
                        data["avatar"] = "default"
                        migrated = True
                    if "created_by" not in data:
                        # Legacy admin2 is global/superadmin created, others can be assumed superadmin created
                        data["created_by"] = "admin2" if u != "admin2" else None
                        migrated = True

                    normalized_users[u] = data

            if migrated:
                save_users(normalized_users)

            return normalized_users
        except Exception:
            return {}

def save_users(users: Dict[str, UserDict]):
    with _USERS_LOCK:
        with open(config.USERS_FILE, "w") as f:
            json.dump(users, f, indent=2)

def get_user(username: str) -> Optional[UserDict]:
    users = load_users()
    return users.get(username)

def get_user_password_hash(username: str) -> Optional[str]:
    user = get_user(username)
    if user:
        return user.get("password")
    return None

def create_user(username: str, password_hash: str, role: str = "user", contracts: List[str] = [], recovery_key_hash: Optional[str] = None, initial_route: str = "/", theme: str = "light", accent: str = "indigo", avatar: str = "default", created_by: Optional[str] = None):
    users = load_users()
    if username in users:
        raise ValueError("User already exists")
        
    users[username] = {
        "password": password_hash,
        "role": role,
        "contracts": contracts,
        "recovery_key_hash": recovery_key_hash,
        "initial_route": initial_route,
        "theme": theme,
        "accent": accent,
        "avatar": avatar,
        "created_by": created_by
    }
    save_users(users)

def update_user(username: str, updates: Dict[str, Any]):
    users = load_users()
    if username not in users:
        raise ValueError("User not found")
        
    users[username].update(updates)
    save_users(users)

def delete_user(username: str):
    users = load_users()
    if username in users:
        del users[username]
        save_users(users)

def generate_recovery_key() -> str:
    # Format: XXXX-XXXX
    chars = string.ascii_uppercase + string.digits
    part1 = ''.join(secrets.choice(chars) for _ in range(4))
    part2 = ''.join(secrets.choice(chars) for _ in range(4))
    return f"{part1}-{part2}"
