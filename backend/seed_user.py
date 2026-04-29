from backend import auth, users

def seed():
    username = "admin"
    password = "admin_password_change_me"
    
    print(f"Creating user {username}...")
    
    # Hash pwd
    pwd_hash = auth.get_password_hash(password)
    
    try:
        users.create_user(username, pwd_hash)
        print("User created successfully.")
    except Exception as e:
        print(f"Error: {e}")
        
if __name__ == "__main__":
    seed()
