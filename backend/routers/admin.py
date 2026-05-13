from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Dict
from pydantic import BaseModel
try:
    from .. import auth, users, admin_logic
except (ImportError, ValueError):
    import auth
    import users
    import admin_logic

router = APIRouter(prefix="/admin", tags=["admin"])

class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str = "user" # admin | user
    contracts: List[str] = []
    initial_route: str = "/" # Default dashboard

class UpdateUserContractsRequest(BaseModel):
    contracts: List[str]

class UpdateUserRequest(BaseModel):
    contracts: List[str]
    initial_route: str

class CreateContractRequest(BaseModel):
    contract_id: str


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_admin_ids(contract: dict) -> List[str]:
    """Normalize legacy admin_id (str) → admin_ids (list)."""
    if "admin_ids" in contract:
        v = contract["admin_ids"]
        return v if isinstance(v, list) else [v]
    legacy = contract.get("admin_id", "")
    return [legacy] if legacy else []

def _admin_owns_contract(admin_username: str, contract: dict) -> bool:
    return admin_username in _get_admin_ids(contract)

def _get_user_admin_ids(user_data: dict) -> List[str]:
    """Normalize legacy created_by (str) → admin_ids (list) for users."""
    if "admin_ids" in user_data:
        v = user_data["admin_ids"]
        return v if isinstance(v, list) else [v]
    legacy = user_data.get("created_by", "")
    return [legacy] if legacy else []

def _admin_manages_user(admin_username: str, user_data: dict) -> bool:
    return admin_username in _get_user_admin_ids(user_data)

@router.get("/users")
async def list_users(admin_data: dict = Depends(auth.get_current_admin)):
    try:
        from ..core.services.admin import AdminService
    except (ImportError, ValueError):
        from core.services.admin import AdminService
    
    svc = AdminService(admin_data.get("username"), admin_data.get("role"))
    return svc.list_users()

@router.post("/users")
async def create_new_user(req: CreateUserRequest, admin: Dict = Depends(auth.get_current_admin)):
    if users.get_user(req.username):
        raise HTTPException(status_code=400, detail="User already exists")
        
    # [SECURITY] RBAC for User Creation
    requesting_role = admin.get("role", "admin")
    
    # Rule 1: Admins cannot create Superadmins
    if req.role == "superadmin" and requesting_role != "superadmin":
        raise HTTPException(status_code=403, detail="Permission Denied: Only Superadmins can create Superadmins.")
    
    # Rule 2: Admins can create Admins and Users (Allowed by default if condition above passes)
    
    pwd_hash = auth.get_password_hash(req.password)
    
    # Recovery Key Generation
    recovery_key = users.generate_recovery_key()
    recovery_hash = auth.get_password_hash(recovery_key)
    
    users.create_user(
        username=req.username,
        password_hash=pwd_hash,
        role=req.role,
        contracts=req.contracts,
        recovery_key_hash=recovery_hash,
        initial_route=req.initial_route,
        created_by=admin.get("username"),
        admin_ids=[admin.get("username")]  # new multi-admin field
    )
    
    return {
        "status": "success", 
        "username": req.username, 
        "recovery_key": recovery_key # Only shown ONCE
    }

@router.delete("/users/{username}")
async def delete_user(username: str, admin: Dict = Depends(auth.get_current_admin)):
    if username == admin["username"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")
    
    # [SECURITY] Protection Rules
    requesting_role = admin.get("role", "admin")
    target_user = users.get_user(username)
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    target_role = target_user.get("role", "user")
    
    PROTECTED_USERS = ["admin2"]
    if requesting_role != "superadmin":
        if username in PROTECTED_USERS or target_role == "superadmin":
            raise HTTPException(status_code=403, detail="Permission Denied: Cannot delete protected users or Superadmins.")
        if not _admin_manages_user(admin.get("username"), target_user):
            raise HTTPException(status_code=403, detail="Permission Denied: You can only delete users you manage.")

    users.delete_user(username)
    return {"status": "success"}

@router.put("/users/{username}/contracts")
async def update_user_contracts_deprecated(username: str, req: UpdateUserContractsRequest, admin: Dict = Depends(auth.get_current_admin)):
    # Kept for backward compat, but logic is merged into update_user
    users.update_user(username, {"contracts": req.contracts})
    return {"status": "success"}

@router.put("/users/{username}")
async def update_user(username: str, req: UpdateUserRequest, admin: Dict = Depends(auth.get_current_admin)):
    target_user = users.get_user(username)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    requesting_role = admin.get("role", "admin")
    requesting_username = admin.get("username")

    if requesting_role != "superadmin":
        target_role = target_user.get("role", "user")
        # Admins cannot edit other admins/superadmins unless they manage them
        if target_role in ("admin", "superadmin") and not _admin_manages_user(requesting_username, target_user) and username != requesting_username:
            raise HTTPException(status_code=403, detail="Permission Denied: You can only edit users you manage.")
        # For regular users: allow if admin manages them OR if all assigned contracts belong to admin
        if target_role == "user" and not _admin_manages_user(requesting_username, target_user) and username != requesting_username:
            try:
                from ..core.contracts import ContractsManager
            except (ImportError, ValueError):
                from core.contracts import ContractsManager
            mgr = ContractsManager()
            admin_contracts = {c.get("id") for c in mgr.list_contracts() if _admin_owns_contract(requesting_username, c)}
            if not set(req.contracts).issubset(admin_contracts):
                raise HTTPException(status_code=403, detail="Permission Denied: You can only assign contracts you own.")

    users.update_user(username, {
        "contracts": req.contracts,
        "initial_route": req.initial_route
    })
    return {"status": "success"}

@router.post("/contracts")
async def create_contract(
    req: dict = Body(...), # {id, name, description}
    admin: users.User = Depends(auth.get_current_active_user)
):
    try:
        from ..core.contracts import ContractsManager
    except (ImportError, ValueError):
        from core.contracts import ContractsManager
    mgr = ContractsManager()
    
    cid = req.get("id", "").strip()
    if not cid:
        raise HTTPException(status_code=400, detail="Invalid Contract ID")
    
    try:
        mgr.create_contract(cid, req.get("name", cid), req.get("description", ""), admin_id=admin.username)

        # Auto-associate the creator with the new contract
        user_contracts = admin.contracts
        if cid not in user_contracts:
            user_contracts.append(cid)
            users.update_user(admin.username, {"contracts": user_contracts})

        return {"status": "success", "contract_id": cid}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/contracts/{cid_path}")
async def update_contract(
    cid_path: str,
    req: dict = Body(...), # {name, description, status}
    admin: Dict = Depends(auth.get_current_admin)
):
    try:
        from ..core.contracts import ContractsManager
    except (ImportError, ValueError):
        from core.contracts import ContractsManager
    mgr = ContractsManager()
    
    current_contract = mgr.get_contract(cid_path)
    
    # Legacy contracts may not have config.json — check if they exist via storage
    if not current_contract:
        try:
            from .. import database
        except (ImportError, ValueError):
            import database
        storage = database.get_storage()
        # Check if any file exists under this contract prefix
        files = storage.list_files(cid_path)
        if not files:
            raise HTTPException(status_code=404, detail="Contract not found")
        # Auto-create config.json for legacy contract
        current_contract = {
            "id": cid_path,
            "name": cid_path,
            "description": "Legacy Contract",
            "created_at": "",
            "status": "active",
            "admin_id": admin.get("username")
        }
        import fsspec
        import json
        key = database.get_config_key(cid_path)
        storage.ensure_dir(key)
        with fsspec.open(storage.get_uri(key), "w", encoding="utf-8") as f:
            json.dump(current_contract, f, indent=4)
        
    if admin.get("role") != "superadmin" and not _admin_owns_contract(admin.get("username"), current_contract):
        raise HTTPException(status_code=403, detail="Permission Denied: You do not own this contract.")
    
    try:
        updated = mgr.update_contract(cid_path, req)
        
        # Rule: If status transitioned to 'inactive', unbind it from all users
        new_status = req.get("status", current_contract.get("status"))
        if new_status == "inactive" and current_contract.get("status") != "inactive":
            all_users = users.load_users()
            for u, data in all_users.items():
                if cid_path in data.get("contracts", []):
                    data["contracts"].remove(cid_path)
                    users.update_user(u, {"contracts": data["contracts"]})
                    
        return {"status": "success", "contract": updated}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/contracts/{cid_path}")
async def delete_contract(
    cid_path: str,
    admin: Dict = Depends(auth.get_current_admin)
):
    try:
        from ..core.contracts import ContractsManager
    except (ImportError, ValueError):
        from core.contracts import ContractsManager
    mgr = ContractsManager()
    
    current_contract = mgr.get_contract(cid_path)
    
    # Legacy contracts may not have config.json — check via storage
    if not current_contract:
        try:
            from .. import database
        except (ImportError, ValueError):
            import database
        storage = database.get_storage()
        files = storage.list_files(cid_path)
        if not files:
            raise HTTPException(status_code=404, detail="Contract not found")
        # Treat legacy contract as inactive (allow deletion)
        current_contract = {
            "id": cid_path,
            "status": "inactive",
            "admin_id": admin.get("username")
        }
        
    if admin.get("role") != "superadmin" and not _admin_owns_contract(admin.get("username"), current_contract):
        raise HTTPException(status_code=403, detail="Permission Denied: You do not own this contract.")

    if current_contract.get("status") != "inactive":
        raise HTTPException(status_code=400, detail="Only inactive contracts can be deleted.")
    
    try:
        mgr.delete_contract(cid_path)
        return {"status": "success"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/contracts")
async def list_contracts(admin: Dict = Depends(auth.get_current_admin)):
    try:
        from ..core.contracts import ContractsManager
    except (ImportError, ValueError):
        from core.contracts import ContractsManager
    mgr = ContractsManager()
    all_contracts = mgr.list_contracts()

    # Build superadmin set for filtering
    all_users_data = users.load_users()
    superadmin_usernames = {u for u, d in all_users_data.items() if d.get("role") == "superadmin"}

    if admin.get("role") != "superadmin":
        owned = [c for c in all_contracts if _admin_owns_contract(admin.get("username"), c)]
        # Strip superadmin names from admin_ids before returning to admin
        for c in owned:
            raw = _get_admin_ids(c)
            c["admin_ids"] = [a for a in raw if a not in superadmin_usernames]
        return owned

    # Superadmin: return everything with full admin_ids
    for c in all_contracts:
        c["admin_ids"] = _get_admin_ids(c)
    return all_contracts

@router.put("/contracts/{cid_path}/assign-admins")
async def assign_contract_admins(
    cid_path: str,
    req: dict = Body(...),  # {"admin_ids": ["user1", "user2"]}
    admin: Dict = Depends(auth.get_current_admin)
):
    """Superadmin-only: set the list of admins that own a contract."""
    if admin.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Permission Denied: Only Superadmins can manage contract ownership.")

    try:
        from ..core.contracts import ContractsManager
    except (ImportError, ValueError):
        from core.contracts import ContractsManager

    new_admin_ids = req.get("admin_ids", [])
    if not isinstance(new_admin_ids, list):
        raise HTTPException(status_code=400, detail="admin_ids must be a list")

    # Validate all target users exist and are admin/superadmin
    for aid in new_admin_ids:
        target = users.get_user(aid)
        if not target:
            raise HTTPException(status_code=404, detail=f"User '{aid}' not found")
        if target.get("role") not in ("admin", "superadmin"):
            raise HTTPException(status_code=400, detail=f"User '{aid}' is not an admin or superadmin")

    mgr = ContractsManager()
    current = mgr.get_contract(cid_path)
    if not current:
        raise HTTPException(status_code=404, detail="Contract not found")

    updated = mgr.update_contract(cid_path, {"admin_ids": new_admin_ids, "admin_id": new_admin_ids[0] if new_admin_ids else ""})
    updated["admin_ids"] = new_admin_ids
    return {"status": "success", "contract": updated}


@router.put("/users/{username}/assign-admins")
async def assign_user_admins(
    username: str,
    req: dict = Body(...),  # {"admin_ids": ["admin1", "admin2"]}
    admin: Dict = Depends(auth.get_current_admin)
):
    """Superadmin-only: set the list of admins that manage a user."""
    if admin.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Permission Denied: Only Superadmins can manage user admin assignments.")

    target_user = users.get_user(username)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    new_admin_ids = req.get("admin_ids", [])
    if not isinstance(new_admin_ids, list):
        raise HTTPException(status_code=400, detail="admin_ids must be a list")

    for aid in new_admin_ids:
        u = users.get_user(aid)
        if not u:
            raise HTTPException(status_code=404, detail=f"User '{aid}' not found")
        if u.get("role") not in ("admin", "superadmin"):
            raise HTTPException(status_code=400, detail=f"User '{aid}' is not an admin or superadmin")

    users.update_user(username, {
        "admin_ids": new_admin_ids,
        "created_by": new_admin_ids[0] if new_admin_ids else target_user.get("created_by", "")
    })
    return {"status": "success", "username": username, "admin_ids": new_admin_ids}

@router.get("/contracts/{contract_id}/status")
async def get_contract_status(contract_id: str, admin: Dict = Depends(auth.get_current_admin)):
    try:
        from .. import database
    except (ImportError, ValueError):
        import database
    
    storage = database.get_storage()
    
    # Check if contract exists — either via config.json OR via any files in the prefix
    has_config = storage.exists(database.get_config_key(contract_id))
    if not has_config:
        # Legacy contract: check if any files exist under this prefix
        files = storage.list_files(contract_id)
        if not files:
            raise HTTPException(status_code=404, detail="Contract not found")

    # Check files
    return {
        "contract_id": contract_id,
        "has_mapa": storage.exists(database.get_data_key("MAPA", contract_id)),
        "has_contadores": storage.exists(database.get_data_key("CONTADORES", contract_id)),
        "has_papel": storage.exists(database.get_data_key("PAPEL", contract_id)),
        "has_estoque_lancamentos": storage.exists(database.get_data_key("ESTOQUE_LANCAMENTOS", contract_id))
    }

@router.get("/contracts/{contract_id}/mappings")
async def get_contract_mappings(contract_id: str, admin: Dict = Depends(auth.get_current_admin)):
    try:
        from ..core.contracts import ContractsManager
    except (ImportError, ValueError):
        from core.contracts import ContractsManager
    mgr = ContractsManager()
    return mgr.get_mappings(contract_id)

@router.get("/contracts/{contract_id}/columns/{file_key}")
async def get_contract_columns(contract_id: str, file_key: str, admin: Dict = Depends(auth.get_current_admin)):
    from ..core.contracts import ContractsManager
    mgr = ContractsManager()
    
    req_cols = mgr.get_required_columns(file_key)
    opt_cols = mgr.get_optional_columns(file_key)
    
    return {
        "required": req_cols,
        "optional": opt_cols
    }

@router.get("/contracts/{contract_id}/files/{file_key}/headers")
async def get_contract_file_headers(contract_id: str, file_key: str, admin: Dict = Depends(auth.get_current_admin)):
    from ..core.contracts import ContractsManager
    mgr = ContractsManager()
    return {
        "headers": mgr.get_current_file_headers(contract_id, file_key)
    }

@router.put("/contracts/{contract_id}/mappings/{file_key}")
async def update_contract_mapping(
    contract_id: str, 
    file_key: str, 
    mapping: Dict[str, str] = Body(...), 
    admin: Dict = Depends(auth.get_current_admin)
):
    from ..core.contracts import ContractsManager
    mgr = ContractsManager()
    # Validate contract existence
    if not mgr.get_contract(contract_id):
         raise HTTPException(status_code=404, detail="Contract not found")
         
    mgr.save_mapping(contract_id, file_key, mapping)
    return {"status": "success"}
@router.post("/contracts/{contract_id}/reset")
async def reset_contract_db(
    contract_id: str,
    admin: Dict = Depends(auth.get_current_admin)
):
    """
    Virada de Período: arquiva Entregas/Estoque e reinicia com base limpa.
    """
    try:
        result = admin_logic.reset_contract_database(contract_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/contracts/{contract_id}/reset-backups")
async def list_reset_backups(
    contract_id: str,
    admin: Dict = Depends(auth.get_current_admin)
):
    """Lista os conjuntos de arquivos gerados por viradas de período."""
    return admin_logic.list_reset_backups(contract_id)

@router.get("/contracts/{contract_id}/reset-backups/download")
async def download_reset_backup(
    contract_id: str,
    filepath: str,
    admin: Dict = Depends(auth.get_current_admin)
):
    """Download de um arquivo específico de reset_backup."""
    import fsspec
    from fastapi.responses import StreamingResponse
    try:
        from .. import database
    except (ImportError, ValueError):
        import database

    full_key = f"{contract_id}/reset_backups/{filepath}"
    storage = database.get_storage()

    if not storage.exists(full_key):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")

    uri = storage.get_uri(full_key)
    filename = filepath.split('/')[-1]

    def iterfile():
        with fsspec.open(uri, "rb") as f:
            yield from f

    return StreamingResponse(
        iterfile(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ─── SUPERADMIN: Purge de Bases ──────────────────────────────────────────────

PURGEABLE_BASES = {
    "ENTREGAS":            {"label": "Histórico de Entregas",       "file": "Entregas.csv"},
    "MAPA":                {"label": "Base de Mapa (Equipamentos)",  "file": "Mapa.csv"},
    "CONTADORES":          {"label": "Base de Contadores",           "file": "Contadores.csv"},
    "PAPEL":               {"label": "Base de Papel",                "file": "Papel.csv"},
    "ESTOQUE":             {"label": "Estoque Atual",                "file": "Estoque.csv"},
    "ESTOQUE_LANCAMENTOS": {"label": "Histórico de Estoque",         "file": "EstoqueLancamentos.csv"},
    "SOLICITANTES":        {"label": "Base de Solicitantes",         "file": "Solicitantes.csv"},
    "ROTAS":               {"label": "Planejamento de Rotas",        "file": "Planejamento_Rotas.xlsx"},
}


@router.get("/superadmin/bases")
async def list_purgeable_bases(admin: Dict = Depends(auth.get_current_admin)):
    """Lista todas as bases purgáveis com status de existência por contrato."""
    if admin.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Acesso restrito ao Superadmin.")

    try:
        from .. import database
        from ..core.contracts import ContractsManager
    except (ImportError, ValueError):
        import database
        from core.contracts import ContractsManager

    storage = database.get_storage()
    mgr = ContractsManager()
    all_contracts = mgr.list_contracts()

    result = []
    for key, meta in PURGEABLE_BASES.items():
        base_info = {
            "key": key,
            "label": meta["label"],
            "file": meta["file"],
            "contracts": []
        }
        for contract in all_contracts:
            cid = contract.get("id") or contract.get("contract_id")
            if not cid:
                continue
            data_key = f"{cid}/{meta['file']}"
            exists = storage.exists(data_key)
            base_info["contracts"].append({
                "contract_id": cid,
                "contract_name": contract.get("name", cid),
                "exists": exists
            })
        result.append(base_info)

    return result


@router.delete("/superadmin/purge-base")
async def purge_base(
    contract_id: str,
    file_key: str,
    admin: Dict = Depends(auth.get_current_admin)
):
    """
    SUPERADMIN ONLY — Apaga permanentemente uma base de um contrato.
    O arquivo é deletado do storage (S3 ou local). Não há backup.
    """
    if admin.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Acesso restrito ao Superadmin.")

    if file_key not in PURGEABLE_BASES:
        raise HTTPException(status_code=400, detail=f"Base '{file_key}' não reconhecida.")

    try:
        from .. import database
        from ..core.contracts import ContractsManager
    except (ImportError, ValueError):
        import database
        from core.contracts import ContractsManager

    storage = database.get_storage()
    mgr = ContractsManager()

    if not mgr.get_contract(contract_id):
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")

    filename = PURGEABLE_BASES[file_key]["file"]
    data_key = f"{contract_id}/{filename}"

    if not storage.exists(data_key):
        return {"status": "not_found", "message": f"Base '{file_key}' não existe neste contrato."}

    storage.delete(data_key)

    # Também remove raw_headers se existir
    raw_key = f"{contract_id}/{file_key.upper()}_raw_headers.json"
    if storage.exists(raw_key):
        storage.delete(raw_key)

    return {
        "status": "success",
        "message": f"Base '{PURGEABLE_BASES[file_key]['label']}' do contrato '{contract_id}' apagada com sucesso.",
        "deleted_key": data_key
    }
