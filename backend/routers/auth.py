from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from datetime import timedelta
from typing import Optional
try:
    from .. import auth, users, config
except (ImportError, ValueError):
    import auth
    import users
    import config

router = APIRouter(prefix="/auth", tags=["auth"])

class RecoveryRequest(BaseModel):
    username: str
    recovery_key: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

@router.put("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    current_user: users.User = Depends(auth.get_current_active_user)
):
    # Verify old password
    user_data = users.get_user(current_user.username)
    if not auth.verify_password(req.old_password, user_data["password"]):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    
    # Update to new password
    new_hash = auth.get_password_hash(req.new_password)
    users.update_user(current_user.username, {"password": new_hash})
    
    return {"status": "success", "message": "Senha alterada com sucesso"}

@router.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    # Backwards compatible: auth logic verifies password
    # However, auth.py now relies on PBKDF2 context
    user = users.get_user(form_data.username)
    user_hash = user.get("password") if user else None
    
    if not user_hash or not auth.verify_password(form_data.password, user_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Extract route preference (default to /)
    init_route = user.get("initial_route", "/")
    role = user.get("role", "user")
    contracts = user.get("contracts", [])
    
    if role == "superadmin":
        try:
            from ..core.contracts import ContractsManager
        except (ImportError, ValueError):
            from core.contracts import ContractsManager
        mgr = ContractsManager()
        contracts = [c["id"] for c in mgr.list_contracts()]
    
    # Extract preferences
    theme = user.get("theme", "light")
    accent = user.get("accent", "indigo")
    avatar = user.get("avatar", "default")
    
    access_token_expires = timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={
            "sub": form_data.username, 
            "initial_route": init_route, 
            "role": role, 
            "contracts": contracts,
            "theme": theme,
            "accent": accent,
            "avatar": avatar
        }, 
        expires_delta=access_token_expires
    )
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "initial_route": init_route, 
        "role": role, 
        "contracts": contracts,
        "theme": theme,
        "accent": accent,
        "avatar": avatar
    }

@router.post("/recover-password")
async def recover_password(req: RecoveryRequest):
    user = users.get_user(req.username)
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
        
    hashed_key = user.get("recovery_key_hash")
    if not hashed_key:
        raise HTTPException(status_code=400, detail="Recovery not enabled for this user")
        
    if not auth.verify_password(req.recovery_key.strip(), hashed_key):
        raise HTTPException(status_code=400, detail="Invalid Recovery Key")
        
    # Key valid -> Reset Pwd
    new_hash = auth.get_password_hash(req.new_password)
    users.update_user(req.username, {"password": new_hash})
    
    return {"status": "success", "message": "Password reset successfully"}

@router.post("/regenerate-recovery-key")
async def regenerate_recovery_key(
    payload: dict,
    current_user: users.User = Depends(auth.get_current_active_user)
):
    # Verify password first
    user_data = users.get_user(current_user.username)
    if not auth.verify_password(payload.get("password"), user_data["password"]):
        raise HTTPException(status_code=400, detail="Senha incorreta")
    
    # Generate new key
    new_key = users.generate_recovery_key()
    hashed_key = auth.get_password_hash(new_key)
    
    users.update_user(current_user.username, {"recovery_key_hash": hashed_key})
    
    # Return raw key once
    return {"recovery_key": new_key}

class UpdateProfileRequest(BaseModel):
    initial_route: Optional[str] = None
    theme: Optional[str] = None
    accent: Optional[str] = None
    avatar: Optional[str] = None

@router.get("/me")
async def read_users_me(current_user: users.User = Depends(auth.get_current_active_user)):
    # Return full user info including preferences
    user_data = users.get_user(current_user.username)
    role = user_data.get("role")
    contracts = user_data.get("contracts", [])
    
    if role == "superadmin":
        try:
            from ..core.contracts import ContractsManager
        except (ImportError, ValueError):
            from core.contracts import ContractsManager
        mgr = ContractsManager()
        contracts = [c["id"] for c in mgr.list_contracts()]

    return {
        "username": current_user.username,
        "role": role,
        "initial_route": user_data.get("initial_route"),
        "contracts": contracts,
        "theme": user_data.get("theme", "light"),
        "accent": user_data.get("accent", "indigo"),
        "avatar": user_data.get("avatar", "default")
    }

@router.put("/me")
async def update_profile(
    req: UpdateProfileRequest,
    current_user: users.User = Depends(auth.get_current_active_user)
):
    updates = {}
    if req.initial_route:
        updates["initial_route"] = req.initial_route
    if req.theme:
        updates["theme"] = req.theme
    if req.accent:
        updates["accent"] = req.accent
    if req.avatar:
        updates["avatar"] = req.avatar
    
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    users.update_user(current_user.username, updates)
    return {"status": "success", "updated": updates}
