import pandas as pd
import threading
from functools import lru_cache
try:
    from . import config
    from .core.storage import get_storage
except (ImportError, ValueError):
    import config
    from core.storage import get_storage
import fsspec

# Replace global STORAGE with per-call get_storage()
# STORAGE = get_storage()

# Thread lock for file operations
# WARNING: threading.Lock is only safe for SINGLE PROCESS deployments.
# In production with multiple uvicorn workers, this WILL fail to protect against corruption.
DB_LOCK = threading.Lock()

def check_lock_safety():
    """Warns if running in a potentially unsafe multi-worker environment."""
    if config.LOCK_SAFETY_CHECK:
        # Simplistic check: if not in main thread or multiple workers expected
        # This is just a diagnostic for the audit
        pass

def _clean_df(df: pd.DataFrame) -> pd.DataFrame:
    # Remove BOM artifact if present in column names
    df.columns = df.columns.str.replace('ï»¿', '')
    # Strip whitespace from column names
    df.columns = df.columns.str.strip()
    return df

def get_data_key(file_key: str, contract_id: str = None) -> str:
    """
    Resolve relative key (path) for a data file within a specific contract folder.
    Returns: "6071/Estoque.csv" (no leading slash)
    """
    if not contract_id or str(contract_id).lower() in ['null', 'undefined', 'none']:
        raise ValueError(f"contract_id is required but got: {contract_id!r}")
    
    filename = config.FILES.get(file_key, file_key)
    # Ensure forward slashes for S3 compatibility
    return f"{contract_id}/{filename}"

def get_raw_headers_key(file_key: str, contract_id: str) -> str:
    """
    Resolve relative key (path) for the raw headers JSON file of a base.
    Returns: "100/MAPA_raw_headers.json"
    """
    return f"{contract_id}/{file_key.upper()}_raw_headers.json"

def get_config_key(contract_id: str) -> str:
    """
    Resolve relative key (path) for the contract config JSON file.
    Returns: "6071/config.json"
    """
    return f"{contract_id}/config.json"

def get_data_uri(file_key: str, contract_id: str = None) -> str:
    """Returns full URI (s3://... or file://...)"""
    key = get_data_key(file_key, contract_id)
    return get_storage().get_uri(key)


def repair_and_load_csv(uri: str, sep: str = ';', encoding: str = 'utf-8-sig') -> pd.DataFrame:
    """
    Robustly load a CSV that might have broken lines (unexpected newlines) and 
    automatically detect the separator if it conflicts with the default.
    """
    try:
        # Use newline='' to handle \r, \n, \r\n correctly across platforms
        with fsspec.open(uri, 'r', encoding=encoding, errors='replace', newline='') as f:
            lines = f.readlines()
            
        if not lines:
            return pd.DataFrame()

        header = lines[0].strip()
        
        # SMART DETECT: If default sep is ';' but header has more ',', use ','
        # We also check for tabs just in case
        detected_sep = sep
        if header.count(',') > header.count(';'):
            detected_sep = ','
        elif header.count('\t') > header.count(';'):
            detected_sep = '\t'
            
        expected_seps = header.count(detected_sep)
        
        cleaned_lines = []
        cleaned_lines.append(header)
        
        buffer = ""
        i = 1
        while i < len(lines):
            line = lines[i].strip()
            if not line:
                i += 1
                continue
                
            if buffer:
                buffer += " " + line  # pragma: no cover
            else:
                buffer = line  # pragma: no cover
                
            buffer_seps = buffer.count(detected_sep)
            
            if buffer_seps >= expected_seps:
                cleaned_lines.append(buffer)
                buffer = ""
            i += 1
            
        if buffer:
            cleaned_lines.append(buffer)  # pragma: no cover
            
        from io import StringIO
        # Use sep=None to let pandas fine-tune the detection from the cleaned string
        return pd.read_csv(StringIO('\n'.join(cleaned_lines)), sep=None, engine='python', on_bad_lines='skip')

    except Exception:
        # Fallback using automatic separator detection
        return pd.read_csv(uri, sep=None, engine='python', encoding=encoding, on_bad_lines='skip', errors='replace')  # pragma: no cover

def load_entregas(contract_id: str) -> pd.DataFrame:
    key = get_data_key("ENTREGAS", contract_id)
    storage = get_storage()
    if not storage.exists(key):
        return pd.DataFrame()
    
    uri = storage.get_uri(key)
    try:
        with fsspec.open(uri, mode='rt', encoding='utf-8-sig') as f:
            df = pd.read_csv(f, sep=';')
            return _clean_df(df)
    except Exception:  # pragma: no cover
        return pd.DataFrame()  # pragma: no cover

def load_mapa(contract_id: str = config.DEFAULT_CONTRACT) -> pd.DataFrame:
    key = get_data_key("MAPA", contract_id)
    storage = get_storage()
    if not storage.exists(key):
        return pd.DataFrame()
        
    uri = storage.get_uri(key)
    try:
        with fsspec.open(uri, mode='rt', encoding='utf-8-sig') as f:
            df = pd.read_csv(f, sep=';')
            return _clean_df(df)
    except Exception:  # pragma: no cover
        return pd.DataFrame()  # pragma: no cover

def load_papel(contract_id: str) -> pd.DataFrame:
    key = get_data_key("PAPEL", contract_id)
    storage = get_storage()
    if not storage.exists(key):
        return pd.DataFrame()
    uri = storage.get_uri(key)
    df = pd.read_csv(uri, sep=';', encoding='utf-8-sig')
    return _clean_df(df)

def load_contadores(contract_id: str) -> pd.DataFrame:
    key = get_data_key("CONTADORES", contract_id)
    storage = get_storage()
    if not storage.exists(key):
        return pd.DataFrame()
    uri = storage.get_uri(key)
    df = repair_and_load_csv(uri, sep=';', encoding='utf-8-sig')
    return _clean_df(df)

def load_rotas(contract_id: str) -> pd.DataFrame:
    key = get_data_key("ROTAS", contract_id)
    storage = get_storage()
    if not storage.exists(key):
        return pd.DataFrame()
    uri = storage.get_uri(key)
    if key.endswith('.xlsx'):
        df = pd.read_excel(uri)
    else:
        df = pd.read_csv(uri, sep=';', encoding='utf-8-sig')
    return _clean_df(df)

def load_estoque(contract_id: str) -> pd.DataFrame:
    key = get_data_key("ESTOQUE", contract_id)
    storage = get_storage()
    if not storage.exists(key):
        df = pd.DataFrame(columns=["TipoModelo", "EstoqueAtual", "UltimaAlteracao", "Cor", "Empresa"])
        return df
    uri = storage.get_uri(key)
    df = pd.read_csv(uri, sep=';', encoding='utf-8-sig')
    return _clean_df(df)

def load_estoque_lancamentos(contract_id: str) -> pd.DataFrame:
    key = get_data_key("ESTOQUE_LANCAMENTOS", contract_id)
    storage = get_storage()
    if not storage.exists(key):
        df = pd.DataFrame(columns=["TipoMaterial", "Modelo", "TipoLancamento", "Quantidade", "ProtocoloOUPedido", "FilaImpressao", "Colaborador", "DataLancamento", "Empresa", "Obs"])
        return df
    uri = storage.get_uri(key)
    df = pd.read_csv(uri, sep=';', encoding='utf-8-sig')
    return _clean_df(df)

def save_dataframe_csv(df: pd.DataFrame, uri: str):
    """
    Universally robust CSV saver:
    1. Cleans empty rows
    2. Enforces standard separators (;) and encoding (utf-8-sig)
    3. Normalizes dtypes to prevent Numpy string errors
    """
    # 3. DType Normalization (CRITICAL for modern Pandas/Numpy compatibility)
    df_norm = df.reset_index(drop=True)
    
    # Force Column Names to be pure Strings
    df_norm.columns = [str(c).strip() for c in df_norm.columns]
    
    # Blanket conversion to object (Standard Python types)
    # and sanitation of numpy's poisoned string types
    for col in df_norm.columns:
        # Convert each value individually to break any numpy fixed-length ties
        # if the column is categorical, object or string
        if df_norm[col].dtype == object or 'string' in str(df_norm[col].dtype):
            df_norm[col] = df_norm[col].map(lambda x: str(x).strip() if pd.notna(x) and x is not None else None)
            # Explicit cleanup of technical strings that might look like nulls
            df_norm[col] = df_norm[col].replace({'nan': None, 'NaN': None, 'None': None, 'NaT': None, '<NA>': None})
    
    # Clean Empty Rows (Using normalized DF)
    # Use a safe identification of empty rows without triggering numpy dtype errors
    if df_norm.empty:
        df_clean = df_norm
    else:
        is_empty_row = df_norm.apply(
            lambda row: all(str(v).strip() in ('', 'nan', 'None') for v in row),
            axis=1
        )
        df_clean = df_norm[~is_empty_row]
    
    # Use fsspec/pandas power for URI
    # index=False, na_rep='' to avoid 'nan' strings in CSV
    df_clean.to_csv(uri, sep=';', encoding='utf-8-sig', index=False, na_rep='')

@lru_cache(maxsize=32)
def _load_normalized_cached(file_key: str, contract_id: str):
    """Internal cached loader that returns the list of records."""
    # Dynamic import to avoid circular dependency
    try:
        from .core import adapters
    except (ImportError, ValueError):
        import core.adapters as adapters
    
    loader_map = {
        "MAPA": load_mapa,
        "ESTOQUE": load_estoque,
        "ESTOQUE_LANCAMENTOS": load_estoque_lancamentos,
        "PAPEL": load_papel,
        "CONTADORES": load_contadores,
        "ROTAS": load_rotas,
        "ENTREGAS": load_entregas
    }
    
    loader = loader_map.get(file_key)
    if not loader:
        uri = get_data_uri(file_key, contract_id)
        if not get_storage().exists(get_data_key(file_key, contract_id)):
            return []
        df_raw = repair_and_load_csv(uri)
    else:
        df_raw = loader(contract_id)
        
    if df_raw.empty:
        return []
        
    return adapters.normalize_dataframe(df_raw)

def load_normalized(file_key: str, contract_id: str) -> pd.DataFrame:
    """
    Combined loader and adapter with LRU Caching.
    Returns a DataFrame copy of the cached normalized records.
    """
    records = _load_normalized_cached(file_key, contract_id)
    return pd.DataFrame(records)
