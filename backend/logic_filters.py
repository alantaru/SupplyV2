import pandas as pd
from typing import Dict, List
from . import database

def get_filter_options() -> Dict[str, List[str]]:
    """
    Get distinct values for filters from pending deliveries.
    """
    df = database.load_entregas()
    
    # Adapter
    from .core import adapters
    if not df.empty:
        df = pd.DataFrame(adapters.normalize_dataframe(df))
    if df.empty:
        return {"cidades": [], "filas": [], "empresas": []}
        
    # Filter Pending
    if 'DataEntrega' in df.columns:
        data_entrega = df['DataEntrega'].astype(str).str.strip().str.lower().replace('nan', '')
        pending = df[data_entrega == '']
    else:
        pending = df
        
    # Get distincts
    def get_distinct(col):
        if col not in pending.columns:
            return []
        return sorted(pending[col].astype(str).dropna().unique().tolist())
        
    return {
        "cidades": get_distinct("Cidade"),
        "filas": get_distinct("Fila"),
        "empresas": get_distinct("Empresa")
    }

def get_pending_entregas_filtered(limit: int = 50, city: str = None, fila: str = None, empresa: str = None, search: str = None) -> list:
    # Enhanced version of get_pending_entregas with filters
    df = database.load_entregas()
    
    # Adapter
    from .core import adapters
    if not df.empty:
        df = pd.DataFrame(adapters.normalize_dataframe(df))
    if df.empty:
        return []
    
    # Filter for Pending
    if 'DataEntrega' not in df.columns:
        pending = df
    else:
        data_entrega = df['DataEntrega'].astype(str).str.strip().str.lower().replace('nan', '')
        pending = df[data_entrega == '']
        
    # Apply Filters
    if city:
        pending = pending[pending['Cidade'].astype(str).str.contains(city, case=False, na=False)]
    if fila:
        pending = pending[pending['Fila'].astype(str).str.contains(fila, case=False, na=False)]
    if empresa:
        pending = pending[pending['Empresa'].astype(str).str.contains(empresa, case=False, na=False)]
    if search:
        # Search in Protocol, Serie, Fila
        mask = (
            pending['Protocolo'].astype(str).str.contains(search, case=False, na=False) |
            pending['Serie'].astype(str).str.contains(search, case=False, na=False) |
            pending['Fila'].astype(str).str.contains(search, case=False, na=False)
        )
        pending = pending[mask]

    if 'Protocolo' in pending.columns:
         try:
            pending = pending.sort_values('Protocolo', ascending=False)
         except Exception:
            pass

    # Enrich with Mapa data (Area AND PlantaInstalada) - REUSED LOGIC
    # ... (Copy logic or verify if I can reuse logic.get_pending_entregas structure)
    # Actually, refactoring `get_pending_entregas` to accept args is better.
    # But for Append Strategy, I'll redefine `get_pending_entregas` to accept **kwargs.
    
    # ... ENRICHMENT LOGIC (SAME AS BEFORE) ...
    # Minimal duplicate for brevity in plan, but full in code.
    
    df_mapa = database.load_mapa()
    if not df_mapa.empty and 'Serie' in df_mapa.columns:
        df_mapa['Serie_Clean'] = df_mapa['Serie'].astype(str).str.strip().str.upper()
        pending['Serie_Clean'] = pending['Serie'].astype(str).str.strip().str.upper()
        
        cols_to_map = ['Serie_Clean']
        if 'Area' in df_mapa.columns:
            cols_to_map.append('Area')
        if 'PlantaInstalada' in df_mapa.columns:
            cols_to_map.append('PlantaInstalada')
        
        mapa_lookup = df_mapa[cols_to_map].drop_duplicates(subset=['Serie_Clean'])
        
        pending = pd.merge(pending, mapa_lookup, on='Serie_Clean', how='left', suffixes=('', '_mapa'))
        
        if 'Area_mapa' in pending.columns:
             if 'Area' in pending.columns:
                 pending['Area'] = pending['Area'].fillna(pending['Area_mapa'])
             else:
                 pending['Area'] = pending['Area_mapa']
             pending = pending.drop(columns=['Area_mapa'])
             
        if 'PlantaInstalada_mapa' in pending.columns:
             if 'PlantaInstalada' in pending.columns:
                 pending['PlantaInstalada'] = pending['PlantaInstalada'].replace('', pd.NA).fillna(pending['PlantaInstalada_mapa'])
             else:
                 pending['PlantaInstalada'] = pending['PlantaInstalada_mapa']
             pending = pending.drop(columns=['PlantaInstalada_mapa'])
        
        if 'Area' not in pending.columns:
            pending['Area'] = ''
        if 'PlantaInstalada' not in pending.columns:
            pending['PlantaInstalada'] = ''
        
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

    if 'TonerPreto' in pending.columns:
        pending['Tor'] = pending['TonerPreto']
    else:
        pending['Tor'] = ''

    return pending.head(limit).fillna("").to_dict(orient="records")
