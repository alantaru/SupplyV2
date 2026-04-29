from backend import auth, users

def create_admin():
    username = "admin2"
    password = "1234"
    role = "admin"
    contract_id = "6070" 
    
    print(f"Creating user {username} with password {password}...")
    
    print(f"Creating user {username} with password {password}...")
    
    # Hash pwd
    pwd_hash = auth.get_password_hash(password)
    
    try:
        # Create user with Admin role and specific contract access
        users.create_user(
            username=username, 
            password_hash=pwd_hash, 
            role=role, 
            contracts=[contract_id],
            initial_route="/admin" # Best practice for admins
        )
        print("User created successfully.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    create_admin()
