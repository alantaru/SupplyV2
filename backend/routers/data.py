from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
try:
    from .. import database
    from ..core.session import ContractSession
    from ..dependencies import get_authorized_session
except (ImportError, ValueError):
    import database
    from core.session import ContractSession
    from dependencies import get_authorized_session

router = APIRouter(prefix="/data", tags=["data"])

@router.get("/assist/search")
def search_equipment(q: str, session: ContractSession = Depends(get_authorized_session)):
    result = session.equipment.search(q)
    return {"results": result}

@router.get("/assist/equipment/{serie}")
def get_equipment_details(serie: str, session: ContractSession = Depends(get_authorized_session)):
    result = session.equipment.get_details(serie)
    return result if result else {"found": False}

@router.get("/assist/routes")
def get_routes(session: ContractSession = Depends(get_authorized_session)):
    return session.equipment.get_proactive_routes()

@router.get("/assist/dashboard")
def get_equipment_dashboard_trends(session: ContractSession = Depends(get_authorized_session)):
    return session.equipment.get_dashboard_trends()

@router.get("/assist/inventory")
def get_inventory(session: ContractSession = Depends(get_authorized_session)):
    """
    Returns MAPA rows enriched with toner data from Contadores.
    Server-side join using raw CSV read to bypass any normalization gaps.
    """
    import pandas as pd
    try:
        from ..core import adapters
    except (ImportError, ValueError):
        from core import adapters

    df_mapa = database.load_mapa(session.contract_id)

    if df_mapa.empty:
        return []

    # Load Contadores raw — use repair_and_load_csv directly to get all columns
    # including toner percentages that may not survive normalize_dataframe
    df_cnt = pd.DataFrame()
    try:
        cnt_key = database.get_data_key('CONTADORES', session.contract_id)
        storage = database.get_storage()
        if storage.exists(cnt_key):
            cnt_uri = storage.get_uri(cnt_key)
            df_cnt = database.repair_and_load_csv(cnt_uri, sep=';', encoding='utf-8-sig')
            if df_cnt.empty:
                # Try comma separator
                df_cnt = database.repair_and_load_csv(cnt_uri, sep=',', encoding='utf-8-sig')
    except Exception:
        df_cnt = pd.DataFrame()

    # Normalize MAPA
    mapa_rows = adapters.normalize_dataframe(df_mapa)

    # Build toner lookup from raw Contadores DataFrame
    toner_lookup = {}
    if not df_cnt.empty:
        # Find serie column (case-insensitive)
        serie_col = next(
            (c for c in df_cnt.columns if c.strip().upper() in ('SERIE', 'SERIAL', 'SN')),
            df_cnt.columns[0] if len(df_cnt.columns) > 0 else None
        )

        # Find toner columns by normalized name
        def find_col(candidates):
            for c in df_cnt.columns:
                norm = c.strip().upper().replace(' ', '').replace('%', '')
                for x in candidates:
                    if norm == x.upper().replace(' ', '').replace('%', ''):
                        return c
            return None

        col_bk = find_col(['%BK', 'BK', 'TONERBK', 'TONERBLACK', 'PRETO'])
        col_cy = find_col(['%CY', 'CY', 'TONERCY', 'TONERCYAN', 'CIANO'])
        col_mg = find_col(['%Mg', '%MG', 'MG', 'TONERMG', 'TONERMAGENTA', 'MAGENTA'])
        col_yw = find_col(['%Yw', '%YW', 'YW', 'TONERYW', 'TONERYELLOW', 'AMARELO'])

        if serie_col:
            for _, row in df_cnt.iterrows():
                serie = str(row.get(serie_col, '')).strip().upper()[:14]
                if not serie:
                    continue
                toner_lookup[serie] = {
                    'toner_bk': str(row[col_bk]).strip() if col_bk and pd.notna(row.get(col_bk)) else '',
                    'toner_cy': str(row[col_cy]).strip() if col_cy and pd.notna(row.get(col_cy)) else '',
                    'toner_mg': str(row[col_mg]).strip() if col_mg and pd.notna(row.get(col_mg)) else '',
                    'toner_yw': str(row[col_yw]).strip() if col_yw and pd.notna(row.get(col_yw)) else '',
                }

    # Enrich MAPA rows
    result = []
    for row in mapa_rows:
        serie = str(row.get('Serie', '')).strip().upper()[:14]
        toner = toner_lookup.get(serie, {})
        enriched = dict(row)
        enriched['toner_bk'] = toner.get('toner_bk', '')
        enriched['toner_cy'] = toner.get('toner_cy', '')
        enriched['toner_mg'] = toner.get('toner_mg', '')
        enriched['toner_yw'] = toner.get('toner_yw', '')
        # LocalInstalacao: se vazio, usar RuaRef como fallback (dados podem estar em qualquer um dos dois)
        local = enriched.get('LocalInstalacao', '').strip()
        rua = enriched.get('RuaRef', '').strip()
        if not local:
            enriched['LocalInstalacao'] = rua
        elif not rua:
            enriched['RuaRef'] = local
        result.append(enriched)

    return result

@router.get("/assist/route_equipment")
def get_route_equipment(route: str, session: ContractSession = Depends(get_authorized_session)):
    return session.equipment.get_by_route(route)

@router.post("/entregas")
def create_protocol(data: dict, session: ContractSession = Depends(get_authorized_session)):
    return session.protocols.create(data)

@router.get("/entregas")
def get_entregas(
    limit: int = 50, 
    status: str = 'pending', 
    city: Optional[str] = None, 
    fila: Optional[str] = None, 
    empresa: Optional[str] = None, 
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    session: ContractSession = Depends(get_authorized_session)
):
    filters = {}
    if city:
        filters['city'] = city
    if fila:
        filters['fila'] = fila
    if empresa:
        filters['empresa'] = empresa
    if search:
        filters['search'] = search
    if status:
        filters['status'] = status
    if start_date:
        filters['start_date'] = start_date
    if end_date:
        filters['end_date'] = end_date
    
    return session.protocols.get_pending(limit=limit, filters=filters)

@router.get("/entregas/export")
def export_entregas(
    status: str = 'pending',
    city: Optional[str] = None,
    fila: Optional[str] = None,
    empresa: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    session: ContractSession = Depends(get_authorized_session)
):
    from fastapi.responses import StreamingResponse

    filters = {}
    if city:
        filters['city'] = city
    if fila:
        filters['fila'] = fila
    if empresa:
        filters['empresa'] = empresa
    if search:
        filters['search'] = search
    if status:
        filters['status'] = status
    if start_date:
        filters['start_date'] = start_date
    if end_date:
        filters['end_date'] = end_date

    csv_content = session.protocols.get_export(filters=filters)
    
    # Create a generator for streaming
    def iterfile():
        yield csv_content

    filename = f"export_entregas_{status}_{session.contract_id}.csv"
    
    return StreamingResponse(
        iterfile(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/entregas/filter-options")
def get_filter_options(session: ContractSession = Depends(get_authorized_session)):
    return session.protocols.get_filter_options()

@router.get("/mapa")
def get_mapa(limit: int = 5000, session: ContractSession = Depends(get_authorized_session)):
    # Direct DB access needs contract_id from session
    df = database.load_mapa(session.contract_id)
    
    # Use Central Adapter
    try:
        from ..core import adapters
    except (ImportError, ValueError):
        from core import adapters
    return adapters.normalize_dataframe(df.head(limit))

@router.post("/mapa/unique/{field}")
def get_mapa_unique_values(field: str, payload: dict, session: ContractSession = Depends(get_authorized_session)):
    current_filters = payload.get("current_filters", [])
    return session.equipment.get_unique_values(field, current_filters)

@router.get("/papel")
def get_papel(limit: int = 10, session: ContractSession = Depends(get_authorized_session)):
    df = database.load_papel(session.contract_id)
    # Use Central Adapter
    from ..core import adapters
    return adapters.normalize_dataframe(df.head(limit))

@router.get("/contadores")
def get_contadores(limit: int = 5000, session: ContractSession = Depends(get_authorized_session)):
    df = database.load_contadores(session.contract_id)
    # Use Central Adapter
    from ..core import adapters
    return adapters.normalize_dataframe(df.head(limit))

@router.get("/entregas/{protocol_id}")
def get_protocol(protocol_id: int, session: ContractSession = Depends(get_authorized_session)):
    return session.protocols.get_by_id(protocol_id)

@router.put("/entregas/{protocol_id}")
def update_protocol(protocol_id: int, data: dict, session: ContractSession = Depends(get_authorized_session)):
    return session.protocols.update(protocol_id, data)

@router.post("/entregas/{protocol_id}/deliver")
def deliver_protocol(protocol_id: int, data: dict, session: ContractSession = Depends(get_authorized_session)):
    return session.protocols.deliver(protocol_id, data)

@router.post("/entregas/{protocol_id}/cancel")
def cancel_protocol(protocol_id: int, data: dict, session: ContractSession = Depends(get_authorized_session)):
    return session.protocols.cancel(protocol_id, data.get("reason", ""))

# --- Column Mapping Endpoints (User Accessible) ---

@router.get("/mappings")
def get_mappings(session: ContractSession = Depends(get_authorized_session)):
    try:
        from ..core.contracts import ContractsManager
    except (ImportError, ValueError):
        from core.contracts import ContractsManager
    mgr = ContractsManager()
    return mgr.get_mappings(session.contract_id)

@router.get("/columns/{file_key}")
def get_columns(file_key: str, session: ContractSession = Depends(get_authorized_session)):
    from ..core.contracts import ContractsManager
    mgr = ContractsManager()
    return {
        "required": mgr.get_required_columns(file_key),
        "optional": mgr.get_optional_columns(file_key)
    }

@router.get("/files/{file_key}/headers")
def get_file_headers(file_key: str, session: ContractSession = Depends(get_authorized_session)):
    from ..core.contracts import ContractsManager
    mgr = ContractsManager()
    return {
        "headers": mgr.get_current_file_headers(session.contract_id, file_key)
    }

@router.put("/mappings/{file_key}")
def update_mapping(file_key: str, mapping: dict, session: ContractSession = Depends(get_authorized_session)):
    from ..core.contracts import ContractsManager
    mgr = ContractsManager()
    mgr.save_mapping(session.contract_id, file_key, mapping)
    return {"status": "success"}

@router.get("/debug/mapping-state")
def debug_mapping_state(session: ContractSession = Depends(get_authorized_session)):
    """
    Diagnostic endpoint — returns the full mapping state for the active contract.
    Shows: saved mappings, raw headers, and detected headers for all 3 bases.
    """
    try:
        from ..core.contracts import ContractsManager
        import database as db
    except (ImportError, ValueError):
        from core.contracts import ContractsManager
        import database as db

    mgr = ContractsManager()
    contract_id = session.contract_id
    file_keys = ["MAPA", "CONTADORES", "PAPEL"]

    result = {
        "contract_id": contract_id,
        "bases": {}
    }

    saved_mappings = mgr.get_mappings(contract_id)

    for fk in file_keys:
        raw_key = db.get_raw_headers_key(fk, contract_id)
        data_key = db.get_data_key(fk, contract_id)
        storage = db.get_storage()

        result["bases"][fk] = {
            "saved_mapping": saved_mappings.get(fk, {}),
            "raw_headers_file_exists": storage.exists(raw_key),
            "raw_headers_key": raw_key,
            "csv_file_exists": storage.exists(data_key),
            "detected_headers": mgr.get_current_file_headers(contract_id, fk),
        }

    return result


@router.post("/debug/rescan-mapping/{file_key}")
def debug_rescan_mapping(file_key: str, session: ContractSession = Depends(get_authorized_session)):
    """
    Diagnostic/repair endpoint — re-reads the current CSV, runs auto_map,
    and saves the detected mapping + raw headers for the given base.
    Use this to repair contracts created before the column-mapping-sync fix.
    """
    try:
        from ..core.contracts import ContractsManager
        from ..core.refinery.mapper import RefineryMapper
        from ..core.refinery.ingestor import RefineryIngestor
        import database as db
        import fsspec
        import json
    except (ImportError, ValueError):
        from core.contracts import ContractsManager
        from core.refinery.mapper import RefineryMapper
        from core.refinery.ingestor import RefineryIngestor
        import database as db
        import fsspec
        import json

    mgr = ContractsManager()
    contract_id = session.contract_id
    fk = file_key.upper()

    data_key = db.get_data_key(fk, contract_id)
    storage = db.get_storage()

    if not storage.exists(data_key):
        raise HTTPException(status_code=404, detail=f"No CSV found for {fk} in contract {contract_id}")

    try:
        uri = storage.get_uri(data_key)
        ingestor = RefineryIngestor(uri)
        df = ingestor.ingest()
        current_cols = [str(c).strip() for c in df.columns]

        # Run auto_map
        mapper = RefineryMapper(fk)
        suggestions = mapper.auto_map(current_cols)
        saved_map = mgr.get_mappings(contract_id).get(fk, {})

        # Merge: saved takes priority
        combined = {str(k).strip().upper(): v for k, v in suggestions.items()}
        combined.update({str(k).strip().upper(): v for k, v in saved_map.items() if v})

        effective = {k: v for k, v in combined.items() if v}

        # Save mapping
        if effective:
            mgr.save_mapping(contract_id, fk, effective)

        # Save raw headers
        raw_key = db.get_raw_headers_key(fk, contract_id)
        raw_uri = storage.get_uri(raw_key)
        storage.ensure_dir(raw_key)
        with fsspec.open(raw_uri, "w", encoding="utf-8") as f:
            json.dump(current_cols, f, ensure_ascii=False)

        return {
            "status": "ok",
            "file_key": fk,
            "contract_id": contract_id,
            "current_cols": current_cols,
            "effective_mapping": effective,
            "raw_headers_saved": raw_key,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
