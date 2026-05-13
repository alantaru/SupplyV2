from typing import Dict, Any, List
import pandas as pd

# Central Mapping Definition
# Key = Internal Universal CSV Header (UPPERCASE)
# Value = Frontend Expected Key (TitleCase/PascalCase)
FRONTEND_MAPPING = {
    # Identity
    'SERIE': 'Serie',
    'SERIAL': 'Serie',
    'NUMEROSERIE': 'Serie',
    'SN': 'Serie',
    'FILA': 'Fila',
    'HOSTNAME': 'Fila',
    'FILA_DE_IMPRESSAO': 'Fila',
    'MODELOSIMPRESS': 'ModeloSimpress',
    'MODELO': 'Modelo',
    'STATUS': 'Status',
    'SITUACAO': 'Status',
    'IP': 'IP',
    'ENDERECOIP': 'IP',
    
    # Location
    'EMPRESA': 'Empresa',
    'CIDADE': 'Cidade',
    'UF': 'UF',
    'AREA': 'Area',
    'SETOR': 'Area',
    'LOCALINSTALACAO': 'LocalInstalacao',
    'LOCAL': 'LocalInstalacao',             # short form: "Local" column → LocalInstalacao
    'LOCALDEINSTALACAO': 'LocalInstalacao',
    'LOCALINSTALATION': 'LocalInstalacao',  # typo variant
    'ENDERECO': 'LocalInstalacao',          # Legacy mapping: Endereço field usually holds the installation room/local
    'ENDERECOCOMPLETO': 'Endereco',         # variant
    'RUAREF': 'RuaRef',
    'RUA': 'RuaRef',                        # short form: "Rua" column → RuaRef
    'COMPLEMENTO': 'Complemento',
    'CONTATOSETOR': 'ContatoSetor',
    'CONTATO': 'ContatoSetor',
    'DEPARTAMENTO': 'Area',
    'SETOR_RESPONSAVEL': 'Area',
    'RAMAL': 'Ramal',
    'TELEFONE': 'Ramal',
    'HORARIO': 'Horario',
    'HORÁRIO': 'Horario',
    
    # Details
    'OBSERVACAO': 'Obs',
    'OBS': 'Obs',
    'CHAMADO': 'Chamado',
    'CONTRATO': 'Contrato',
    'PLANTAINSTALADA': 'PlantaInstalada',
    'CENTRODECUSTO': 'CentroCusto',
    'GERENCIA': 'Gerencia',
    'GERÊNCIA': 'Gerencia',
    'MARCA': 'Marca',
    'FABRICANTE': 'Marca',   # common alias
    
    # Fulfillment
    'RECEBIDOPOR': 'RecebidoPor',
    'FUNCIONARIO': 'Funcionario',
    
    # Stock / Counters
    'TIPOMODELO': 'TipoModelo',
    'ESTOQUEATUAL': 'EstoqueAtual',
    'COR': 'Cor',
    'CODIGO': 'Codigo',
    'ULTIMAALTERACAO': 'UltimaAlteracao',
    'TOTAL': 'ContadorTotal',
    'CONTADORTOTAL': 'ContadorTotal',
    'ECCOUNTERTOTAL': 'ContadorTotal',
    'EQA4COUNTERTOTAL': 'ContadorTotal',
    'MEDIA': 'MediaSheets',
    'A4RESMA': 'A4Resma',
    
    # Toner percentages (from Contadores.csv — various case/format variants)
    '%BK': 'toner_bk_pct',
    'BK': 'toner_bk_pct',
    '%CY': 'toner_cy_pct',
    'CY': 'toner_cy_pct',
    '%MG': 'toner_mg_pct',
    '%Mg': 'toner_mg_pct',
    'MG': 'toner_mg_pct',
    '%YW': 'toner_yw_pct',
    '%Yw': 'toner_yw_pct',
    'YW': 'toner_yw_pct',

    # Protocol / Delivery
    'PROTOCOLO': 'Protocolo',
    'DATAENTREGA': 'DataEntrega',
    'SOLICITANTE': 'Solicitante',
    'INCIDENTERDS': 'IncidenteRds',
    'ANALISEFV': 'AnaliseFV',
    'CONTADORINICIAL': 'ContadorInicial',
    'CONTADORFINAL': 'ContadorFinal',
    'PRODUCAO': 'Producao',
    'PRODUCAORESMAS': 'ProducaoResmas',
    'A4': 'A4',
    'A3': 'A3',
    'TONERPRETO': 'TonerPreto',
    'TONERCIANO': 'TonerCiano',
    'TONERAMARELO': 'TonerAmarelo',
    'TONERMAGENTA': 'TonerMagenta',
    'DATA': 'Data',
    'CANCELADO': 'Cancelado',
    'RECOLHA': 'Recolha',
    'COMDEFEITO': 'ComDefeito',
    'ALMOXARIFADO': 'Almoxarifado'
}


def normalize_serie(value: Any) -> str:
    """
    Strictly normalize a Serial Number:
    1. Convert to string (empty if null)
    2. Strip whitespace
    3. Upper case
    4. TRUNCATE to 14 characters (Simpress limitation)
    """
    if value is None or pd.isna(value):
        return ""
        
    try:
        from .. import config
    except (ImportError, ValueError):
        import config
    
    max_len = getattr(config, 'MAX_SERIAL_LENGTH', 14)
    return str(value).strip().upper()[:max_len]

def normalize_row(row: Dict[str, Any], keep_extra: bool = True) -> Dict[str, Any]:
    """
    Normalize a single dictionary row (from DF or DB) to match Frontend expectations.
    
    Args:
        row: The raw dictionary (usually from df.iloc[0].to_dict())
        keep_extra: If True, keeps keys that aren't in the mapping (useful for custom fields).
    """
    normalized = {}
    
    # 1. Apply Mapping
    for internal_key, frontend_key in FRONTEND_MAPPING.items():
        # Try exact UPPER match
        val = row.get(internal_key)
        
        # Try generic case-insensitive fallback if not found
        if val is None:
            # Linear search (slow but safe for single rows)
            for k, v in row.items():
                if k.upper() == internal_key:
                    val = v
                    break
        
        # Also try direct match if the source is already mixed case (Legacy)
        if val is None:
             val = row.get(frontend_key) or row.get(internal_key.title())

        if val is not None:
            # SPECIAL SERIAL LOGIC
            if frontend_key == 'Serie':
                val = normalize_serie(val)
                
            normalized[frontend_key] = val
            
    # 2. Keep extra fields if requested
    if keep_extra:
        mapped_targets = set(FRONTEND_MAPPING.values())
        for k, v in row.items():
            if k not in normalized and k not in mapped_targets:
                 normalized[k] = v
                 
    # 3. Apply location fallbacks (e.g. Local <-> Rua)
    normalized = _apply_location_fallbacks(normalized)
    
    return {k: (v if pd.notna(v) else "") for k, v in normalized.items()}


def _apply_location_fallbacks(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Apply intelligent fallbacks for location fields.
    If LocalInstalacao is empty, use RuaRef and vice-versa.
    This handles CSVs where the address data ended up in either field.
    """
    local = str(row.get('LocalInstalacao', '')).strip()
    rua = str(row.get('RuaRef', '')).strip()
    if not local and rua:
        row['LocalInstalacao'] = rua
    elif not rua and local:
        row['RuaRef'] = local
    return row

def normalize_dataframe(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Efficiently normalize a whole DataFrame to a list of dicts.
    """
    if df.empty:
        return []

    # 1. Rename columns based on mapping
    # Invert mapping search: for each col in df, see if it maps
    import unicodedata
    def canonicalize(s):
        s = str(s).upper()
        # Remove accents
        s = "".join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
        # Remove common separators
        return s.replace(' ', '').replace('/', '').replace('_', '').replace('-', '').strip()

    rename_dict = {}
    for col in df.columns:
        col_id = canonicalize(col)
        if col_id in FRONTEND_MAPPING:
            rename_dict[col] = FRONTEND_MAPPING[col_id]
        elif col.strip().upper() in FRONTEND_MAPPING: # Fallback  # pragma: no cover
            rename_dict[col] = FRONTEND_MAPPING[col.strip().upper()]
            
    # 2. Rename and convert
    df_norm = df.rename(columns=rename_dict)
    
    # 3. Handle duplicates: rename can create multiple columns with same name (e.g. AREA and SETOR both map to Area)
    # Keeping the first occurrence is usually what we want.
    df_norm = df_norm.loc[:, ~df_norm.columns.duplicated()]
    
    # 4. Apply strict transformation to 'Serie' if present
    if 'Serie' in df_norm.columns:
        df_norm['Serie'] = df_norm['Serie'].apply(normalize_serie)

    records = df_norm.fillna("").to_dict(orient="records")

    # 5. Apply location fallbacks to each record
    return [_apply_location_fallbacks(r) for r in records]
