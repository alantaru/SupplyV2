
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
import shutil
import os
import tempfile
try:
    from ..auth import get_current_active_user
    from ..core.refinery.ingestor import RefineryIngestor
    from ..core.refinery.mapper import RefineryMapper
    from ..core.refinery.normalizer import RefineryNormalizer
    from ..core.refinery.validator import RefineryValidator
    from ..core.refinery.cortex import RefineryCortex
except (ImportError, ValueError):
    from auth import get_current_active_user
    from core.refinery.ingestor import RefineryIngestor
    from core.refinery.mapper import RefineryMapper
    from core.refinery.normalizer import RefineryNormalizer
    from core.refinery.validator import RefineryValidator
    from core.refinery.cortex import RefineryCortex
from pydantic import BaseModel 
from typing import Optional

router = APIRouter(
    prefix="/refinery",
    tags=["refinery"],
    responses={404: {"description": "Not found"}},
)

@router.post("/process/{data_type}")
async def process_file(
    data_type: str,
    file: UploadFile = File(...),
    manual_mapping: Optional[str] = Form(None), # JSON string of manual override
    current_user: dict = Depends(get_current_active_user)
):
    """
    Universal Data Refinery Endpoint.
    Accepts a CSV file and optional manual mapping.
    Returns: Clean Data, Audit Report, and Suggested Mapping for UI.
    """
    import json
    
    # Parse manual mapping if provided
    override_mapping = {}
    if manual_mapping:
        try:
            override_mapping = json.loads(manual_mapping)
        except Exception:
             pass # Ignore bad json
    
    # 1. Save temp
    try:
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save upload: {e}")

    try:
        # 2. Ingest (Header Hunt + Deep Scan)
        ingestor = RefineryIngestor(tmp_path)
        df_raw = ingestor.ingest()
        
        # 3. Map (Smart Mapper + Cortex + User Override)
        mapper = RefineryMapper(data_type)
        
        # If user provided mapping, merge/use it
        # Logic: If manual_mapping is passed, strictly apply it? 
        # Or Just use it to seed the auto_map? 
        # Better: Mapper.apply_mapping can take an override. 
        # But our mapper currently does auto_map internally.
        
        # Let's get the suggestion first to report it back
        suggestion = mapper.auto_map(df_raw.columns.tolist())
        
        if override_mapping:
            # Apply override: update suggestion with manual choices
            # override format: {canonical: input_col}
            suggestion.update(override_mapping)
            mapper.column_mapping = suggestion # force state
            
        df_mapped = mapper.apply_mapping(df_raw)
        
        if df_mapped.empty:
             raise HTTPException(status_code=400, detail="Data ingestion resulted in empty dataset. Check file content.")

        # 4. Normalize
        normalizer = RefineryNormalizer()
        df_clean = normalizer.normalize(df_mapped, data_type)
        
        # 5. Validate (Iron Validator)
        validator = RefineryValidator()
        validation_result = validator.validate(df_clean, data_type)
        
        # 6. Result Structure
        
        return {
            "success": True,
            "filename": file.filename,
            "stats": {
                "encoding": ingestor.encoding,
                "delimiter": ingestor.delimiter,
                "header_row_index": ingestor.header_row_index,
                "total_rows": validation_result["stats"]["total"],
                "valid_rows": validation_result["stats"]["valid"],
                "rejected_rows": validation_result["stats"]["rejected"]
            },
            "mapping": {
                "used": suggestion, # The mapping actually used (Manual + Suggested)
                "detected": ingestor.header_row_index
            },
            "data": validation_result["valid_data"], # Only clean data
            "audit_report": validation_result["rejected_data"] # User fixes these
        }

    except ValueError as ve:
         raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Refinery Error: {str(e)}")
    finally:
        # Cleanup
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

class TrainingData(BaseModel):
    input_column: str
    canonical_column: str

@router.post("/learn")
async def learn_mapping(
    data: TrainingData,
    current_user: dict = Depends(get_current_active_user)
):
    """
    The 'User Final Word'.
    Saves a user's manual mapping correction to the Cortex (Brain).
    Future uploads with this column name will be auto-mapped correctly.
    """
    try:
        cortex = RefineryCortex()
        cortex.learn_mapping(data.input_column, data.canonical_column)
        return {"success": True, "message": f"Cortex learned: '{data.input_column}' -> '{data.canonical_column}'"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to teach Cortex: {e}")
