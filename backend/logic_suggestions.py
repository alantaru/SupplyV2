
from typing import Dict, Any
import pandas as pd
import math
try:
    from . import config
except (ImportError, ValueError):
    import config

def _parse_br_float(val):
    if pd.isna(val) or val == '':
        return 0.0
    s = str(val).strip()
    # Remove dots (thousands) and replace comma with dot (decimal)
    # Example: 1.037 -> 1037.0
    # Example: 7,5 -> 7.5
    # Ambiguity: 1.000 (1000) vs 1.000 (1.0)?
    # In Brazil, dots are thousands usually.
    # Papel.csv sample: "945" (no dot); "1.037" (1037); "7.863" (7863). 
    # "2.041" (2041).
    # "1.037;945" (Media 945).
    # Wait, simple heuristic: remove all dots, replace comma with dot.
    s = s.replace('.', '').replace(',', '.')
    try:
        return float(s)
    except Exception:
        return 0.0

def _get_paper_data(serie: str) -> Dict[str, Any]:  # pragma: no cover
    # Need to read robustly
    try:
        # Load Raw
        path = config.DATA_DIR / "Papel.csv"
        try:
            df = pd.read_csv(path, sep=';', encoding='utf-8-sig')
        except Exception:
            df = pd.read_csv(path, sep=';', encoding='latin1')
            
        # UNIVERSAL ADAPTER
        try:
            from . import adapters
        except (ImportError, ValueError):
            from core import adapters
        df = pd.DataFrame(adapters.normalize_dataframe(df))
            
    except Exception:
        return {}
            
    serie_clean = str(serie).strip().upper()
    
    if 'Serie' not in df.columns:
        return {}
        
    match = df[df['Serie'].astype(str).str.strip().str.upper() == serie_clean]
    if match.empty:
        return {}
        
    row = match.iloc[0]
    
    def get_val(key):
        if key in row:
            return row[key]
        if key.title() in row:
            return row[key.title()]
        if key.upper() in row:
            return row[key.upper()]
        return 0

    media_val = _parse_br_float(get_val('Media'))
    a4_resma_val = _parse_br_float(get_val('A4Resma') or get_val('A4resma'))
    
    return {
        "media_sheets": media_val,
        "a4_resma": a4_resma_val
    }

def _calculate_suggestions(serie, usiminas_data, papel_data, is_color: bool = False) -> Dict[str, Any]:
    """
    Calculate supply suggestions based on paper and counter data.
    Returns suggestions and warning messages for missing data.
    """
    suggestions = {
        "resmas": 0,
        "toner_bk": 0,
        "toner_cy": 0,
        "toner_mg": 0,
        "toner_yw": 0,
        "warnings": []  # List of warning messages for the UI
    }
    
    
    # 1. Paper Suggestion
    paper_data_found = False
    
    if papel_data:
        resmas = 0
        # Try explicit suggestion column first
        if 'a4_resma' in papel_data and papel_data['a4_resma'] > 0:
            resmas = int(papel_data['a4_resma'])
            paper_data_found = True
        elif 'media_sheets' in papel_data and papel_data['media_sheets'] > 0:
            # Calc from sheets
            sheets = papel_data['media_sheets']
            resmas = math.ceil(sheets / 500.0)
            paper_data_found = True
        
        suggestions["resmas"] = resmas
        
    # Fallback: Historical Estimation
    if suggestions["resmas"] == 0 and usiminas_data.get('history_data'):
        hist = usiminas_data['history_data']
        curr_counter = usiminas_data.get('counter_total', 0)
        last_counter = hist.get('counter', 0)
        last_qty = hist.get('qty', 0)
        
        if last_qty > 0:
            delta = curr_counter - last_counter
            initial_stock = last_qty * 500
            est_stock = initial_stock - delta
            if est_stock < 0:
                est_stock = 0
            
            # Threshold <= 1000 (2 reams) -> Suggest 1
            if est_stock <= 1000:
                suggestions["resmas"] = 1
                paper_data_found = True
    
    # USER REQUIREMENT: Never suggest 0 A4, always minimum 1
    if suggestions["resmas"] == 0:
        suggestions["resmas"] = 1
        if not paper_data_found:
            suggestions["warnings"].append("Não encontrados dados de sugestão na tabela de papel, sugerindo mínimo 1 Resma")
    
    # 2. Toner Suggestion
    toner_data_found = False
    
    def check_toner(key_pct):
        nonlocal toner_data_found
        val_str = str(usiminas_data.get(key_pct, '')).replace('%', '').strip()
        if not val_str:
            return 0
        try:
            val = float(val_str)
            toner_data_found = True
            return 1 if val <= 30 else 0
        except Exception:
            return 0
            
    suggestions['toner_bk'] = check_toner('toner_bk_pct')
    
    # Only check color toners if equipment is color
    if is_color:
        suggestions['toner_cy'] = check_toner('toner_cy_pct')
        suggestions['toner_mg'] = check_toner('toner_mg_pct')
        suggestions['toner_yw'] = check_toner('toner_yw_pct')
    
    # Add warning if no toner data was found
    if not toner_data_found:
        suggestions["warnings"].append("Não encontrados dados de toner para este equipamento")
    
    return suggestions

