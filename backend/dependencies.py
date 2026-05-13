from fastapi import Depends, HTTPException, Query
from typing import Optional
try:
    import auth
    from core.session import ContractSession
    from users import User
except (ImportError, ValueError):
    try:
        from . import auth
        from .core.session import ContractSession
        from .users import User
    except (ImportError, ValueError):
        import auth
        from core.session import ContractSession
        from users import User

async def get_authorized_session(
    contract_id: Optional[str] = Query(None),
    user: User = Depends(auth.get_current_active_user)
) -> ContractSession:
    """
    Dependency that:
    1. Authenticates the user.
    2. Validates if the user has access to the requested contract_id.
    3. Returns a ready-to-use ContractSession.
    
    If contract_id is not provided, tries to use user's active_contract.
    """
    
    target_id = contract_id
    
    # Fallback to active contract if not specified
    if not target_id:
        target_id = user.active_contract
        
    if not target_id:
        raise HTTPException(status_code=400, detail="Contract ID is required")
        
    # Admin Override: Admins can access any contract
    if user.role in ["admin", "superadmin"]:
        session = ContractSession(target_id)
        session.user = user
        return session
        
    # Access Control
    # Ensure user.contracts is a list
    user_contracts = user.contracts if isinstance(user.contracts, list) else []
    
    if target_id not in user_contracts:
        raise HTTPException(status_code=403, detail=f"Access denied to contract {target_id}")
        
    session = ContractSession(target_id)
    session.user = user
    return session
