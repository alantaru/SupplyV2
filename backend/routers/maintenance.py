from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from typing import List, Dict, Any
try:
    from ..core.session import ContractSession
    from ..dependencies import get_authorized_session
except (ImportError, ValueError):
    from core.session import ContractSession
    from dependencies import get_authorized_session
from datetime import datetime
import os
import fsspec
import database
import pandas as pd
import logging
import fsspec
import os

router = APIRouter(prefix="/maintenance", tags=["maintenance"])
logger = logging.getLogger(__name__)

# --- Preventive & OS ---

@router.get("/status")
async def get_maintenance_status(session: ContractSession = Depends(get_authorized_session)):
    return session.maintenance.get_preventive_status()

# --- NF Management (Simple Registration) ---

@router.get("/nf")
async def list_nfs(session: ContractSession = Depends(get_authorized_session)):
    try:
        return session.maintenance.get_nfs()
    except Exception as e:
        import traceback
        logger.error(f"Error in list_nfs: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/nf")
async def upload_nf(
    numero: str = Form(...),
    data: str = Form(...),
    fornecedor: str = Form(...),
    valor: float = Form(...),
    serie: str = Form(""),
    file: UploadFile = File(None),
    session: ContractSession = Depends(get_authorized_session)
):
    contract_id = session.contract_id
    service = session.maintenance
    
    filename = ""
    if file:
        # Save physical file
        ext = os.path.splitext(file.filename)[1]
        filename = f"NF_{numero}_{datetime.now().strftime('%Y%m%d%H%M%S')}{ext}"
        file_key = f"{contract_id}/nfs/{filename}"
        uri = database.get_storage().get_uri(file_key)
        
        content = await file.read()
        with fsspec.open(uri, "wb") as f:
            f.write(content)
        
    nf_data = {
        "Numero": numero,
        "Data": data,
        "Fornecedor": fornecedor,
        "Valor": valor,
        "Serie": serie,
        "Filename": filename
    }
    
    return service.save_nf(nf_data)

@router.delete("/nf/{filename}")
async def delete_nf(filename: str, session: ContractSession = Depends(get_authorized_session)):
    session.maintenance.delete_nf(filename)
    return {"status": "success", "message": "NF excluída."}

@router.get("/nf/download/{filename}")
async def download_nf(filename: str, session: ContractSession = Depends(get_authorized_session)):
    contract_id = session.contract_id
    safe_filename = os.path.basename(filename)
    file_key = f"{contract_id}/nfs/{safe_filename}"
    
    if not database.get_storage().exists(file_key):
        raise HTTPException(status_code=404, detail="NF não encontrada")
        
    return {"uri": database.get_storage().get_uri(file_key)}

# --- Divergences ---

@router.get("/divergences")
async def get_divergences(session: ContractSession = Depends(get_authorized_session)):
    return {"count": session.maintenance.get_divergences_count()}

@router.get("/divergences/list")
async def list_divergences(session: ContractSession = Depends(get_authorized_session)):
    df = session.maintenance._load_divergencias()
    if df.empty:
        return []
    return df.to_dict(orient='records')

@router.post("/os")
async def create_os(
    serie: str = Form(...),
    tipo_servico: str = Form(...),
    pecas: str = Form(""),
    contador: int = Form(...),
    mau_uso: bool = Form(False),
    serie_saindo: str = Form(""),
    parts_json: str = Form(None),
    files: List[UploadFile] = File(None),
    session: ContractSession = Depends(get_authorized_session)
):
    contract_id = session.contract_id
    service = session.maintenance
    
    evidencia_urls = []
    if files and mau_uso:
        for file in files:
            ext = os.path.splitext(file.filename)[1]
            filename = f"MAU_USO_{serie}_{datetime.now().strftime('%Y%m%d_%H%M%S')}{ext}"
            file_key = f"{contract_id}/evidencias/{filename}"
            uri = database.get_storage().get_uri(file_key)
            
            content = await file.read()
            with fsspec.open(uri, "wb") as f:
                f.write(content)
            evidencia_urls.append(filename)
    
    if serie_saindo and tipo_servico in ['AtivacaoBackup', 'Troca Tecnica', 'Movimentacao']:
        try:
            service.perform_equipment_swap(serie_saindo, serie, tipo_servico)
        except Exception as e:
            logger.warning(f"Auto-swap failed: {e}")
    
    if parts_json:
        import json
        try:
            selected_parts = json.loads(parts_json)
            for part in selected_parts:
                session.maintenance.update_part_stock(
                    cod_peca=part["Codigo"],
                    qtd=int(part["Qtd"]),
                    tipo="SAIDA",
                    os_id="PENDING", 
                    serie=serie,
                    usuario=session.user.username if hasattr(session, 'user') else "Sistema"
                )
        except Exception as e:
            logger.error(f"Error deducting parts: {e}")
    
    script_data = {
        "serie": serie,
        "serie_saindo": serie_saindo,
        "chamado": "PENDING", 
        "tipo": tipo_servico,
        "contador_pb": contador,
        "mau_uso": mau_uso,
        "evidencia_url": ", ".join(evidencia_urls) if evidencia_urls else "Coletadas no local"
    }
    script = service.generate_teams_script(tipo_servico, script_data)
    
    return {
        "status": "success",
        "message": "Ordem de Serviço registrada",
        "teams_script": script
    }

# --- Map Conflicts ---

@router.post("/resolve-map-conflicts")
async def resolve_conflicts(
    temp_token: str = Body(...),
    resolutions: List[Dict[str, Any]] = Body(...),
    session: ContractSession = Depends(get_authorized_session)
):
    contract_id = session.contract_id
    service = session.maintenance
    
    temp_official_key = f"temp/OFFICIAL_MAP_{temp_token}"
    if not database.get_storage().exists(temp_official_key):
        raise HTTPException(status_code=404, detail="Official map session expired")
    
    official_df = pd.read_csv(database.get_storage().get_uri(temp_official_key), sep=';', encoding='utf-8-sig')
    divergencias = service._load_divergencias()
    
    for res in resolutions:
        serie = res["Serie"]
        campo = res["Campo"]
        choice = res["Choice"]
        
        if choice == "TECNICO":
            div_row = divergencias[(divergencias["Serie"] == serie) & (divergencias["Campo"] == campo)]
            if not div_row.empty:
                valor_tecnico = div_row.iloc[0]["ValorTecnico"]
                official_df.loc[official_df["SERIE"] == serie, campo] = valor_tecnico
        else:
            divergencias = divergencias[~((divergencias["Serie"] == serie) & (divergencias["Campo"] == campo))]
    
    uri = database.get_data_uri("MAPA", contract_id)
    database.save_dataframe_csv(official_df, uri)
    service._save_divergencias(divergencias)
    
    return {"status": "success", "message": "Conflitos resolvidos e Mapa atualizado."}

@router.post("/manual-edit")
async def save_manual_edit(
    serie: str = Body(...),
    changes: Dict[str, Any] = Body(...),
    session: ContractSession = Depends(get_authorized_session)
):
    session.maintenance.save_manual_edit(serie, changes)
    return {"status": "success"}

@router.get("/backups-aging")
async def get_backups_aging(session: ContractSession = Depends(get_authorized_session)):
    return session.maintenance.get_backups_aging()

# --- Parts & Stock ---

@router.get("/parts/compatible")
async def get_compatible_parts(modelo: str = "", session: ContractSession = Depends(get_authorized_session)):
    try:
        return session.maintenance.get_compatible_parts(modelo)
    except Exception as e:
        import traceback
        logger.error(f"Error in get_compatible_parts: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/parts/history")
async def get_parts_history(session: ContractSession = Depends(get_authorized_session)):
    try:
        return session.maintenance.get_parts_stock_history()
    except Exception as e:
        import traceback
        logger.error(f"Error in get_parts_history: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/parts/move")
async def move_part_stock(
    codigo: str = Body(...),
    quantidade: int = Body(...),
    tipo: str = Body(...),
    os_id: str = Body(""),
    serie: str = Body(""),
    session: ContractSession = Depends(get_authorized_session)
):
    try:
        username = session.user.username if hasattr(session, 'user') else "Sistema"
        session.maintenance.update_part_stock(
            cod_peca=codigo, 
            qtd=quantidade, 
            tipo=tipo, 
            os_id=os_id, 
            serie=serie, 
            usuario=username
        )
        return {"status": "success"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Error moving stock: {e}")
        raise HTTPException(status_code=500, detail="Internal server error updating stock")

@router.post("/parts/catalog")
async def create_part_catalog(
    data: Dict[str, Any] = Body(...),
    session: ContractSession = Depends(get_authorized_session)
):
    try:
        return session.maintenance.create_part_catalog(data)
    except Exception as e:
        logger.exception(f"Error creating part catalog: {e}")
        raise HTTPException(status_code=500, detail=str(e))

