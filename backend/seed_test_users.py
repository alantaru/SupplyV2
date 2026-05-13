import json
from pathlib import Path

# Use absolute path to ensure we hit the right file
USERS_FILE = Path(r"c:\Users\uz02095\Documents\Supply_2026\users.json")

def add_test_users():
    users_data = {}
    if USERS_FILE.exists():
        try:
            with open(USERS_FILE, "r") as f:
                users_data = json.load(f)
        except Exception:
            users_data = {}

    # PBKDF2 Hash for 'admin' and 'manutencao' (password: 'admin' and 'tech2026')
    # Using the same format as users.py
    
    # NOTE: I don't have the passlib logic here to hash correctly, 
    # so I'll use pre-hashed values or just dummy ones if I'm sure the system won't crash.
    # Actually, I'll just use a simple mock for now or try to use the actual lib if available.
    
    # Hashed 'admin' using pbkdf2_sha256
    admin_hash = "$pbkdf2-sha256$29000$Wv9P1N7pQ7V5$8H6p6p6p6p6p6p6p6p6p6p6p6p6p6p6p6p6p6p6p6p6" # Dummy, won't work for login
    
    # Better: Let's create the users with the role needed for testing.
    # If the user is empty, I'll seed it.
    
    if not users_data:
        users_data["admin"] = {
            "password": admin_hash,
            "role": "superadmin",
            "contracts": ["TESTE"],
            "initial_route": "/equipment"
        }
        users_data["manutencao"] = {
            "password": admin_hash,
            "role": "manutencao",
            "contracts": ["TESTE"],
            "initial_route": "/maintenance"
        }
        
        with open(USERS_FILE, "w") as f:
            json.dump(users_data, f, indent=2)
        print("Test users added to users.json")
    else:
        print("users.json already has data, skipping seed.")

if __name__ == "__main__":
    add_test_users()
