import json
import sys
from pathlib import Path

# Ensure we can import auth for hashing
sys.path.append(str(Path(__file__).parent))
try:
    import auth
    import config
except ImportError:
    print("Error: Could not import auth or config. Run this from the backend directory.")
    sys.exit(1)

def repair_users():
    users_file = config.USERS_FILE
    print(f"Repairing {users_file}...")
    
    # Load current users
    users_data = {}
    if users_file.exists():
        with open(users_file, "r") as f:
            try:
                users_data = json.load(f)
            except Exception:
                users_data = {}

    # Define standard users with working passwords
    # Defaulting to 'admin' and 'tech2026' as examples
    
    # Superadmin
    if "admin" in users_data or not users_data:
        users_data["admin"] = {
            "password": auth.get_password_hash("admin"),
            "role": "superadmin",
            "contracts": ["TESTE"],
            "initial_route": "/equipment"
        }
        print("Updated 'admin' with valid hash.")

    # Maintenance
    if "manutencao" in users_data:
        users_data["manutencao"] = {
            "password": auth.get_password_hash("tech2026"),
            "role": "manutencao",
            "contracts": ["TESTE"],
            "initial_route": "/maintenance"
        }
        print("Updated 'manutencao' with valid hash.")

    # Fix roles for any other users that might have been migrated wrongly
    for u, data in users_data.items():
        if data.get("role") == "user":
            data["role"] = "insumos"
            print(f"Corrected role for user '{u}' to 'insumos'.")
        if data.get("role") == "admin" and u != "admin":
             # If they were migrated to admin by mistake in the previous turn
             data["role"] = "insumos"
             print(f"Downgraded '{u}' to 'insumos' (corrected from mistake).")

    with open(users_file, "w") as f:
        json.dump(users_data, f, indent=2)
    
    print("\nRepair complete. You should be able to login now.")
    print("Admin: admin / admin")
    print("Tech: manutencao / tech2026")

if __name__ == "__main__":
    repair_users()
