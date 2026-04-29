import json
import pandas as pd
from datetime import datetime
from typing import Any
from fastapi import UploadFile, HTTPException, File, Query
import database
from config import DEFAULT_CONTRACT
from core.refinery.ingestor import RefineryIngestor
from core.refinery.mapper import RefineryMapper
from core.refinery.normalizer import RefineryNormalizer
from core.refinery.cortex import RefineryCortex
import fsspec

import logging
logger = logging.getLogger(__name__)

# Legacy Validations & Normalizations replaced by Refinery

async def process_upload(file_key: str, file: UploadFile = File(...), contract_id: Any = Query(DEFAULT_CONTRACT), force_review: bool = False):
    # Radical Identity Protection: Handle duplicated contract_id params from stale frontend cache
    if isinstance(contract_id, list):
        # Pick the most recent/relevant one (usually the one manually added)
        contract_id = str(contract_id[-1])
    else:
        contract_id = str(contract_id)
        
    contract_id = contract_id.strip()

    if contract_id == 'undefined' or contract_id == 'null' or not contract_id:
         raise HTTPException(status_code=400, detail="Identificação de contrato inválida ou ausente.")

    try:
        from .core.contracts import ContractsManager
    except (ImportError, ValueError):
        from core.contracts import ContractsManager
    
    file_key = file_key.upper()
    mgr = ContractsManager()
    
    # 0. Get Requirements
    required_cols = mgr.get_required_columns(file_key)
    optional_cols = mgr.get_optional_columns(file_key)
    
    # If no requirements defined (e.g. legacy file), just save it
    if not required_cols and file_key not in ["PAPEL", "CONTADORES", "MAPA"]:
        try:
            content = await file.read()
            key = database.get_data_key(file_key, contract_id)
            uri = database.get_data_uri(file_key, contract_id)
            
            if database.get_storage().exists(key):
                backup_file(file_key, contract_id)
            
            with fsspec.open(uri, "wb") as f:
                f.write(content)
            return {"status": "success", "message": "File saved directly", "lines": 0}
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Upload failed: {str(e)}")
    
    # 1. Save to Temp for Analysis
    # Temp files can remain local for processing speed, OR go to S3 temp folder?
    # RefineryIngestor accepts a path/uri. If we save to S3, we need s3 URI.
    # Let's save to S3 temp to ensure scalability (stateless app servers).
    
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    temp_filename = f"{contract_id}_{file_key}_{timestamp}.csv"
    temp_key = f"temp/{temp_filename}"
    temp_uri = database.get_storage().get_uri(temp_key)
    
    try:
        content = await file.read()
        with fsspec.open(temp_uri, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Upload failed: {str(e)}")
        
        # 2. Analyze CSV
    # 2. Analyze CSV with Refinery Ingestor
    try:
        # Use Refinery Ingestor (Header Hunt + Deep Scan)
        ingestor = RefineryIngestor(temp_uri)
        df = ingestor.ingest()
        
        current_cols = [str(c).strip() for c in df.columns]
        
        # 3. Smart Mapping (Refinery Mapper + Cortex)
        # Only for known types, else use raw
        if file_key in ["MAPA", "CONTADORES", "PAPEL"]:
            mapper = RefineryMapper(file_key)
            
            # Auto-map using Cortex + Fuzzy
            suggestions = mapper.auto_map(current_cols)
            
            # Merge with Contract-Specific Saved Mappings (Priority: Saved > Cortex/Fuzzy)
            saved_map = mgr.get_mappings(contract_id).get(file_key, {})
            
            # Combine: Start with autosuggestions, update with saved
            # Both are {Canonical: Input}
            combined_map = suggestions.copy()
            combined_map.update({k: v for k, v in saved_map.items() if v})
            
            # Build a canonical-case-preserving map for persistence:
            # OPTIONAL_HEADERS uses mixed case (%Mg, %Yw) — we must preserve that.
            # Build a lookup: uppercase_key -> original_canonical_key
            all_canonical_keys = (
                mgr.get_required_columns(file_key) + mgr.get_optional_columns(file_key)
            )
            canonical_case_map = {k.upper(): k for k in all_canonical_keys}
            
            # Restore original case for combined_map keys before saving
            combined_map_canonical = {}
            for k, v in combined_map.items():
                original_key = canonical_case_map.get(k.upper(), k)
                combined_map_canonical[original_key] = v

            # [BRIDGE] Internal mapper needs UPPERCASE keys for apply_mapping
            combined_map_upper = {str(k).strip().upper(): v for k, v in combined_map_canonical.items()}

            # Apply mapping to see what we get
            mapper.column_mapping = combined_map_upper
            mapped_df = mapper.apply_mapping(df)
            
            # [BRIDGE] Legacy requires UPPERCASE Columns in DF
            mapped_df.columns = [str(c).strip().upper() for c in mapped_df.columns]
            
            mapped_cols = [str(c).strip() for c in mapped_df.columns]
            # Check Required (case-insensitive: required_cols são UPPERCASE, mapped_df já foi uppercased no bridge)
            mapped_cols_upper = [c.upper() for c in mapped_cols]
            missing_required = [req for req in required_cols if req.upper() not in mapped_cols_upper]
            
            # Check essential optionals: fields that populate the protocol but weren't auto-mapped.
            # A field is "pending review" if:
            #   - It's in the essential optional list
            #   - It was NOT successfully mapped to a real column in current_cols
            #   - It was NOT explicitly ignored by the user (saved as None/null in saved_map)
            #   - The CSV actually has enough columns to potentially contain it
            #     (i.e. the file has more columns than just the required ones)
            essential_optional_cols = mgr.get_essential_optional_columns(file_key)
            current_cols_set = set(current_cols)
            current_cols_upper_set = {c.upper() for c in current_cols}
            
            # Build set of fields the user has already explicitly decided on (mapped OR ignored)
            # A saved_map entry with a falsy value means "user chose to ignore this field"
            user_decided = set()
            for k, v in saved_map.items():
                user_decided.add(k.upper())
            
            # Only ask about essential optionals if the CSV has unmapped columns
            # that could potentially contain the essential data.
            # We only trigger this for MAPA files (which have protocol-critical fields).
            # For CONTADORES and PAPEL, the optional fields are toner/paper stats that
            # the fuzzy match handles well enough — don't interrupt the upload flow.
            assigned_csv_cols = {v for v in combined_map_canonical.values() if v and v in current_cols_set}
            unassigned_csv_cols = [c for c in current_cols if c not in assigned_csv_cols]
            
            missing_essential_optional = []
            # Only check essential optionals for MAPA (protocol fields) when there are
            # genuinely unassigned columns (not just the file's own optional columns)
            if file_key == "MAPA" and unassigned_csv_cols:
                # Canonical synonyms: if any synonym is mapped, the field is considered mapped
                # This handles cases where the mapper uses a different canonical name
                # for the same concept (e.g. 'setor' and 'AREA' are the same field)
                CANONICAL_SYNONYMS = {
                    'AREA': ['setor', 'SETOR', 'area'],
                    'FILA': ['fila', 'hostname', 'HOSTNAME'],
                    'MODELOSIMPRESS': ['modelosimpress', 'modelo', 'MODELO'],
                    'PLANTAINSTALADA': ['plantainstalada', 'data_instalacao', 'DATA_INSTALACAO'],
                    'LOCALINSTALACAO': ['localinstalacao', 'endereco', 'ENDERECO'],
                    'RUAREF': ['ruaref', 'rua', 'RUA'],
                    'CONTATOSETOR': ['contatosetor', 'contato', 'CONTATO', 'usuario', 'USUARIO'],
                }
                for col in essential_optional_cols:
                    col_upper = col.upper()
                    # Skip if user already decided (mapped or ignored)
                    if col_upper in user_decided:
                        continue
                    # Skip if auto-mapped to a real column (check canonical and synonyms)
                    synonyms = CANONICAL_SYNONYMS.get(col_upper, [col, col_upper])
                    is_mapped = False
                    for syn in synonyms:
                        mapped_val = combined_map_canonical.get(syn) or combined_map_canonical.get(syn.upper())
                        if mapped_val and (mapped_val in current_cols_set or mapped_val.upper() in current_cols_upper_set):
                            is_mapped = True
                            break
                    if not is_mapped:
                        missing_essential_optional.append(col)
            
            # Force Review Logic:
            # 1. Always if required fields are missing (SERIE not found)
            # 2. If force_review flag is explicitly set
            # NOTE: missing_essential_optional does NOT block import — it only triggers
            # the mapping modal so the user can optionally map those fields.
            # If SERIE is present, the file CAN be imported even without FILA, MODELOSIMPRESS, etc.
            has_prior_mapping = bool(saved_map)
            needs_optional_review = bool(missing_essential_optional) and not has_prior_mapping
            force_review_val = bool(missing_required) or needs_optional_review or force_review
            
            if not force_review_val:
                # SUCCESS - Normalize and Save
                normalizer = RefineryNormalizer()
                final_df = normalizer.normalize(mapped_df, file_key)
                
                # [BRIDGE] Ensure final DF is UPPERCASE (Normalizer might preserve case)
                final_df.columns = [str(c).strip().upper() for c in final_df.columns]
                
                uri = database.get_data_uri(file_key, contract_id)
                save_file(file_key, contract_id, final_df)

                # Always persist the effective mapping so ColumnMappingSettings can load it.
                # Save ALL entries that have a non-empty value — including self-mappings
                # (e.g. %Mg → %Mg) because they represent real column presence in the CSV.
                # Use canonical-case keys (%Mg, %Yw) not uppercase (%MG, %YW).
                # IMPORTANT: Only save mappings where the value actually exists in current_cols
                # to avoid saving phantom self-mappings like PLANTAINSTALADA → PLANTAINSTALADA
                # when the real column is "Planta Instalada".
                current_cols_upper = {c.upper() for c in current_cols}
                effective_map = {
                    k: v for k, v in combined_map_canonical.items()
                    if v and (v in current_cols or v.upper() in current_cols_upper)
                }
                if effective_map:
                    try:
                        mgr.save_mapping(contract_id, file_key, effective_map)
                        logger.info(f"Saved effective mapping for {file_key} in contract {contract_id}: {effective_map}")
                    except Exception as e:
                        logger.warning(f"Failed to persist effective mapping for {file_key}: {e}")

                # Persist raw headers so ColumnMappingSettings can display original column names
                try:
                    raw_headers_key = database.get_raw_headers_key(file_key, contract_id)
                    raw_headers_uri = database.get_storage().get_uri(raw_headers_key)
                    database.get_storage().ensure_dir(raw_headers_key)
                    with fsspec.open(raw_headers_uri, "w", encoding="utf-8") as f:
                        json.dump(current_cols, f, ensure_ascii=False)
                    logger.info(f"Saved raw headers for {file_key} in contract {contract_id}: {current_cols}")
                except Exception as e:
                    logger.warning(f"Failed to persist raw headers for {file_key}: {e}")
                
                try:
                    database.get_storage().delete(temp_key)
                except Exception:
                    pass
                
                return {
                    "status": "success",
                    "message": f"File accepted as {file_key}.csv (Refined)",
                    "lines": len(final_df)
                }
            else:
                # MAPPING REQUIRED
                # Prepare preview data (raw cols)
                preview_data = df.head(5).fillna("").to_dict(orient='records')
                
                return {
                    "status": "mapping_required",
                    "file_key": file_key,
                    "temp_token": temp_filename,
                    "detected_columns": current_cols,
                    "required_columns": required_cols,
                    "optional_columns": optional_cols,
                    "missing_after_mapping": missing_required,
                    "missing_essential_optional": missing_essential_optional,
                    "current_mapping": combined_map_canonical, # Use canonical case so frontend pre-fills correctly
                    "preview_data": preview_data
                }
                
        else:
             # Unknown file type, just save raw (legacy behavior for simple files)
             save_file(file_key, contract_id, df)
             try:
                 database.get_storage().delete(temp_key)
             except Exception:
                 pass
             return {"status": "success", "message": "File saved (Raw)", "lines": len(df)}

    except Exception as e:
        import traceback
        traceback.print_exc()
        try:
            database.get_storage().delete(temp_key)
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=f"Refinery Processing failed: {str(e)}")

def save_file(file_key: str, contract_id: str, df: pd.DataFrame):
    uri = database.get_data_uri(file_key, contract_id)
    key = database.get_data_key(file_key, contract_id)
    
    # Garantir que o diretório do contrato existe antes de salvar
    storage = database.get_storage()
    storage.ensure_dir(key)
    
    # Backup
    if storage.exists(key):
        backup_file(file_key, contract_id)
        
    # Use Robust Saver (Cleaning included)
    database.save_dataframe_csv(df, uri)

def confirm_mapping(contract_id: str, payload: dict):
    try:
        from .core.contracts import ContractsManager
    except (ImportError, ValueError):
        from core.contracts import ContractsManager
    
    temp_token = payload.get("temp_token")
    mapping = payload.get("mapping", {})
    # save_for_future is handled implicitly by always-save logic
    file_key = payload.get("file_key", "").upper()
    
    # Recover temp URI from token (token is filename)
    temp_filename = temp_token
    temp_key = f"temp/{temp_filename}"
    temp_uri = database.get_storage().get_uri(temp_key)
    
    if not database.get_storage().exists(temp_key):
        # Fallback to check if it was a full path token? No, assuming standard logic.
        raise HTTPException(status_code=404, detail="Session expired (Temp file not found)")
        
    try: # REFINERY START
        # Load with Ingestor (Robust)
        ingestor = RefineryIngestor(temp_uri)
        df = ingestor.ingest()
        
        # Apply Logic using Mapper
        if file_key in ["MAPA", "CONTADORES", "PAPEL"]:
            # Normalize mapping keys and VALUES to pure Python strings
            # This is critical to avoid NumPy 2.0 serialization errors in JSON
            # Keep original case for saving; use uppercase only for internal mapper
            mapping_canonical = {str(k).strip(): (str(v).strip() if v else None) for k, v in mapping.items()}
            mapping = {str(k).strip().upper(): (str(v).strip() if v else None) for k, v in mapping_canonical.items()}
            
            # Capture raw headers BEFORE mapping (Task 3.3)
            raw_cols = [str(c).strip() for c in df.columns]
            
            mapper = RefineryMapper(file_key)
            mapper.column_mapping = mapping # Use User's Mapping (Final Word)
            df = mapper.apply_mapping(df)
            
            # TEACH CORTEX
            # Iterate through the user's mapping and teach the brain
            # Mapping is {Canonical: Input}
            cortex = RefineryCortex()
            for canonical, input_col in mapping.items():
                if input_col:
                    cortex.learn_mapping(input_col, canonical)
            
            # Normalize
            normalizer = RefineryNormalizer()
            df = normalizer.normalize(df, file_key)
            
            # [BRIDGE] Legacy requires UPPERCASE Columns
            df.columns = [str(c).strip().upper() for c in df.columns]

        # Validate again
        mgr = ContractsManager()
        required = mgr.get_required_columns(file_key)
        missing = [r for r in required if r not in df.columns]
        
        if missing:
             raise HTTPException(status_code=400, detail=f"Mapping incomplete. Missing: {missing}")
             
        # Save Mapping if requested — use canonical case (preserves %Mg, %Yw)
        # Always save when user went through the review modal, even if save_for_future is False,
        # so we record explicit ignores (null values) and don't ask again next upload.
        # mapping_canonical already has None for fields the user left blank (ignored).
        mgr.save_mapping(contract_id, file_key, mapping_canonical)
            
        # Save File
        save_file(file_key, contract_id, df)
        
        # Persist raw headers so ColumnMappingSettings can display original column names (Task 3.3)
        try:
            raw_headers_key = database.get_raw_headers_key(file_key, contract_id)
            raw_headers_uri = database.get_storage().get_uri(raw_headers_key)
            database.get_storage().ensure_dir(raw_headers_key)
            with fsspec.open(raw_headers_uri, "w", encoding="utf-8") as f:
                json.dump(raw_cols, f, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"Failed to persist raw headers for {file_key} in confirm_mapping: {e}")
        
        try:
            database.get_storage().delete(temp_key)
        except Exception:
            pass
        
        # FINAL SANITIZATION: Ensure no numpy types leak into the response
        try:
            line_count = int(len(df))
        except Exception:
            line_count = 0
            
        return {"status": "success", "lines": line_count}
        
    except Exception as e:
        import traceback
        logger.error(f"Error in confirm_mapping: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Clean the error message from numpy-poisoning as well
        error_msg = str(e)
        if "numpy" in error_msg.lower():
             error_msg = "Erro de compatibilidade de dados (NumPy detected). O sistema tentará autodestilar os tipos na próxima tentativa."
             
        raise HTTPException(status_code=400, detail=error_msg)

def backup_file(file_key: str, contract_id: str = DEFAULT_CONTRACT):
    file_key = file_key.upper()
    source_key = database.get_data_key(file_key, contract_id)
    
    if not database.get_storage().exists(source_key):
        return None
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    backup_filename = f"{file_key.lower()}_{timestamp}.csv"
    dest_key = f"{contract_id}/backups/{backup_filename}"
    
    database.get_storage().ensure_dir(dest_key)
    database.get_storage().copy(source_key, dest_key)
    return backup_filename

def list_backups(file_key: str, contract_id: str = DEFAULT_CONTRACT):
    file_key = file_key.upper()
    # List files in backups prefix
    prefix = f"{contract_id}/backups/"
    # Ideally should filter by file_key prefix too, but storage.list_files returns all in prefix.
    # We filter manually.
    
    files = database.get_storage().list_files(prefix)
    # files are filenames only usually (based on list_files impl)
    
    target_prefix = f"{file_key.lower()}_"
    relevant_files = [f for f in files if f.startswith(target_prefix) and f.endswith(".csv")]
    
    # To get metadata (date, size), S3 needs head_object for each, which is slow.
    # LocalStorage uses stat().
    # For now, extract date from filename (timestamp)
    results = []
    for fname in relevant_files:
        # fname format: key_YYYYMMDD_HHMMSS_ffffff.csv
        try:
            ts_str = fname.split('_', 1)[1].rsplit('.', 1)[0]
            # Adjust format parsing if needed
            ts = datetime.strptime(ts_str, "%Y%m%d_%H%M%S_%f")
            date_display = ts.strftime("%d/%m/%Y %H:%M:%S")
        except Exception:
            date_display = "Unknown"
            
        results.append({
            "filename": fname,
            "date": date_display,
            "size": "Unknown (S3)" # Optimized to avoid N api calls
        })
        
    return sorted(results, key=lambda x: x['filename'], reverse=True)

def restore_backup(filename: str, contract_id: str = DEFAULT_CONTRACT):
    backup_key = f"{contract_id}/backups/{filename}"
    
    if not database.get_storage().exists(backup_key):
         raise HTTPException(status_code=404, detail="Backup not found")
         
    file_key = filename.split('_')[0].upper()
    target_key = database.get_data_key(file_key, contract_id)
    
    # Backup current before restore
    backup_file(file_key, contract_id)
    
    database.get_storage().copy(backup_key, target_key)
    return {"status": "success", "restored_from": filename}

def delete_backup(filename: str, contract_id: str = DEFAULT_CONTRACT):
    """Delete a specific backup file."""
    backup_key = f"{contract_id}/backups/{filename}"
    
    try:
        if database.get_storage().exists(backup_key):
             database.get_storage().delete(backup_key)
        return {"status": "success", "deleted": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete: {str(e)}")

def delete_data_file(file_key: str, contract_id: str = DEFAULT_CONTRACT):
    """
    Deletes an individual data file after creating a backup.
    """
    file_key = file_key.upper()
    key = database.get_data_key(file_key, contract_id)
    
    if not database.get_storage().exists(key):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")
    
    try:
        # 1. Backup before delete
        backup_file(file_key, contract_id)
        
        # 2. Delete
        database.get_storage().delete(key)
        
        return {"status": "success", "message": f"Arquivo {file_key} excluído com sucesso."}
    except Exception as e:
        logger.error(f"Error deleting data file {file_key}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao excluir arquivo: {str(e)}")

def get_preview(file_key: str, contract_id: str = DEFAULT_CONTRACT):
    file_key = file_key.upper()
    key = database.get_data_key(file_key, contract_id)
    uri = database.get_data_uri(file_key, contract_id)
    
    if not database.get_storage().exists(key):
        return {"exists": False}
        
    meta = database.get_storage().get_metadata(key)
    last_mod = meta.get('last_modified', datetime.now()).strftime("%d/%m/%Y %H:%M:%S")
    
    try:
        # Use robust loader which handles BOM and separator detection
        # Logic matches load_contadores/load_mapa consistency
        # repair_and_load_csv now accepts URI
        df = database.repair_and_load_csv(uri, sep=';', encoding='utf-8-sig')
        
        # Limit rows for preview
        df_preview = df.head(20)
        
        # Replace NaN with ""
        df_preview = df_preview.fillna("")
        
        return {
            "exists": True,
            "filename": f"{file_key}.csv", 
            "last_modified": last_mod,
            "rows": df_preview.to_dict(orient='records'),
            "columns": list(df_preview.columns)
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"exists": True, "error": f"Preview failed: {str(e)}"}
