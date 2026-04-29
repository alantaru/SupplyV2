import pandas as pd
from datetime import datetime
try:
    from . import database
    from .config import DEFAULT_CONTRACT
except (ImportError, ValueError):
    import database
    from config import DEFAULT_CONTRACT

def get_history_prefix(contract_id: str) -> str:
    # return logical prefix (folder)
    return f"{contract_id}/history/"

def list_archives(contract_id: str):
    prefix = get_history_prefix(contract_id)
    # List files from storage
    files = database.get_storage().list_files(prefix)
    
    archives = []
    for filename in files:
        if not filename.startswith("Entregas_Archived_"):
            continue
        
        full_key = f"{prefix}{filename}"
        meta = database.get_storage().get_metadata(full_key)
        
        # Safe default if metadata missing
        dt_mod = meta.get('last_modified', datetime.now())
        size = meta.get('size', 0)
        
        archives.append({
            "filename": filename,
            "date": dt_mod.strftime("%d/%m/%Y %H:%M:%S"),
            "size": f"{size / 1024:.1f} KB"
        })
        
    # Sort by date descending
    return sorted(archives, key=lambda x: x['date'], reverse=True)

def split_entregas_by_date(cutoff_date_str: str, contract_id: str = DEFAULT_CONTRACT):
    """
    Splits Entregas.csv into two files based on DataEntrega (or creation date).
    cutoff_date_str format: YYYY-MM-DD
    Records BEFORE this date are moved to archive.
    Records ON or AFTER this date are kept.
    """
    # Load using robust loader (handles S3)
    df = database.load_entregas(contract_id)

    # Use Adapter
    try:
        from .core import adapters
    except (ImportError, ValueError):
        from core import adapters
    if not df.empty:
        df = pd.DataFrame(adapters.normalize_dataframe(df))

    if df.empty:
         return {"status": "error", "message": "Arquivo vazio ou não encontrado."}

    # Identify Date Column
    # Candidates: 'DataEntrega', 'Data', 'Created_At'
    date_col = None
    for col in ['DataEntrega', 'Data', 'data_entrega']:
        if col in df.columns:
            date_col = col
            break
    
    if not date_col:
        return {"status": "error", "message": "Coluna de data não encontrada para filtragem."}

    # Parse Dates
    try:
        # Coerce errors to NaT
        df['temp_date'] = pd.to_datetime(df[date_col], format="%d/%m/%Y", errors='coerce')
        
        # If mainly NaT, try YYYY-MM-DD
        if df['temp_date'].notna().sum() == 0:
             df['temp_date'] = pd.to_datetime(df[date_col], errors='coerce')

    except Exception as e:
        return {"status": "error", "message": f"Erro ao processar datas: {str(e)}"}

    cutoff_date = pd.to_datetime(cutoff_date_str)

    # Split
    # Archive: strictly LESS than cutoff
    mask_archive = df['temp_date'] < cutoff_date
    # Keep: Greater or Equal OR NaT (invalid dates stay in main to be fixed)
    mask_keep = ~mask_archive

    df_archive = df[mask_archive].copy()
    df_keep = df[mask_keep].copy()

    if df_archive.empty:
        return {"status": "warning", "message": "Nenhum registro encontrado anterior a essa data."}

    # Cleanup temp col
    df_archive.drop(columns=['temp_date'], inplace=True)
    df_keep.drop(columns=['temp_date'], inplace=True)

    # Save Archive (S3)
    prefix = get_history_prefix(contract_id)
    archive_filename = f"Entregas_Archived_{cutoff_date_str.replace('-', '')}_{datetime.now().strftime('%H%M%S')}.csv"
    archive_key = f"{prefix}{archive_filename}"
    archive_uri = database.get_storage().get_uri(archive_key)
    
    database.save_dataframe_csv(df_archive, archive_uri)

    # Save Main (Overwrite)
    main_uri = database.get_data_uri("ENTREGAS", contract_id)
    database.save_dataframe_csv(df_keep, main_uri)

    return {
        "status": "success",
        "message": f"Arquivados {len(df_archive)} registros. Mantidos {len(df_keep)} registros.",
        "archive_file": archive_filename,
        "kept_count": len(df_keep),
        "archived_count": len(df_archive)
    }
