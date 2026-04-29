import pandas as pd
from typing import Dict, Any
from . import database

def _get_last_delivery_data_enhanced(serie: str) -> Dict[str, Any]:
    # Returns last delivery AND last A4 delivery stats
    df = database.load_entregas()
    
    # Adapter
    from .core import adapters
    if not df.empty:
        df = pd.DataFrame(adapters.normalize_dataframe(df))
    if df.empty or 'Serie' not in df.columns:
        return {}
        
    # Filter by user serie
    df_serie = df[df['Serie'].astype(str).str.strip().str.upper() == str(serie).strip().upper()]
    if df_serie.empty:
        return {}
        
    df_serie = df_serie.copy()
    
    # Sort by ID or Date (assuming Protocolo is monotonic or use DataEntrega)
    # VBA used DataEntrega.
    if 'DataEntrega' in df_serie.columns:
         # simple sort
         # but DataEntrega string format dd/mm/yyyy needs parsing.
         # fallback to Protocolo if int?
         pass
         
    # Let's assume natural order or Protocolo descending
    if 'Protocolo' in df_serie.columns:
        try:
            df_serie['Protocolo_Int'] = pd.to_numeric(df_serie['Protocolo'], errors='coerce')
            df_serie = df_serie.sort_values('Protocolo_Int', ascending=False)
        except Exception:
            pass
            
    last_any = df_serie.iloc[0]
    
    # Find last A4
    last_a4 = None
    # Check 'A4' column > 0
    if 'A4' in df_serie.columns:
        # Convert to numeric
        pd.to_numeric(df_serie['A4'], errors='coerce').fillna(0)
        # Filter > 0
        a4_deliveries = df_serie[pd.to_numeric(df_serie['A4'], errors='coerce').fillna(0) > 0]
        if not a4_deliveries.empty:
            last_a4 = a4_deliveries.iloc[0]
            
    data = {
        "date_last": last_any.get("DataEntrega", ""),
        "counter_final_last": last_any.get("ContadorFinal", 0),
        "last_items": {
             "A4": last_any.get("A4", 0),
             "TonerPreto": last_any.get("TonerPreto", 0)
        }
    }
    
    if last_a4 is not None:
        data["date_last_a4"] = last_a4.get("DataEntrega", "")
        data["counter_final_last_a4"] = last_a4.get("ContadorFinal", 0)
    else:
        data["counter_final_last_a4"] = 0 # or None
        
    return data
