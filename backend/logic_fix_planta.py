# Redefining functions to fix PlantaInstalada issue
# This file will be appended to logic.py
import pandas as pd
from typing import Dict, Any, List
from . import database

def get_pending_entregas(limit: int = 50) -> List[Dict[str, Any]]:
    df = database.load_entregas()
    
    # Adapter
    from .core import adapters
    if not df.empty:
        df = pd.DataFrame(adapters.normalize_dataframe(df))

    if df.empty:
        return []
    
    # Filter for Pending
    if 'DataEntrega' not in df.columns:
        return df.head(limit).fillna("").to_dict(orient="records")

    data_entrega = df['DataEntrega'].astype(str).str.strip().str.lower().replace('nan', '')
    pending = df[data_entrega == '']
    
    if 'Protocolo' in pending.columns:
         try:
            pending = pending.sort_values('Protocolo', ascending=False)
         except Exception:
            pass

    # Enrich with Mapa data (Area AND PlantaInstalada)
    df_mapa = database.load_mapa()
    
    # Adapter
    if not df_mapa.empty:
        df_mapa = pd.DataFrame(adapters.normalize_dataframe(df_mapa))

    if not df_mapa.empty and 'Serie' in df_mapa.columns:
        df_mapa['Serie_Clean'] = df_mapa['Serie'].astype(str).str.strip().str.upper()
        pending['Serie_Clean'] = pending['Serie'].astype(str).str.strip().str.upper()
        
        # Prepare lookup
        # We want Area AND PlantaInstalada
        cols_to_map = ['Serie_Clean']
        if 'Area' in df_mapa.columns:
            cols_to_map.append('Area')
        if 'PlantaInstalada' in df_mapa.columns:
            cols_to_map.append('PlantaInstalada')
        
        mapa_lookup = df_mapa[cols_to_map].drop_duplicates(subset=['Serie_Clean'])
        
        # Merge
        pending = pd.merge(pending, mapa_lookup, on='Serie_Clean', how='left', suffixes=('', '_mapa'))
        
        # Coalesce Area
        if 'Area_mapa' in pending.columns:
             if 'Area' in pending.columns:
                 pending['Area'] = pending['Area'].fillna(pending['Area_mapa'])
             else:
                 pending['Area'] = pending['Area_mapa']
             pending = pending.drop(columns=['Area_mapa'])
             
        # Coalesce PlantaInstalada
        if 'PlantaInstalada_mapa' in pending.columns:
             if 'PlantaInstalada' in pending.columns:
                 # Prefer existing, fill if empty/nan
                 pending['PlantaInstalada'] = pending['PlantaInstalada'].replace('', pd.NA).fillna(pending['PlantaInstalada_mapa'])
             else:
                 pending['PlantaInstalada'] = pending['PlantaInstalada_mapa']
             pending = pending.drop(columns=['PlantaInstalada_mapa'])
        
        # Ensure cols exist
        if 'Area' not in pending.columns:
            pending['Area'] = ''
        if 'PlantaInstalada' not in pending.columns:
            pending['PlantaInstalada'] = ''
        
        # Fill NaNs
        pending['Area'] = pending['Area'].fillna('')
        pending['PlantaInstalada'] = pending['PlantaInstalada'].fillna('')
        
        pending = pending.drop(columns=['Serie_Clean'])
    else:
        if 'Area' not in pending.columns:
            pending['Area'] = ''
        if 'PlantaInstalada' not in pending.columns:
            pending['PlantaInstalada'] = ''
        pending['Area'] = pending['Area'].fillna('')
        pending['PlantaInstalada'] = pending['PlantaInstalada'].fillna('')

    # Map 'Tor'
    if 'TonerPreto' in pending.columns:
        pending['Tor'] = pending['TonerPreto']
    else:
        pending['Tor'] = ''

    return pending.head(limit).fillna("").to_dict(orient="records")

def save_protocol(data: Dict[str, Any]) -> Dict[str, Any]:
    # Redefined to map PlantaInstalada correctly
    df = database.load_entregas()
    
    # Adapter
    from .core import adapters
    if not df.empty:
        df = pd.DataFrame(adapters.normalize_dataframe(df))
    
    new_id = 1
    if not df.empty and 'Protocolo' in df.columns:
        current_ids = pd.to_numeric(df['Protocolo'], errors='coerce').fillna(0)
        if not current_ids.empty:
            new_id = int(current_ids.max()) + 1
            
    new_row = {
        "Protocolo": new_id,
        "Serie": data.get("serie"),
        "Modelo": data.get("modelo"),
        "Fila": data.get("fila"),
        "Solicitacao": "Telefone",
        "Status": "Pendente",
        "Empresa": data.get("empresa"),
        "PlantaInstalada": data.get("plantaInstalada"), # CORRECTED KEY
        "Cidade": data.get("cidade"),
        "Contrato": data.get("contrato"),
        "Horario": data.get("horario"),
        "ContatoSetor": data.get("contato"),
        "LocalInstalacao": data.get("local"), # Using 'local' from frontend which combined Local+Rua? 
        # Wait, Frontend sends 'local' = Local+Rua.
        # But Backend expects LocalInstalacao? 
        # Legacy had LocalInstalacao separate from RuaRef.
        # Frontend logic: local: (Loc + Rua).
        # We should use 'local' from payload as LocalInstalacao? Or expect raw?
        # Payload construction in FormStep.jsx:
        # local: (data.equipment.LocalInstalacao || '') + ' - ' + (data.equipment.RuaRef || '')
        # So 'local' is composite.
        # Ideally we save composite to LocalInstalacao? Or splitting?
        # Legacy likely wants exact columns.
        # If I only have composite 'local' in payload, I save it.
        # But 'RuaRef' will be empty if not in payload.
        # I'll save 'local' to 'LocalInstalacao'.
        "RuaRef": "", # Lost if not separate
        "Area": data.get("area"), # Frontend doesn't seem to have 'area' in defaults?
        # But wait, 'get_pending_entregas' enriches Area from Map? Yes.
        # So saving empty is fine, it gets looked up later.
        
        "ContadorInicial": data.get("counterInitial"),
        "ContadorFinal": data.get("counterFinal"),
        "Producao": data.get("production"),
        "ProducaoResmas": data.get("resmas"), 
        "A4": data.get("resmas"), 
        "TonerPreto": data.get("tonerBk"),
        "TonerCiano": data.get("tonerCy"),
        "TonerAmarelo": data.get("tonerYw"),
        "TonerMagenta": data.get("tonerMg"),
        "Data": data.get("date"),
        "DataEntrega": "", 
        "Solicitante": data.get("solicitante"),
        "Ramal": data.get("telefone"),
        "Obs": data.get("obs"),
        
        "IncidenteRds": data.get("incidente"),
        "Emprestimo": data.get("emprestimo"),
        "EmprestadoDoContrato": data.get("origem"),
        "AnaliseFV": data.get("analiseFV"),
        "Recolha": data.get("recolha"),
        "ComDefeito": data.get("comDefeito"),
        "StatusEmprestimo": "", 
        "Outros": "",
        "Cancelado": "FALSO",
        "A4Entregue": "FALSO"
    }
    
    new_df_row = pd.DataFrame([new_row])
    updated_df = pd.concat([df, new_df_row], ignore_index=True)
    
    from . import config
    path = config.DATA_DIR / database.FILES["ENTREGAS"]
    updated_df.to_csv(path, sep=';', encoding='utf-8-sig', index=False)
    
    return {"protocol_id": new_id, "status": "success"}
