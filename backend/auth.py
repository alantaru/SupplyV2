from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
try:
    from .config import SECRET_KEY, ALGORITHM
    from . import config
    from . import users
except (ImportError, ValueError):
    from config import SECRET_KEY, ALGORITHM
    import config
    import users

# Crypto Context
# Switching to pbkdf2_sha256 to avoid bcrypt/passlib version conflicts
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user_data(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    """Returns the full user dictionary (username, role, etc)"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = users.get_user(username)
    if not user:
        raise credentials_exception
    
    # Inject username into dict for convenience
    user_data = user.copy()
    user_data["username"] = username
    return user_data

async def get_current_user(user_data: Dict[str, Any] = Depends(get_current_user_data)):
    """Backwards compatibility: returns username string"""
    return user_data["username"]

async def get_current_admin(user_data: Dict[str, Any] = Depends(get_current_user_data)):
    if user_data.get("role") not in ["admin", "superadmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return user_data

async def get_current_active_user(user_data: Dict[str, Any] = Depends(get_current_user_data)) -> users.User:
    """Enhanced to automatically handle default active_contract and superadmin privileges."""
    active = user_data.get("active_contract")
    all_contracts = user_data.get("contracts", [])
    role = user_data.get("role")
    
    # Admins and Superadmins implicitly have access to all contracts.
    # If they have no active contract, pick any.
    if role in ["admin", "superadmin"]:
        if not active:
            # We don't have a list of all contracts here easily, 
            # but we can at least not block them if they have none assigned.
            if all_contracts:
                active = all_contracts[0]
            else:
                active = config.DEFAULT_CONTRACT
            user_data["active_contract"] = active
    elif not active and all_contracts:
        active = all_contracts[0]
        user_data["active_contract"] = active
        
    return users.User(**user_data)
