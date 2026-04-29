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

@router.get("/users")
async def list_users(admin: Dict = Depends(auth.get_current_admin)):
    all_users = users.load_users()
    # Return safe list (no passwords)
    safe_list = []
    
    requesting_role = admin.get("role", "admin") # admin or superadmin
    requesting_username = admin.get("username")
    
    for u, data in all_users.items():
        # [SECURITY] Admins cannot see Superadmins and can only see users they created (or themselves)
        if requesting_role != "superadmin":
            if data.get("role") == "superadmin":
                continue
            if u != requesting_username and data.get("created_by") != requesting_username:
                continue
                
        user_info = data.copy()
        user_info["username"] = u
        if "password" in user_info:
            del user_info["password"]
        if "recovery_key_hash" in user_info:
            del user_info["recovery_key_hash"]
        safe_list.append(user_info)
    return safe_list

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
        created_by=admin.get("username")
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
        if target_user.get("created_by") != admin.get("username"):
            raise HTTPException(status_code=403, detail="Permission Denied: You can only delete users you created.")

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
        
    if admin.get("role") != "superadmin" and target_user.get("created_by") != admin.get("username") and username != admin.get("username"):
        raise HTTPException(status_code=403, detail="Permission Denied: You can only edit users you created.")

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
        
    if admin.get("role") != "superadmin" and current_contract.get("admin_id") != admin.get("username"):
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
        
    if admin.get("role") != "superadmin" and current_contract.get("admin_id") != admin.get("username"):
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
    if admin.get("role") != "superadmin":
        return [c for c in all_contracts if c.get("admin_id") == admin.get("username")]
    return all_contracts

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
