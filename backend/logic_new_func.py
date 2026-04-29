import pandas as pd
from typing import Dict, Any
from . import database

# Internal helpers - will be refined/implemented or imported
def _get_usiminas_data(serie: str) -> Dict: return {}
def _get_paper_data(serie: str) -> Dict: return {}
def _get_last_delivery_data(serie: str) -> Dict: return {}
def _calculate_suggestions(serie: str, counters: Dict, paper: Dict) -> Dict: return {}

def get_equipment_full_data_new(serie: str) -> Dict[str, Any]:
    # Wrapper to use new suggestion logic
    # Re-impl of get_equipment_full_data with corrections
    df_mapa = database.load_mapa()
    
    # Adapter
    from .core import adapters
    if not df_mapa.empty:
        df_mapa = pd.DataFrame(adapters.normalize_dataframe(df_mapa))
    
    def safe_str(val):
        return str(val).strip().lower() if pd.notna(val) else ""
        
    mask = df_mapa['Serie'].apply(safe_str) == str(serie).strip().lower()
    matches = df_mapa[mask]
    
    if matches.empty:
        return None
        
    equip_row = matches.iloc[0].to_dict()
    equip_row = {k: (v if pd.notna(v) else "") for k, v in equip_row.items()}
    
    usiminas_data = _get_usiminas_data(serie)
    
    # Use robust paper data fetcher
    papel_data = _get_paper_data(serie)
    
    # Last delivery - optional/legacy
    try:
        last_delivery_data = _get_last_delivery_data(serie)
    except NameError:
        last_delivery_data = {}
    
    # Calculate suggestions
    supplies_calc = _calculate_suggestions(serie, usiminas_data, papel_data)
    
    return {
        "equipment": equip_row,
        "counters": usiminas_data,
        "papel_stats": papel_data,
        "last_delivery": last_delivery_data,
        "suggestion": supplies_calc
    }
