
import pandas as pd
from . import database
from . import config

SOLICITANTES_FILE = "Solicitantes.csv"
SOLICITANTES_PATH = config.DATA_DIR / SOLICITANTES_FILE

def init_solicitantes():
    """
    Initialize Solicitantes.csv if it doesn't exist.
    Extracts distinct 'Solicitante' from Entregas.csv.
    """
    if SOLICITANTES_PATH.exists():
        return
        

    df_entregas = database.load_entregas()
    
    # Adapter
    from .core import adapters
    if not df_entregas.empty:
        df_entregas = pd.DataFrame(adapters.normalize_dataframe(df_entregas))
    
    if df_entregas.empty or 'Solicitante' not in df_entregas.columns:
        # Create empty
        df_new = pd.DataFrame(columns=['Nome'])
        df_new = pd.DataFrame(columns=['Nome'])
        database.save_dataframe_csv(df_new, SOLICITANTES_PATH)
        return

    # Extract distinct names
    names = df_entregas['Solicitante'].dropna().astype(str).str.strip().unique()
    names = [n for n in names if n] # Filter empty
    names = sorted(names)
    
    df_new = pd.DataFrame({'Nome': names})
    df_new = pd.DataFrame({'Nome': names})
    database.save_dataframe_csv(df_new, SOLICITANTES_PATH)


def get_solicitantes(query: str = "") -> list:
    """
    Get list of solicitantes, optionally filtered by query.
    """
    if not SOLICITANTES_PATH.exists():
        init_solicitantes()
        
    try:
        df = pd.read_csv(SOLICITANTES_PATH, sep=';', encoding='utf-8-sig')
        from .core import adapters
        if not df.empty:
            df = pd.DataFrame(adapters.normalize_dataframe(df))
    except Exception:
        return []
        
    if df.empty or 'Nome' not in df.columns:
        return []
        
    names = df['Nome'].dropna().astype(str).tolist()
    
    if query:
        query = query.lower()
        names = [n for n in names if query in n.lower()]
        
    return sorted(names)[:50] # Limit results

def add_solicitante(name: str):
    """
    Add a new solicitante if not exists.
    """
    if not name:
        return
        
    name = name.strip()
    if not name:
        return

    if not SOLICITANTES_PATH.exists():
        init_solicitantes()
        
    try:
        df = pd.read_csv(SOLICITANTES_PATH, sep=';', encoding='utf-8-sig')
        from .core import adapters
        if not df.empty:
            df = pd.DataFrame(adapters.normalize_dataframe(df))
    except Exception:
         df = pd.DataFrame(columns=['Nome'])
         
    if 'Nome' not in df.columns:
        df = pd.DataFrame(columns=['Nome'])
        
    # Check existence (case insensitive)
    if df['Nome'].astype(str).str.lower().eq(name.lower()).any():
        return # Already exists
        
    # Append
    new_row = pd.DataFrame({'Nome': [name]})
    df = pd.concat([df, new_row], ignore_index=True)
    database.save_dataframe_csv(df, SOLICITANTES_PATH)

