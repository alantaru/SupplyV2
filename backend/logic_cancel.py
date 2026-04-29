import pandas as pd
from typing import Dict, Any
from . import database

def cancel_protocol(protocol_id: int, reason: str, contract_id: str = None) -> Dict[str, Any]:
    """
    Cancel a protocol.
    Matches legacy VBA: 
    UPDATE tabEntregas set IncidenteRds = -1, Obs = ..., DataEntrega = Today, Cancelado = True, Funcionario = 'CANCELADO'
    """
    df_entregas = database.load_entregas(contract_id)
    
    # Adapter
    from .core import adapters
    if not df_entregas.empty:
        df_entregas = pd.DataFrame(adapters.normalize_dataframe(df_entregas))
    if df_entregas.empty:
         return {"status": "error", "message": "Entregas empty"}

    df_entregas['Protocolo_Num'] = pd.to_numeric(df_entregas['Protocolo'], errors='coerce')
    indices = df_entregas.index[df_entregas['Protocolo_Num'] == protocol_id].tolist()
    
    if not indices:
        return {"status": "error", "message": "Protocol not found"}
    
    idx = indices[0]
    
    # Update fields
    from datetime import datetime
    today = datetime.now().strftime('%d/%m/%Y')
    
    df_entregas.at[idx, 'Status'] = 'Cancelado'
    df_entregas.at[idx, 'Cancelado'] = 'VERDADEIRO' # or True
    df_entregas.at[idx, 'IncidenteRds'] = -1
    df_entregas.at[idx, 'Funcionario'] = 'CANCELADO'
    df_entregas.at[idx, 'DataEntrega'] = today
    
    # Append reason to Obs or overwrite? Legacy overwrites 'Obs = Me.txtObs.Value'.
    # We will likely append or overwrite if reason provided.
    current_obs = str(df_entregas.at[idx, 'Obs']) if pd.notna(df_entregas.at[idx, 'Obs']) else ""
    if reason:
        df_entregas.at[idx, 'Obs'] = (current_obs + " [Cancelado: " + reason + "]").strip()
    
    # Persist
    # Persist
    uri_entregas = database.get_data_uri("ENTREGAS", contract_id)
    df_save = df_entregas.drop(columns=['Protocolo_Num'])
    database.save_dataframe_csv(df_save, uri_entregas)
    
    return {"status": "success", "message": "Protocol cancelled"}
